import { Request, Response, NextFunction } from 'express';
import {
  generateProfitAndLossReport,
  generateBalanceSheetReport,
} from '../services/reportService.js';
import {
  generateProfitAndLossPDF,
  generateBalanceSheetPDF,
} from '../services/pdfService.js';
import { cache } from '../utils/cache.js';

export const getProfitAndLoss = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = (req.query.year as string) || new Date().getFullYear().toString();
    const cacheKey = `reports:pnl:${year}`;

    const cached = cache.get<any>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const data = await generateProfitAndLossReport(year);
    cache.set(cacheKey, data, 60);

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getBalanceSheet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = (req.query.year as string) || new Date().getFullYear().toString();
    const cacheKey = `reports:balance_sheet:${year}`;

    const cached = cache.get<any>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const data = await generateBalanceSheetReport(year);
    cache.set(cacheKey, data, 60);

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getProfitAndLossPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = (req.query.year as string) || new Date().getFullYear().toString();
    const data = await generateProfitAndLossReport(year);
    const pdfBuffer = await generateProfitAndLossPDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Profit_Loss_${year}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const getBalanceSheetPDF = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const year = (req.query.year as string) || new Date().getFullYear().toString();
    const data = await generateBalanceSheetReport(year);
    const pdfBuffer = await generateBalanceSheetPDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Balance_Sheet_${year}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
