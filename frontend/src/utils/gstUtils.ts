/**
 * Universal GST (Goods and Services Tax) Calculation Engine for UrbanFin ERP
 * Standard Indian GST: 18% (CGST 9% + SGST 9%) for Furniture, Assets & Goods.
 * Automatically computes subtotal, tax breakdown, and total with GST across all modules in logic without database schema mutations.
 */

export const DEFAULT_GST_RATE = 0.18; // 18% Total GST
export const DEFAULT_CGST_RATE = 0.09; // 9% Central GST
export const DEFAULT_SGST_RATE = 0.09; // 9% State GST

export interface GSTBreakdown {
  subtotal: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  totalWithGst: number;
  gstRatePercent: number;
  cgstRatePercent: number;
  sgstRatePercent: number;
}

/**
 * Calculates GST breakdown for a given untaxed subtotal.
 */
export function calculateGST(subtotal: number, gstRate = DEFAULT_GST_RATE): GSTBreakdown {
  const cleanSubtotal = Math.max(0, Number(subtotal) || 0);
  const halfRate = gstRate / 2;
  
  const cgst = Math.round(cleanSubtotal * halfRate * 100) / 100;
  const sgst = Math.round(cleanSubtotal * halfRate * 100) / 100;
  const totalGst = Math.round((cgst + sgst) * 100) / 100;
  const totalWithGst = Math.round((cleanSubtotal + totalGst) * 100) / 100;

  return {
    subtotal: cleanSubtotal,
    cgst,
    sgst,
    totalGst,
    totalWithGst,
    gstRatePercent: Math.round(gstRate * 100),
    cgstRatePercent: Math.round(halfRate * 100),
    sgstRatePercent: Math.round(halfRate * 100),
  };
}

/**
 * Formats a number to Indian currency format with currency prefix.
 */
export function formatGSTINR(amount: number, prefix = '₹'): string {
  const num = Math.round((Number(amount) || 0) * 100) / 100;
  return `${prefix}${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Returns standard HSN code for asset/furniture categories.
 */
export function getHSNCode(nameOrCategory?: string): string {
  const text = (nameOrCategory || '').toLowerCase();
  if (text.includes('chair') || text.includes('seating') || text.includes('sofa')) {
    return 'HSN 9401';
  }
  if (text.includes('service') || text.includes('consulting') || text.includes('maintenance')) {
    return 'SAC 9983';
  }
  if (text.includes('wood') || text.includes('timber') || text.includes('plank')) {
    return 'HSN 4418';
  }
  return 'HSN 9403'; // Other furniture and parts
}
