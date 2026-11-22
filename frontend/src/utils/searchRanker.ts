/**
 * High-Performance In-Memory Search & Priority Relevance Ranker
 *
 * Priority Rules:
 * 1. First Priority: posDisplayName (Highest Weight)
 * 2. Second Priority: productLineName (Secondary Weight)
 * 3. SKU / Exact Barcode Scan (Instant top match)
 * 4. Product Name, Dimensions, Brand, Category (Standard matching)
 *
 * Performance:
 * Uses lazy cached fields (_srDoc, _srPos, etc.) to achieve sub-millisecond
 * search times across thousands of inventory items without GC overhead.
 */
export function rankSearchResults<T extends Record<string, any>>(
  items: T[],
  query: string,
  limit: number = 0
): T[] {
  const rawQuery = (query || '').trim().toLowerCase();
  if (!rawQuery) return items;

  // Normalize dimension spacing: "78 x 42" -> "78x42" and "78 * 42" -> "78x42"
  const normalizedQuery = rawQuery.replace(/(\d+)\s*[xX*×]\s*(\d+)/g, '$1x$2');
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const tokenLen = tokens.length;
  if (tokenLen === 0) return items;

  interface ScoredItem {
    item: T;
    score: number;
  }

  const results: ScoredItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const anyIt = it as any;
    let doc = anyIt._srDoc;
    let pos = anyIt._srPos;
    let plName = anyIt._srPl;
    let prodName = anyIt._srName;
    let sku = anyIt._srSku;
    let size = anyIt._srSize;
    let thick = anyIt._srThick;

    if (doc === undefined) {
      pos = (it.posDisplayName || it.productId?.posDisplayName || '').toLowerCase();
      if (pos.includes('x') || pos.includes('×') || pos.includes('*')) {
        pos = pos.replace(/(\d+)\s*[xX*×]\s*(\d+)/g, '$1x$2');
      }
      plName = (
        it.productLineName ||
        it.productLine?.name ||
        (typeof it.productLineId === 'object' ? it.productLineId?.name : '') ||
        it.product?.productLineName ||
        it.product?.productLine?.name ||
        ''
      ).toLowerCase();
      prodName = (it.productName || it.product?.name || it.productId?.name || it.name || '').toLowerCase();
      sku = (it.sku || '').toLowerCase();
      size = (it.sizeLabel || it.size?.displayLabel || (it.size?.length && it.size?.width ? `${it.size.length}x${it.size.width}` : '')).toLowerCase();
      thick = (it.thicknessLabel || it.thickness?.displayLabel || (it.thickness?.value ? `${it.thickness.value}` : '')).toLowerCase();
      const brand = (it.brandName || it.brand?.name || (typeof it.brandId === 'object' ? it.brandId?.name : '') || '').toLowerCase();
      const cat = (it.categoryName || it.category?.name || (typeof it.categoryId === 'object' ? it.categoryId?.name : '') || '').toLowerCase();

      doc = `${pos} ${plName} ${prodName} ${sku} ${size} ${thick} ${brand} ${cat}`;

      anyIt._srDoc = doc;
      anyIt._srPos = pos;
      anyIt._srPl = plName;
      anyIt._srName = prodName;
      anyIt._srSku = sku;
      anyIt._srSize = size;
      anyIt._srThick = thick;
    }

    // Fast token match against the item search document
    let matchesAll = true;
    for (let t = 0; t < tokenLen; t++) {
      if (!doc.includes(tokens[t])) {
        matchesAll = false;
        break;
      }
    }
    if (!matchesAll) continue;

    // Calculate Priority Score
    let score = 0;

    // 1. posDisplayName (First Priority: Top Weight)
    if (pos) {
      if (pos === normalizedQuery) {
        score += 3000;
      } else if (pos.startsWith(normalizedQuery)) {
        score += 2000;
      } else if (pos.includes(normalizedQuery)) {
        score += 1500;
      }

      // Token-level scoring for posDisplayName
      for (let t = 0; t < tokenLen; t++) {
        const tok = tokens[t];
        if (pos.startsWith(tok)) score += 400;
        else if (pos.includes(tok)) score += 250;
      }
    }

    // 2. productLineName (Second Priority: High Secondary Weight)
    if (plName) {
      if (plName === normalizedQuery) {
        score += 1800;
      } else if (plName.startsWith(normalizedQuery)) {
        score += 1200;
      } else if (plName.includes(normalizedQuery)) {
        score += 900;
      }

      // Token-level scoring for productLineName
      for (let t = 0; t < tokenLen; t++) {
        const tok = tokens[t];
        if (plName.startsWith(tok)) score += 250;
        else if (plName.includes(tok)) score += 150;
      }
    }

    // 3. productName
    if (prodName) {
      if (prodName.startsWith(normalizedQuery)) score += 500;
      else if (prodName.includes(normalizedQuery)) score += 300;
      for (let t = 0; t < tokenLen; t++) {
        if (prodName.includes(tokens[t])) score += 60;
      }
    }

    // 4. SKU exact barcode match (Scanned barcode goes right to top)
    if (sku === normalizedQuery) {
      score += 4000;
    } else if (sku.includes(normalizedQuery)) {
      score += 200;
    }

    // 5. Dimension / Size / Thickness
    if (size.includes(normalizedQuery) || thick.includes(normalizedQuery)) {
      score += 150;
    }

    results.push({ item: it, score });
  }

  // Sort by score descending (highest relevance first)
  results.sort((a, b) => b.score - a.score);

  const matched = results.map((r) => r.item);
  return limit > 0 ? matched.slice(0, limit) : matched;
}
