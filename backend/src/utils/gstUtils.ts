/**
 * Backend GST (Goods and Services Tax) Helper for UrbanFin ERP
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

export function formatGSTINR(amount: number, prefix = 'Rs. '): string {
  const num = Math.round((Number(amount) || 0) * 100) / 100;
  return `${prefix}${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
