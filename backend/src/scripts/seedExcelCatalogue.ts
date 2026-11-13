import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  Branch,
  Account,
  StockLocation,
  Brand,
  Category,
  ProductLine,
  Size,
  Thickness,
  Product,
  Variant,
  StockBalance,
  StockMovement,
  PriceHistory,
} from '../models/index.js';
import { ACCOUNT_ROLES, STANDARD_BRANCH_PERMISSIONS, STOCK_LOCATION_TYPES } from '../constants/index.js';

interface CSVRow {
  brandName: string;
  categoryName: string;
  productLine: string;
  displayLabel: string;
  length: number;
  width: number;
  thickness: number;
  listPrice: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  distributorPrice: number;
  currentStock: number;
  minStock: number;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerIdx = lines.findIndex((l) => l.startsWith('Item #'));
  if (headerIdx === -1) return [];

  const header = lines[headerIdx].split(',').map((h) => h.trim());
  const rows: CSVRow[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('TOTAL') || line.length === 0) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const rowObj: Record<string, string> = {};
    header.forEach((h, idx) => {
      let val = values[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      rowObj[h] = val.trim();
    });

    const brand = rowObj['Brand'];
    const category = rowObj['Category'];
    const productLine = rowObj['Product Line'];
    if (!brand || !productLine) continue;

    const length = parseFloat(rowObj['Length (in)']) || 0;
    const width = parseFloat(rowObj['Width (in)']) || 0;
    const thickness = parseFloat(rowObj['Thickness (in)']) || 0;

    const listPrice = parseFloat(rowObj['List Price'] || '0') || 0;
    const purchasePrice = parseFloat(rowObj['Purchase price'] || rowObj['Purchase Price'] || '0') || 0;
    const retailPrice = parseFloat(rowObj['Retail price'] || rowObj['Retail Price'] || '0') || 0;
    const wholesalePrice = parseFloat(rowObj['Wholesale price'] || rowObj['Wholesale Price'] || '0') || 0;
    const distributorPrice = parseFloat(rowObj['Distributor Price'] || '0') || 0;

    const minStock = parseInt(rowObj['Minimum Stock'] || '0', 10) || 0;
    const currentStock = parseInt(rowObj['Current Stock'] || '0', 10) || 0;

    rows.push({
      brandName: brand,
      categoryName: category,
      productLine,
      displayLabel: rowObj['Display label'] || `${length}x${width}`,
      length,
      width,
      thickness,
      listPrice,
      purchasePrice,
      retailPrice,
      wholesalePrice,
      distributorPrice,
      currentStock,
      minStock,
    });
  }

  return rows;
}

