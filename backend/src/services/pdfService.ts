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
