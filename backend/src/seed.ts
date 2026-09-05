import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Contact } from './models/Contact.js';
import { Category } from './models/Category.js';
import { Product } from './models/Product.js';
import { Account } from './models/Account.js';
import { Journal } from './models/Journal.js';
import { JournalEntry } from './models/JournalEntry.js';
import { AnalyticAccount } from './models/AnalyticAccount.js';
import { Budget } from './models/Budget.js';
import { CustomerInvoice } from './models/CustomerInvoice.js';
import { PaymentTerm } from './models/PaymentTerm.js';
import { PurchaseOrder } from './models/PurchaseOrder.js';
import { VendorBill } from './models/VendorBill.js';
import { SalesOrder } from './models/SalesOrder.js';
import { Payment } from './models/Payment.js';
import { SequenceCounter } from './models/SequenceCounter.js';
import {
  Role,
  ContactType,
  ProductType,
  AccountType,
  JournalType,
  JournalEntryStatus,
  AnalyticAccountType,
  BudgetStatus,
  CustomerInvoiceStatus,
} from './types/index.js';

dotenv.config();

export const seedDatabase = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('[Seed] Connected to MongoDB. Starting database seeding...');

    // 1. Clear existing collections
    await User.deleteMany({});
    await Contact.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Account.deleteMany({});
    await Journal.deleteMany({});
    await JournalEntry.deleteMany({});
    await AnalyticAccount.deleteMany({});
    await Budget.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await VendorBill.deleteMany({});
    await SalesOrder.deleteMany({});
    await CustomerInvoice.deleteMany({});
    await Payment.deleteMany({});
    await PaymentTerm.deleteMany({});
    await SequenceCounter.deleteMany({});
    console.log('[Seed] Cleared existing collections.');

    // 2. Seed Categories
    const catElectronics = await Category.create({ name: 'Electronics' });
    const catFurniture = await Category.create({ name: 'Furniture' });
    console.log(`[Seed] Seeded Categories: ${catElectronics.name}, ${catFurniture.name}`);

    // 3. Seed Chart of Accounts
    const accCash = await Account.create({ name: 'Cash A/c', type: AccountType.Cash });
    const accBank = await Account.create({ name: 'Bank A/c', type: AccountType.Bank });
    const accDebtors = await Account.create({ name: 'Debtors A/c', type: AccountType.Asset });
    const accCreditors = await Account.create({ name: 'Creditors A/c', type: AccountType.Liability });
    const accCapital = await Account.create({ name: 'Capital A/c', type: AccountType.Capital });
    const accSales = await Account.create({ name: 'Sales Income A/c', type: AccountType.Income });
    const accPurchase = await Account.create({ name: 'Purchase Expense A/c', type: AccountType.Expenses });
    const accOtherExp = await Account.create({ name: 'Other Expense A/c', type: AccountType.OtherExpenses });
    console.log('[Seed] Seeded 8 Core Accounts in Chart of Accounts.');

    // 4. Seed Journals
    const jSales = await Journal.create({
      name: 'Sales',
      type: JournalType.Sales,
      defaultAccountId: accSales._id.toString(),
    });
    const jPurchase = await Journal.create({
      name: 'Purchase',
      type: JournalType.Purchase,
      defaultAccountId: accPurchase._id.toString(),
    });
    const jBank = await Journal.create({
      name: 'Bank',
      type: JournalType.Bank,
      defaultAccountId: accBank._id.toString(),
    });
    const jCash = await Journal.create({
      name: 'Cash',
      type: JournalType.Cash,
      defaultAccountId: accCash._id.toString(),
    });
    console.log('[Seed] Seeded 4 Core Journals.');

    // 5. Seed Contacts
    const contactRahul = await Contact.create({
      name: 'Mr. Rahul',
      type: ContactType.Vendor,
      email: 'rahul@example.com',
      phone: '123-456-7890',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        country: 'USA',
        pincode: '12345',
      },
      hasPortalAccess: false,
    });

    const contactRaj = await Contact.create({
      name: 'Mr. Raj',
      type: ContactType.Customer,
      email: 'raj@example.com',
      phone: '987-654-3210',
      address: {
        street: '456 Market St',
        city: 'Business City',
        state: 'CA',
        country: 'USA',
        pincode: '98765',
      },
      hasPortalAccess: true,
    });
    console.log(`[Seed] Seeded Contacts: ${contactRahul.name}, ${contactRaj.name}`);

    // 6. Seed Products
    const productAC = await Product.create({
      name: 'Air Conditioner',
      type: ProductType.Goods,
      categoryId: catElectronics._id.toString(),
      salesPrice: 25000,
      cost: 15000,
    });

    const productFridge = await Product.create({
      name: 'Refrigerator',
      type: ProductType.Goods,
      categoryId: catElectronics._id.toString(),
      salesPrice: 10000,
      cost: 7000,
    });
    console.log(`[Seed] Seeded Products: ${productAC.name}, ${productFridge.name}`);

    // 7. Seed Users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password@123', salt);

    const adminUser = await User.create({
      name: 'Admin User',
      loginId: 'admin123',
      email: 'admin@urban.com',
      role: Role.Administrator,
      passwordHash,
    });

    const accountantUser = await User.create({
      name: 'Accountant User',
      loginId: 'account123',
      email: 'accountant@urban.com',
      role: Role.Accountant,
      passwordHash,
    });

    const portalCustomerUser = await User.create({
      name: 'Customer John',
      loginId: 'johnuser',
      email: 'john@example.com',
      role: Role.User,
      passwordHash,
      contactId: contactRaj._id.toString(),
    });
    console.log('[Seed] Seeded 3 Core Users.');

    // 8. Seed Analytic Accounts
    const anaFurniture = await AnalyticAccount.create({
      name: 'Furniture',
      type: AnalyticAccountType.Expenses,
    });
    const anaSoftware = await AnalyticAccount.create({
      name: 'Software Sales',
      type: AnalyticAccountType.Income,
    });
    console.log('[Seed] Seeded 2 Analytic Accounts.');

    // 9. Seed Budget
    const defaultBudget = await Budget.create({
      name: 'January 2026',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      responsibleId: adminUser._id.toString(),
      status: BudgetStatus.Confirmed,
      lines: [
        {
          id: Math.random().toString(36).substr(2, 9),
          analyticAccountId: anaFurniture._id.toString(),
          type: AnalyticAccountType.Expenses,
          committedAmount: 200000,
          achievedAmount: 0,
        },
      ],
    });
    console.log(`[Seed] Seeded Budget: ${defaultBudget.name}`);

    // 10. Seed Initial Journal Entries (Double Entry Balance)
    // Capital Investment
    await JournalEntry.create({
      date: '2026-01-01',
      number: `JRNL/${new Date().getFullYear()}/0001`,
      journalId: jBank._id.toString(),
      status: JournalEntryStatus.Posted,
      total: 100000,
      lines: [
        { accountId: accBank._id.toString(), debit: 100000, credit: 0 },
        { accountId: accCapital._id.toString(), debit: 0, credit: 100000 },
      ],
    });

    // Seed Initial Bill JE
    await JournalEntry.create({
      date: '2026-09-01',
      number: `JRNL/${new Date().getFullYear()}/0002`,
      journalId: jPurchase._id.toString(),
      partnerId: contactRahul._id.toString(),
      status: JournalEntryStatus.Posted,
      total: 30000,
      lines: [
        { accountId: accPurchase._id.toString(), partnerId: contactRahul._id.toString(), debit: 30000, credit: 0 },
        { accountId: accCreditors._id.toString(), partnerId: contactRahul._id.toString(), debit: 0, credit: 30000 },
      ],
    });

    // Seed Initial Invoice JE
    await JournalEntry.create({
      date: '2026-09-02',
      number: `JRNL/${new Date().getFullYear()}/0003`,
      journalId: jSales._id.toString(),
      partnerId: contactRaj._id.toString(),
      status: JournalEntryStatus.Posted,
      total: 10500,
      lines: [
        { accountId: accDebtors._id.toString(), partnerId: contactRaj._id.toString(), debit: 10500, credit: 0 },
        { accountId: accSales._id.toString(), partnerId: contactRaj._id.toString(), debit: 0, credit: 10500 },
      ],
    });
    console.log('[Seed] Seeded 3 Balanced Initial Journal Entries.');

    // 11. Seed Invoices for Customer Portal
    await CustomerInvoice.create({
      number: 'INV/2026/1213',
      customerId: contactRaj._id.toString(),
      invoiceReference: '',
      invoiceDate: '2026-08-11',
      dueDate: '2026-08-11',
      status: CustomerInvoiceStatus.Paid,
      amountPaid: 100000,
      cashPaid: 0,
      bankPaid: 100000,
      lines: [
        {
          id: Math.random().toString(36).substr(2, 9),
          productId: productAC._id.toString(),
          accountId: accSales._id.toString(),
          qty: 4,
          unitPrice: 25000,
        },
      ],
    });

    await CustomerInvoice.create({
      number: 'INV/2026/1820',
      customerId: contactRaj._id.toString(),
      invoiceReference: '',
      invoiceDate: '2026-08-25',
      dueDate: '2026-08-25',
      status: CustomerInvoiceStatus.Confirmed,
      amountPaid: 0,
      cashPaid: 0,
      bankPaid: 0,
      lines: [
        {
          id: Math.random().toString(36).substr(2, 9),
          productId: productAC._id.toString(),
          accountId: accSales._id.toString(),
          qty: 1,
          unitPrice: 25000,
        },
      ],
    });
    console.log('[Seed] Seeded 2 Customer Invoices.');

    // 12. Seed Payment Terms
    const defaultTerms = ['Immediate Payment', '15 Days', '30 Days', '45 Days'];
    for (const term of defaultTerms) {
      await PaymentTerm.create({ name: term });
    }
    console.log('[Seed] Seeded Payment Terms.');

    // 13. Initialize Sequence Counters
    const currentYear = new Date().getFullYear();
    await SequenceCounter.create({ key: `JRNL_${currentYear}`, seq: 3 });
    await SequenceCounter.create({ key: `INV_${currentYear}`, seq: 1820 });
    await SequenceCounter.create({ key: `BILL_${currentYear}`, seq: 0 });
    await SequenceCounter.create({ key: 'PO', seq: 0 });
    await SequenceCounter.create({ key: 'SO', seq: 0 });
    console.log('[Seed] Seeded Sequence Counters.');

    console.log('[Seed] Full database seeding completed successfully!');
  } catch (error) {
    console.error('[Seed] Database seeding failed:', error);
    throw error;
  }
};

