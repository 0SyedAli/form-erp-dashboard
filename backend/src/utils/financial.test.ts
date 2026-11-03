import { describe, it, expect } from 'vitest';
import {
  toPaisa,
  toRupees,
  calculateLineTotal,
  calculateInvoiceTotals,
  roundCurrency,
} from './financial.js';

describe('Financial Utilities & Integer Paisa Arithmetic', () => {
  it('converts Pakistani Rupees to Paisa accurately without floating point drift', () => {
    expect(toPaisa(18000)).toBe(1800000);
    expect(toPaisa(18360.5)).toBe(1836050);
    expect(toPaisa(0.1 + 0.2)).toBe(30); // 0.1 + 0.2 in JS is 0.30000000000000004
  });

  it('converts Paisa back to exact Rupees', () => {
    expect(toRupees(1800000)).toBe(18000);
    expect(toRupees(1836050)).toBe(18360.5);
    expect(toRupees(30)).toBe(0.3);
  });

  it('rounds currency to 2 decimal places cleanly', () => {
    expect(roundCurrency(15300.33333)).toBe(15300.33);
    expect(roundCurrency(15300.66666)).toBe(15300.67);
  });

  it('calculates line total safely (quantity * unit price)', () => {
    expect(calculateLineTotal(3, 18360)).toBe(55080);
    expect(calculateLineTotal(5, 16200)).toBe(81000);
    expect(calculateLineTotal(0, 18360)).toBe(0);
  });

  it('computes full invoice totals (subtotal, discount, tax, balance due)', () => {
    const items = [
      { quantity: 2, unitPrice: 18360 }, // 36720
      { quantity: 1, unitPrice: 20400 }, // 20400
    ];
    // Subtotal = 57120
    const discount = 1120;
    const tax = 0;
    const paidAmount = 30000;

    const totals = calculateInvoiceTotals(items, discount, tax, paidAmount);

    expect(totals.subtotal).toBe(57120);
    expect(totals.discount).toBe(1120);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(56000);
    expect(totals.paidAmount).toBe(30000);
    expect(totals.balanceDue).toBe(26000);
  });
});

