import { JournalEntry, IJournalEntry } from '../models/JournalEntry.js';
import { JournalEntryStatus, JournalEntryLine } from '../types/index.js';
import { getNextJournalEntryNumber } from './sequenceService.js';
import { cache } from '../utils/cache.js';

export const validateJournalEntryBalance = (
  lines: JournalEntryLine[]
): { isBalanced: boolean; totalDebit: number; totalCredit: number; error?: string } => {
  if (!lines || lines.length === 0) {
    return {
      isBalanced: false,
      totalDebit: 0,
      totalCredit: 0,
      error: 'Journal entry must have at least one line item.',
    };
  }

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  // Round to 2 decimals to avoid floating point precision issues
  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;

  if (roundedDebit <= 0) {
    return {
      isBalanced: false,
      totalDebit: roundedDebit,
      totalCredit: roundedCredit,
      error: 'Journal entry total amount must be greater than 0.',
    };
  }

  if (roundedDebit !== roundedCredit) {
    return {
      isBalanced: false,
      totalDebit: roundedDebit,
      totalCredit: roundedCredit,
      error: `Journal entry is not balanced. Total Debit (Rs. ${roundedDebit.toFixed(
        2
      )}) must equal Total Credit (Rs. ${roundedCredit.toFixed(2)}).`,
    };
  }

  return {
    isBalanced: true,
    totalDebit: roundedDebit,
    totalCredit: roundedCredit,
  };
};

export interface CreateJournalEntryInput {
  date: string;
  number?: string;
  journalId: string;
  partnerId?: string;
  status?: JournalEntryStatus;
  lines: JournalEntryLine[];
  sourceDocument?: {
    model: 'VendorBill' | 'CustomerInvoice';
    id: string;
  };
}

export const createJournalEntry = async (
  input: CreateJournalEntryInput
): Promise<IJournalEntry> => {
  const status = input.status || JournalEntryStatus.Draft;

  // -------------------------------------------------------
  // DUPLICATE PREVENTION: If a journal entry already exists
  // for this source transaction, return the existing one.
  // This handles double-submits, page refreshes, retries.
  // -------------------------------------------------------
  if (input.sourceDocument?.model && input.sourceDocument?.id) {
    const existing = await JournalEntry.findOne({
      'sourceDocument.model': input.sourceDocument.model,
      'sourceDocument.id': input.sourceDocument.id,
    });
    if (existing) {
      console.log(
        `[JournalEntryService] Duplicate prevented: entry already exists for ${input.sourceDocument.model}/${input.sourceDocument.id} → ${existing.number}`
      );
      return existing;
    }
  }

  const balanceCheck = validateJournalEntryBalance(input.lines);

  if (status === JournalEntryStatus.Posted && !balanceCheck.isBalanced) {
    throw new Error(balanceCheck.error || 'Cannot post unbalanced journal entry.');
  }

  let number = input.number;
  if (!number || number.trim() === '') {
    number = await getNextJournalEntryNumber();
  }

  const entry = await JournalEntry.create({
    date: input.date,
    number,
    journalId: input.journalId,
    partnerId: input.partnerId,
    status,
    lines: input.lines,
    total: balanceCheck.totalDebit,
    sourceDocument: input.sourceDocument,
  });

  // Invalidate ledger and reports cache
  cache.invalidate('journal_entries:');
  cache.invalidate('reports:');
  cache.invalidate('dashboard:');

  return entry;
};
