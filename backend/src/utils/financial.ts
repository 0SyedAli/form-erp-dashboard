/**
 * Molty Foam ERP — Decimal-Safe Financial Utilities & Pricing Engine
 *
 * Floating-point representation in JavaScript (IEEE 754) introduces rounding inaccuracies:
 * e.g., 0.1 + 0.2 === 0.30000000000000004.
 *
 * To ensure 100% financial audit integrity, all monetary calculations inside the
 * backend are computed using safe integer arithmetic (Paisa: 1 PKR = 100 Paisa),
 * and rounded explicitly before persistence and invoice ledger entry posting.
 */

export const PAISA_FACTOR = 100;

/**
 * Converts a Pakistani Rupee amount into Integer Paisa.
 */
export function toPaisa(rupees: number): number {
  if (typeof rupees !== 'number' || isNaN(rupees) || !isFinite(rupees)) return 0;
  return Math.round(rupees * PAISA_FACTOR);
}

/**
 * Converts Integer Paisa back to exact Pakistani Rupees.
 */
export function toRupees(paisa: number): number {
  if (typeof paisa !== 'number' || isNaN(paisa) || !isFinite(paisa)) return 0;
  return Math.round(paisa) / PAISA_FACTOR;
}

/**
 * Rounds any Rupee currency amount to 2 decimal places cleanly.
 */
export function roundCurrency(rupees: number): number {
  return toRupees(toPaisa(rupees));
}

/**
 * Pricing Engine Calculations (Integer Paisa Standard)
 */

export function calculatePurchasePrice(listPricePaisa: number, discountPercent: number): number {
  if (listPricePaisa <= 0) return 0;
  const pct = Math.max(0, Math.min(100, discountPercent));
  return Math.round(listPricePaisa * (1 - pct / 100));
}

export function calculateRetailPrice(listPricePaisa: number, markupPercent: number): number {
  if (listPricePaisa <= 0) return 0;
  const pct = Math.max(0, markupPercent);
  return Math.round(listPricePaisa * (1 + pct / 100));
}

export function calculateWholesalePrice(listPricePaisa: number, discountPercent: number): number {
  if (listPricePaisa <= 0) return 0;
  const pct = Math.max(0, Math.min(100, discountPercent));
  return Math.round(listPricePaisa * (1 - pct / 100));
}

export function calculateDistributorPrice(listPricePaisa: number, discountPercent: number): number {
  if (listPricePaisa <= 0) return 0;
  const pct = Math.max(0, Math.min(100, discountPercent));
  return Math.round(listPricePaisa * (1 - pct / 100));
}

export function calculateDiscountPercent(listPricePaisa: number, pricePaisa: number): number {
  if (listPricePaisa <= 0 || pricePaisa >= listPricePaisa) return 0;
  const rawPct = ((listPricePaisa - pricePaisa) / listPricePaisa) * 100;
  return Math.round(rawPct * 100) / 100;
}

export function calculateMarkupPercent(listPricePaisa: number, pricePaisa: number): number {
  if (listPricePaisa <= 0 || pricePaisa <= listPricePaisa) return 0;
  const rawPct = ((pricePaisa - listPricePaisa) / listPricePaisa) * 100;
  return Math.round(rawPct * 100) / 100;
}

/**
 * Validates that a user-submitted price matches its submitted percentage within rounding tolerance.
 * Tolerance is 100 Paisa (1 PKR) or 1%.
 */
export function validatePriceReconciliation(
  listPricePaisa: number,
  submittedPricePaisa: number,
  submittedPercent: number,
  type: 'PURCHASE' | 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR'
): boolean {
  if (listPricePaisa <= 0) return true;

  let expectedPaisa = 0;
  if (type === 'PURCHASE') {
    expectedPaisa = calculatePurchasePrice(listPricePaisa, submittedPercent);
  } else if (type === 'RETAIL') {
    expectedPaisa = calculateRetailPrice(listPricePaisa, submittedPercent);
  } else if (type === 'WHOLESALE') {
    expectedPaisa = calculateWholesalePrice(listPricePaisa, submittedPercent);
  } else if (type === 'DISTRIBUTOR') {
    expectedPaisa = calculateDistributorPrice(listPricePaisa, submittedPercent);
  }

  const diff = Math.abs(expectedPaisa - submittedPricePaisa);
  // Allow up to 100 Paisa (1 PKR) rounding difference
  return diff <= 100;
}

/**
 * Calculates line total safely: Quantity * Unit Price
 */
export function calculateLineTotal(quantity: number, unitPriceRupees: number): number {
  const q = Math.max(0, Math.round(quantity));
  const pricePaisa = toPaisa(unitPriceRupees);
  const totalPaisa = q * pricePaisa;
  return toRupees(totalPaisa);
}

export interface InvoiceCalculatedTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
}

/**
 * Computes subtotal, total, and balance due with integer-safe arithmetic.
 */
export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountRupees = 0,
  taxRupees = 0,
  paidRupees = 0
): InvoiceCalculatedTotals {
  let subtotalPaisa = 0;

  for (const item of items) {
    const q = Math.max(0, Math.round(item.quantity));
    const pPaisa = toPaisa(item.unitPrice);
    subtotalPaisa += q * pPaisa;
  }

  const discountPaisa = Math.max(0, toPaisa(discountRupees));
  const taxPaisa = Math.max(0, toPaisa(taxRupees));
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa + taxPaisa);
  const paidPaisa = Math.max(0, toPaisa(paidRupees));
  const balanceDuePaisa = Math.max(0, totalPaisa - paidPaisa);

  return {
    subtotal: toRupees(subtotalPaisa),
    discount: toRupees(discountPaisa),
    tax: toRupees(taxPaisa),
    total: toRupees(totalPaisa),
    paidAmount: toRupees(paidPaisa),
    balanceDue: toRupees(balanceDuePaisa),
  };
}