export async function seedExcelCatalogue() {
  console.log('=== STARTING EXCEL CATALOGUE SEEDING ===');
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  // 1. Wipe old products, variants, balances, movements, brands, categories, sizes, thicknesses
  console.log('Removing old catalogue records (products, variants, productlines, brands, categories, sizes, thicknesses)...');
  await Promise.all([
    db.collection('products').deleteMany({}),
    db.collection('variants').deleteMany({}),
    db.collection('productlines').deleteMany({}).catch(() => {}),
    db.collection('stockbalances').deleteMany({}),
    db.collection('stockmovements').deleteMany({}),
    db.collection('pricehistories').deleteMany({}),
    db.collection('brands').deleteMany({}),
    db.collection('categories').deleteMany({}),
    db.collection('sizes').deleteMany({}),
    db.collection('thicknesses').deleteMany({}),
  ]);

  // 2. Create or Ensure the Target Branch: "MoltyFoam and Celeste Store"
  console.log('Setting up branch "MoltyFoam and Celeste Store"...');
  let branch = await Branch.findOne({
    $or: [{ name: 'MoltyFoam and Celeste Store' }, { code: 'SHOP-CELESTESTORE' }],
  });

  if (!branch) {
    branch = await Branch.create({
      code: 'SHOP-CELESTESTORE',
      name: 'MoltyFoam and Celeste Store',
      shopNumber: 'Shop #01',
      type: 'RETAIL_STORE',
      city: 'Karachi',
      address: 'Main Commercial Branch, Karachi',
      phone: '0300-1234567',
      loginId: 'celeste_branch',
      status: 'ACTIVE',
      targetMonthlySales: 5000000,
    });
  } else {
    branch.name = 'MoltyFoam and Celeste Store';
    (branch as any).status = 'ACTIVE';
    await branch.save();
  }

  // Ensure Default StockLocation for this branch
  let floorLocation = await StockLocation.findOne({
    branchId: branch._id,
    type: STOCK_LOCATION_TYPES.SALES_FLOOR,
  });

  if (!floorLocation) {
    floorLocation = await StockLocation.create({
      branchId: branch._id,
      name: 'Sales Floor',
      code: 'LOC-FLOOR-CELESTE',
      type: STOCK_LOCATION_TYPES.SALES_FLOOR,
      status: 'ACTIVE',
      isDefault: true,
    });
  }

  // Ensure Branch Account for this branch
  let branchAccount = await Account.findOne({ branchId: branch._id });
  if (!branchAccount) {
    const passwordHash = await bcrypt.hash('Branch@Molty2026!', 10);
    branchAccount = await Account.create({
      name: 'MoltyFoam and Celeste Store',
      email: 'celeste@gmail.com',
      loginId: 'celeste_branch',
      passwordHash,
      role: ACCOUNT_ROLES.BRANCH,
      branchId: branch._id,
      assignedBranchId: branch._id,
      status: 'ACTIVE',
      permissions: STANDARD_BRANCH_PERMISSIONS,
    });
  }

  // 3. Parse CSV files
  const dataDir = path.resolve(process.cwd(), 'data');
  const mcFile = path.join(dataDir, 'master_celeste.csv');
  const mfFile = path.join(dataDir, 'molty_foam.csv');

  const mcRows = parseCSV(mcFile);
  const mfRows = parseCSV(mfFile);
  console.log(`Parsed ${mcRows.length} MasterCeleste rows from CSV.`);
  console.log(`Parsed ${mfRows.length} Molty rows from CSV.`);
  const allRows = [...mcRows, ...mfRows];
  console.log(`Total rows to import: ${allRows.length}`);

  // 4. Create Brands
  console.log('Seeding Brands...');
  const brandDefs = [
    { name: 'MasterCeleste', code: 'CELESTE', description: 'Master Celeste Luxury Bedding & Mattresses' },
    { name: 'MoltyFoam', code: 'MOLTY', description: 'MoltyFoam Quality Foam Products' },
  ];

  const brandMap = new Map<string, any>();
  for (const bDef of brandDefs) {
    let brand = await Brand.findOne({ code: bDef.code });
    if (!brand) {
      brand = await Brand.create({
        name: bDef.name,
        code: bDef.code,
        description: bDef.description,
        branchId: branch._id,
        status: 'ACTIVE',
      });
    }
    brandMap.set(bDef.name.toLowerCase(), brand);
    brandMap.set(bDef.code.toLowerCase(), brand);
    if (bDef.code === 'MOLTY') {
      brandMap.set('molty', brand);
      brandMap.set('moltyfoam', brand);
    }
  }

  // 5. Create Categories
  console.log('Seeding Categories...');
  const categoryDefs = [
    // MasterCeleste categories
    { brandKey: 'masterceleste', name: 'Mattresses', code: 'MATT-MC' },
    { brandKey: 'masterceleste', name: 'Pillows', code: 'PILL-MC' },
    { brandKey: 'masterceleste', name: 'Ortho & Support', code: 'ORTH-MC' },
    { brandKey: 'masterceleste', name: 'Protectors & Pads', code: 'PROT-MC' },
    { brandKey: 'masterceleste', name: 'Prayer Mats', code: 'PRAY-MC' },
    // Molty categories
    { brandKey: 'molty', name: 'Cushions & Pads', code: 'CUSH-MOL' },
    { brandKey: 'molty', name: 'Mattresses', code: 'MATT-MOL' },
    { brandKey: 'molty', name: 'Fold-a-Bed', code: 'FOLD-MOL' },
  ];

  const categoryMap = new Map<string, any>();
  for (const cDef of categoryDefs) {
    const brand = brandMap.get(cDef.brandKey);
    if (!brand) continue;

    let cat = await Category.findOne({ brandId: brand._id, code: cDef.code });
    if (!cat) {
      cat = await Category.create({
        brandId: brand._id,
        branchId: branch._id,
        name: cDef.name,
        code: cDef.code,
        status: 'ACTIVE',
      });
    }
    categoryMap.set(`${brand._id.toString()}_${cDef.name.toLowerCase()}`, cat);
  }

  // 6. Sizes & Thicknesses Cache
  console.log('Preparing Sizes and Thicknesses...');
  const sizeMap = new Map<string, any>();
  const thicknessMap = new Map<number, any>();

  for (const row of allRows) {
    const sizeKey = `${row.length}x${row.width}_${row.displayLabel}`;
    if (!sizeMap.has(sizeKey)) {
      let sizeDoc = await Size.findOne({
        length: row.length,
        width: row.width,
        displayLabel: row.displayLabel,
      });
      if (!sizeDoc) {
        sizeDoc = await Size.create({
          length: row.length,
          width: row.width,
          unit: 'INCH',
          displayLabel: row.displayLabel,
          status: 'ACTIVE',
        });
      }
      sizeMap.set(sizeKey, sizeDoc);
    }

    if (!thicknessMap.has(row.thickness)) {
      let thickDoc = await Thickness.findOne({ value: row.thickness });
      if (!thickDoc) {
        thickDoc = await Thickness.create({
          value: row.thickness,
          unit: 'INCH',
          displayLabel: `${row.thickness}"`,
          status: 'ACTIVE',
        });
      }
      thicknessMap.set(row.thickness, thickDoc);
    }
  }

  // 7. Seed Products & Variants (204 SKUs)
  console.log('Importing Product Lines, Products, Variants, Prices and Opening Stock...');
  let importedCount = 0;
  const usedSkus = new Set<string>();
  const productLineMap = new Map<string, any>();
  const usedProductLineCodes = new Set<string>();

  for (const row of allRows) {
    const brand = brandMap.get(row.brandName.toLowerCase()) || brandMap.get('molty');
    if (!brand) {
      console.warn(`Brand not found for ${row.brandName}`);
      continue;
    }

    const catKey = `${brand._id.toString()}_${row.categoryName.toLowerCase()}`;
    let category = categoryMap.get(catKey);
    if (!category) {
      // Create on the fly if needed
      const codeCandidate = `${row.categoryName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-${brand.code}`;
      category = await Category.create({
        brandId: brand._id,
        branchId: branch._id,
        name: row.categoryName,
        code: codeCandidate,
        status: 'ACTIVE',
      });
      categoryMap.set(catKey, category);
    }

    // Find or create Product Line (Sub-Category)
    const plKey = `${brand._id.toString()}_${category._id.toString()}_${row.productLine.toLowerCase().trim()}`;
    let productLineDoc = productLineMap.get(plKey);
    if (!productLineDoc) {
      let codeCandidate = `PL-${row.productLine.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
      let code = codeCandidate;
      let counter = 1;
      while (usedProductLineCodes.has(code) || (await ProductLine.findOne({ code }))) {
        code = `${codeCandidate}-${counter++}`;
      }
      usedProductLineCodes.add(code);

      productLineDoc = await ProductLine.findOne({
        brandId: brand._id,
        categoryId: category._id,
        name: row.productLine.trim(),
      });

      if (!productLineDoc) {
        productLineDoc = await ProductLine.create({
          brandId: brand._id,
          categoryId: category._id,
          branchId: branch._id,
          name: row.productLine.trim(),
          code: code,
          status: 'ACTIVE',
        });
      }
      productLineMap.set(plKey, productLineDoc);
    }

    const sizeKey = `${row.length}x${row.width}_${row.displayLabel}`;
    const sizeDoc = sizeMap.get(sizeKey);
    const thickDoc = thicknessMap.get(row.thickness);

    // Find or create Product (linked to Brand, Main Category and Product Line!)
    let product = await Product.findOne({
      brandId: brand._id,
      categoryId: category._id,
      productLineId: productLineDoc._id,
      branchId: branch._id,
    });

    if (!product) {
      product = await Product.create({
        brandId: brand._id,
        categoryId: category._id,
        productLineId: productLineDoc._id,
        branchId: branch._id,
        name: row.productLine.trim(),
        status: 'ACTIVE',
      });
    }

    // Generate unique, readable SKU
    const brandPart = brand.code;
    const prodPart = row.productLine
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase();
    const sizePart = row.displayLabel.replace(/[\s×xX]/g, 'X').replace(/[^0-9X]/g, '').toUpperCase() || `${row.length}X${row.width}`;
    const thickPart = String(row.thickness);

    let candidateSku = `${brandPart}-${prodPart}-${sizePart}-${thickPart}`;
    let counter = 1;
    while (usedSkus.has(candidateSku) || (await Variant.findOne({ sku: candidateSku }))) {
      counter++;
      candidateSku = `${brandPart}-${prodPart}-${sizePart}-${thickPart}-${counter}`;
    }
    usedSkus.add(candidateSku);

    // Integer Paisa Pricing
    const listPaisa = Math.round(row.listPrice * 100);
    const purchasePaisa = Math.round(row.purchasePrice * 100);
    const retailPaisa = Math.round(row.retailPrice * 100);
    const wholesalePaisa = Math.round(row.wholesalePrice * 100);
    const distributorPaisa = Math.round(row.distributorPrice * 100);

    const purchasePct = listPaisa > 0 ? Math.round(((listPaisa - purchasePaisa) / listPaisa) * 100) : 15;
    const retailPct = listPaisa > 0 ? Math.round(((retailPaisa - listPaisa) / listPaisa) * 100) : 5;
    const wholesalePct = listPaisa > 0 ? Math.round(((listPaisa - wholesalePaisa) / listPaisa) * 100) : 10;
    const distributorPct = listPaisa > 0 ? Math.round(((listPaisa - distributorPaisa) / listPaisa) * 100) : 15;

    // Create Variant
    const variant = await Variant.create({
      productId: product._id,
      sizeId: sizeDoc._id,
      thicknessId: thickDoc._id,
      sku: candidateSku,
      listPrice: listPaisa,
      purchasePrice: purchasePaisa,
      purchaseDiscountPercent: purchasePct,
      retailPrice: retailPaisa,
      retailMarkupPercent: retailPct,
      wholesalePrice: wholesalePaisa,
      wholesaleDiscountPercent: wholesalePct,
      distributorPrice: distributorPaisa,
      distributorDiscountPercent: distributorPct,
      status: 'ACTIVE',
    });

    // Create Price Histories
    await PriceHistory.insertMany([
      { variantId: variant._id, sku: candidateSku, tier: 'LIST', previousPrice: 0, newPrice: listPaisa, reason: 'Excel Import' },
      { variantId: variant._id, sku: candidateSku, tier: 'PURCHASE', previousPrice: 0, newPrice: purchasePaisa, reason: 'Excel Import' },
      { variantId: variant._id, sku: candidateSku, tier: 'RETAIL', previousPrice: 0, newPrice: retailPaisa, reason: 'Excel Import' },
      { variantId: variant._id, sku: candidateSku, tier: 'WHOLESALE', previousPrice: 0, newPrice: wholesalePaisa, reason: 'Excel Import' },
      { variantId: variant._id, sku: candidateSku, tier: 'DISTRIBUTOR', previousPrice: 0, newPrice: distributorPaisa, reason: 'Excel Import' },
    ]);

    // Create Stock Balance
    await StockBalance.create({
      branchId: branch._id,
      stockLocationId: floorLocation._id,
      sku: candidateSku,
      variantId: variant._id,
      onHand: row.currentStock,
      reserved: 0,
      reorderLevel: row.minStock,
    });

    // Create Initial Stock Movement
    if (row.currentStock > 0) {
      await StockMovement.create({
        movementNumber: `MOV-INIT-${candidateSku}-${Date.now().toString().slice(-6)}`,
        branchId: branch._id,
        stockLocationId: floorLocation._id,
        sku: candidateSku,
        movementType: 'OPENING_BALANCE',
        quantityDifference: row.currentStock,
        previousBalance: 0,
        newBalance: row.currentStock,
        referenceType: 'OPENING_BALANCE',
        reason: 'Excel Initial Opening Stock Import',
        performedBy: 'System',
        timestamp: new Date(),
      });
    }

    importedCount++;
  }

  console.log(`\n=== IMPORT COMPLETE: Successfully imported ${importedCount} SKUs into MongoDB! ===`);
  const finalProductLineCount = await ProductLine.countDocuments();
  const finalProductCount = await Product.countDocuments();
  const finalVariantCount = await Variant.countDocuments();
  const finalStockCount = await StockBalance.countDocuments();
  const totalUnits = (await StockBalance.find({})).reduce((sum, b) => sum + (b.onHand || 0), 0);

  console.log(`Total Product Lines (Sub-Categories): ${finalProductLineCount}`);
  console.log(`Total Products: ${finalProductCount}`);
  console.log(`Total Variants (SKUs): ${finalVariantCount}`);
  console.log(`Total Stock Balance Records: ${finalStockCount}`);
  console.log(`Total Physical Mattress / Item Units in Stock: ${totalUnits}`);

  await disconnectDatabase();
}

seedExcelCatalogue().catch((err) => {
  console.error('CRITICAL SEED ERROR:', err);
  process.exit(1);
});
