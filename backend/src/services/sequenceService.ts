import { SequenceCounter } from '../models/SequenceCounter.js';

export const getNextSequence = async (
  key: string,
  prefix: string,
  padLength: number = 4,
  year?: number
): Promise<string> => {
  const currentYear = year || new Date().getFullYear();
  const counterKey = year !== undefined ? `${key}_${currentYear}` : key;

  const counter = await SequenceCounter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const numStr = String(counter.seq).padStart(padLength, '0');

  if (year !== undefined) {
    return `${prefix}/${currentYear}/${numStr}`;
  }

  return `${prefix}${numStr}`;
};

export const getNextPONumber = async (): Promise<string> => {
  return getNextSequence('PO', 'P', 5);
};

export const getNextSONumber = async (): Promise<string> => {
  return getNextSequence('SO', 'S', 5);
};

export const getNextBillNumber = async (): Promise<string> => {
  return getNextSequence('BILL', 'Bill', 4, new Date().getFullYear());
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  return getNextSequence('INV', 'INV', 4, new Date().getFullYear());
};

export const getNextJournalEntryNumber = async (): Promise<string> => {
  return getNextSequence('JRNL', 'JRNL', 4, new Date().getFullYear());
};
