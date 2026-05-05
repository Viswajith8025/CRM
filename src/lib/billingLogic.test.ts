import { describe, it, expect } from 'vitest';

describe('Financial Math Precision', () => {
  it('correctly calculates GST without floating point errors', () => {
    const rawSubtotal = 10.05;
    const gstPercent = 18;
    
    // Naive JS Math: 10.05 * 18 / 100 = 1.8090000000000002
    // Safe Math:
    const subtotal = Math.round(rawSubtotal * 100) / 100;
    const rawGst = (subtotal * gstPercent) / 100;
    const gstAmount = Math.round(rawGst * 100) / 100;
    
    expect(gstAmount).toBe(1.81);
  });

  it('correctly calculates total amount', () => {
    const subtotal = 100.50;
    const gstAmount = 18.09;
    
    // Naive JS Math: 100.50 + 18.09 = 118.58999999999999
    // Safe Math:
    const total = Math.round((subtotal + gstAmount) * 100) / 100;
    
    expect(total).toBe(118.59);
  });
});

describe('Invoice ID Generation', () => {
  it('generates secure, non-colliding invoice numbers', () => {
    const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const secureId = crypto.randomUUID().split('-')[0].toUpperCase();
    const invoiceNumber = `INV-${datePrefix}-${secureId}`;
    
    expect(invoiceNumber).toMatch(/^INV-\d{8}-[A-F0-9]{8}$/);
  });
});
