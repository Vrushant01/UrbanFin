import PDFDocument from 'pdfkit';
import { ProfitAndLossData, BalanceSheetData } from './reportService.js';
import { Readable } from 'stream';

export const generateProfitAndLossPDF = async (data: ProfitAndLossData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('Urban Furniture Accounting', { align: 'center' });
    doc.fontSize(14).text('Profit & Loss Statement', { align: 'center' });
    doc.fontSize(10).text(`For the Year Ended ${data.year}`, { align: 'center' });
    doc.moveDown(2);

    // Income
    doc.fontSize(12).fillColor('#1e3a8a').text('INCOME', { underline: true });
    doc.moveDown(0.5);
    data.incomeAccounts.forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(acc.name, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#1e3a8a').text('Total Income', 50, doc.y, { continued: true });
    doc.text(`Rs. ${data.totalIncome.toFixed(2)}`, { align: 'right' });
    doc.moveDown(1.5);

    // Expenses
    doc.fontSize(12).fillColor('#9f1239').text('EXPENSES', { underline: true });
    doc.moveDown(0.5);
    data.purchaseExpenseAccounts.forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(acc.name, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    data.otherExpenseAccounts.forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(acc.name, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#9f1239').text('Total Expenses', 50, doc.y, { continued: true });
    doc.text(`Rs. ${data.totalExpenses.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);

    // Net Income
    const isNetPositive = data.netIncome >= 0;
    doc
      .fontSize(14)
      .fillColor(isNetPositive ? '#065f46' : '#991b1b')
      .text('NET INCOME', 50, doc.y, { continued: true });
    doc.text(`Rs. ${data.netIncome.toFixed(2)}`, { align: 'right' });

    doc.end();
  });
};

export const generateBalanceSheetPDF = async (data: BalanceSheetData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('Urban Furniture Accounting', { align: 'center' });
    doc.fontSize(14).text('Balance Sheet Statement', { align: 'center' });
    doc.fontSize(10).text(`As of December 31, ${data.year}`, { align: 'center' });
    doc.moveDown(2);

    // Assets
    doc.fontSize(12).fillColor('#1e3a8a').text('ASSETS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555').text('Bank & Cash Accounts:');
    [...data.bankAccounts, ...data.cashAccounts].forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(`  ${acc.name}`, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    doc.fontSize(10).fillColor('#555555').text('Other Current Assets:');
    data.otherAssetAccounts.forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(`  ${acc.name}`, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#1e3a8a').text('Total Assets', 50, doc.y, { continued: true });
    doc.text(`Rs. ${data.totalAssets.toFixed(2)}`, { align: 'right' });
    doc.moveDown(1.5);

    // Liabilities & Equity
    doc.fontSize(12).fillColor('#9f1239').text('LIABILITIES & EQUITY', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555').text('Capital & Equity:');
    data.capitalAccounts.forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(`  ${acc.name}`, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    doc.fontSize(10).fillColor('#065f46').text('  Current Year Earnings', 50, doc.y, { continued: true });
    doc.text(`Rs. ${data.netIncome.toFixed(2)}`, { align: 'right' });

    doc.fontSize(10).fillColor('#555555').text('Liabilities (Creditors):');
    data.liabilityAccounts.forEach((acc) => {
      doc.fontSize(10).fillColor('#333333').text(`  ${acc.name}`, 50, doc.y, { continued: true });
      doc.text(`Rs. ${acc.balance.toFixed(2)}`, { align: 'right' });
    });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#9f1239').text('Total Liabilities & Equity', 50, doc.y, { continued: true });
    doc.text(`Rs. ${data.totalLiabilitiesAndEquity.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);

    // Balance check
    doc
      .fontSize(12)
      .fillColor(data.isBalanced ? '#065f46' : '#991b1b')
      .text(`Status: ${data.isBalanced ? 'Balanced ✓' : 'Out of Balance ✗'}`, { align: 'center' });

    doc.end();
  });
};

export interface InvoicePDFData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  lines: Array<{
    description: string;
    hsnCode?: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;
  status: string;
}

export const generateInvoicePDF = async (data: InvoicePDFData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(22).fillColor('#1e3a8a').text('URBAN FURNITURE', 50, 50);
    doc.fontSize(9).fillColor('#64748b').text('GSTIN: 24AAACU8081F1ZU | PAN: AAACU8081F', 50, 75);
    doc.text('Tax Invoice / Bill of Supply', 50, 88);

    doc.fontSize(14).fillColor('#0f172a').text(`INVOICE #${data.invoiceNumber}`, 350, 50, { align: 'right' });
    doc.fontSize(9).fillColor('#64748b').text(`Date: ${data.invoiceDate}`, 350, 70, { align: 'right' });
    doc.text(`Due: ${data.dueDate}`, 350, 82, { align: 'right' });
    doc.text(`Status: ${data.status.toUpperCase()}`, 350, 94, { align: 'right' });

    doc.moveTo(50, 115).lineTo(550, 115).strokeColor('#e2e8f0').stroke();

    // Bill To
    doc.fontSize(10).fillColor('#334155').text('Billed To:', 50, 130);
    doc.fontSize(12).fillColor('#0f172a').text(data.customerName, 50, 145);
    doc.fontSize(9).fillColor('#64748b').text('Place of Supply: Gujarat (24)', 50, 160);

    // Table Header
    let y = 190;
    doc.rect(50, y, 500, 24).fill('#f8fafc');
    doc.fontSize(9).fillColor('#334155');
    doc.text('ITEM DESCRIPTION', 60, y + 7);
    doc.text('HSN/SAC', 240, y + 7);
    doc.text('QTY', 320, y + 7, { align: 'right', width: 30 });
    doc.text('RATE', 370, y + 7, { align: 'right', width: 60 });
    doc.text('AMOUNT', 450, y + 7, { align: 'right', width: 90 });

    y += 28;
    data.lines.forEach((l) => {
      doc.fontSize(9).fillColor('#1e293b');
      doc.text(l.description, 60, y);
      doc.fillColor('#64748b').text(l.hsnCode || 'HSN 9403', 240, y);
      doc.fillColor('#1e293b').text(String(l.qty), 320, y, { align: 'right', width: 30 });
      doc.text(`Rs. ${l.unitPrice.toFixed(2)}`, 370, y, { align: 'right', width: 60 });
      doc.text(`Rs. ${l.total.toFixed(2)}`, 450, y, { align: 'right', width: 90 });
      y += 20;
    });

    // GST Breakdown Box
    y = Math.max(y + 10, 360);
    doc.moveTo(50, y).lineTo(550, y).strokeColor('#e2e8f0').stroke();
    y += 15;

    const rightX = 350;
    const valWidth = 190;

    doc.fontSize(9).fillColor('#475569');
    doc.text('Untaxed Subtotal:', rightX, y);
    doc.text(`Rs. ${data.subtotal.toFixed(2)}`, rightX, y, { align: 'right', width: valWidth });
    y += 16;

    doc.text('Central GST (CGST 9%):', rightX, y);
    doc.text(`+ Rs. ${data.cgst.toFixed(2)}`, rightX, y, { align: 'right', width: valWidth });
    y += 16;

    doc.text('State GST (SGST 9%):', rightX, y);
    doc.text(`+ Rs. ${data.sgst.toFixed(2)}`, rightX, y, { align: 'right', width: valWidth });
    y += 18;

    doc.moveTo(rightX, y).lineTo(550, y).strokeColor('#cbd5e1').stroke();
    y += 6;

    doc.fontSize(11).fillColor('#0f172a').text('Total (Incl. 18% GST):', rightX, y);
    doc.text(`Rs. ${data.grandTotal.toFixed(2)}`, rightX, y, { align: 'right', width: valWidth });
    y += 20;

    if (data.amountPaid > 0) {
      doc.fontSize(9).fillColor('#059669').text('Amount Paid:', rightX, y);
      doc.text(`- Rs. ${data.amountPaid.toFixed(2)}`, rightX, y, { align: 'right', width: valWidth });
      y += 16;
    }

    doc.fontSize(12).fillColor('#1e3a8a').text('Balance Due:', rightX, y);
    doc.text(`Rs. ${data.amountDue.toFixed(2)}`, rightX, y, { align: 'right', width: valWidth });

    // Footer
    doc.fontSize(8).fillColor('#94a3b8').text(
      'This is a computer generated tax invoice issued under the Goods and Services Tax Act. Thank you for your business.',
      50,
      720,
      { align: 'center', width: 500 }
    );

    doc.end();
  });
};