export const ensureSeeded = async (): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Seed] Database is empty. Running full initial seed...');
      await seedDatabase();
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('Password@123', salt);

      const admin = await User.findOne({ loginId: 'admin123' });
      if (!admin) {
        await User.create({
          name: 'Admin User',
          loginId: 'admin123',
          email: 'admin@urban.com',
          role: Role.Administrator,
          passwordHash,
        });
        console.log('[Seed] Ensured admin123 user exists.');
      }

      const accountant = await User.findOne({ loginId: 'account123' });
      if (!accountant) {
        await User.create({
          name: 'Accountant User',
          loginId: 'account123',
          email: 'accountant@urban.com',
          role: Role.Accountant,
          passwordHash,
        });
        console.log('[Seed] Ensured account123 user exists.');
      }

      const user = await User.findOne({ loginId: 'johnuser' });
      if (!user) {
        const rajContact = await Contact.findOne({ email: 'raj@example.com' });
        await User.create({
          name: 'Customer John',
          loginId: 'johnuser',
          email: 'john@example.com',
          role: Role.User,
          passwordHash,
          contactId: rajContact?._id?.toString(),
        });
        console.log('[Seed] Ensured johnuser user exists.');
      }
    }
  } catch (error) {
    console.warn('[Seed] Warning in ensureSeeded:', error);
  }
};

// Direct invocation
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Exiting process...');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

