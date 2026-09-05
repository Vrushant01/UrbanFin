export enum Role {
  MasterAdmin = 'MasterAdmin',
  Administrator = 'Administrator',
  SubAdmin = 'SubAdmin',
  Accountant = 'Accountant',
  Vendor = 'Vendor',
  User = 'User',
}

export interface User {
  id: string;
  name: string;
  loginId: string;
  email: string;
  role: Role;
  password?: string;
  contactId?: string;
  isSuspended?: boolean;
  isMasterAdmin?: boolean;
  createdAt?: string;
}

export interface VendorProduct {
  id: string;
  vendorId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  price: number;
  stockQuantity: number;
  description?: string;
  image?: string;
  vendorName?: string;
  vendorEmail?: string;
  createdAt?: string;
}

export type OmitPassword<T> = Omit<T, 'password'>;

// Module 2 Types
export enum ContactType {
  Customer = 'Customer',
  Vendor = 'Vendor',
  Both = 'Both'
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string;
  image?: string; // Base64
  address: Address;
  hasPortalAccess?: boolean;
}

export enum ProductType {
  Goods = 'Goods',
  Service = 'Service',
  Combo = 'Combo'
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  categoryId: string; // Foreign key to Category
  categoryName?: string;
  salesPrice: number;
  cost: number;
  image?: string; // Base64
}

// Module 3 Types
export enum AccountType {
  // Balance Sheet
  Asset = 'Asset',
  Liability = 'Liability',
  Bank = 'Bank',
  Capital = 'Capital',
  Cash = 'Cash',
  // Profit & Loss
  Income = 'Income',
  Expenses = 'Expenses',
  OtherExpenses = 'Other Expenses'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export enum JournalType {
  Sales = 'Sales',
  Purchase = 'Purchase',
  Bank = 'Bank',
  Cash = 'Cash'
}

export interface Journal {
  id: string;
  name: string;
  type: JournalType;
  defaultAccountId: string; // Foreign key to Account
}

export enum JournalEntryStatus {
  Draft = 'Draft',
  Posted = 'Posted'
}

export interface JournalEntryLine {
  id: string;
  accountId: string; // Foreign key to Account
  partnerId?: string; // Foreign key to Contact
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  number: string; // e.g. JRNL/2026/0001
  journalId: string; // Foreign key to Journal
  partnerId?: string; // Foreign key to Contact (often derived from main line, or set on header)
  status: JournalEntryStatus;
  lines: JournalEntryLine[];
  total: number; // usually sum of debits
}

// Module 4 Types
export enum AnalyticAccountType {
  Income = 'Income',
  Expenses = 'Expenses'
}

export interface AnalyticAccount {
  id: string;
  name: string;
  type: AnalyticAccountType;
}

export enum BudgetStatus {
  Draft = 'Draft',
  Confirmed = 'Confirmed',
  Revised = 'Revised',
  Cancelled = 'Cancelled'
}

export interface BudgetLine {
  id: string;
  analyticAccountId: string; // Foreign key
  type: AnalyticAccountType; // Copied from analytic account
  committedAmount: number;
  achievedAmount: number; // Computed when confirmed
}

export interface Budget {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  responsibleId: string; // Foreign key to Contact
  status: BudgetStatus;
  revisionOfId?: string; // Foreign key to previous Budget id
  lines: BudgetLine[];
}

// Module 5 Types
export enum PurchaseOrderStatus {
  Draft = 'Draft',
  SentToVendor = 'Sent to Vendor',
  Accepted = 'Accepted',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled'
}

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  vendorId: string;
  date: string;
  paymentTerms: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
}

export enum VendorBillStatus {
  Draft = 'Draft',
  Confirmed = 'Confirmed',
  PartiallyPaid = 'Partially Paid',
  Paid = 'Paid',
  Cancelled = 'Cancelled'
}

export interface VendorBillLine {
  id: string;
  productId: string;
  accountId: string; // Defaults to Purchase Expense A/c
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface VendorBill {
  id: string;
  number: string;
  vendorId: string;
  billReference: string;
  billDate: string;
  dueDate: string;
  poReferenceId?: string; // Foreign key to PurchaseOrder
  status: VendorBillStatus;
  lines: VendorBillLine[];
  amountPaid: number;
  cashPaid: number;
  bankPaid: number;
}

export enum PaymentType {
  Send = 'Send',
  Receive = 'Receive'
}

export enum PaymentVia {
  Bank = 'Bank',
  Cash = 'Cash'
}

export interface Payment {
  id: string;
  type: PaymentType;
  partnerId: string;
  amount: number;
  date: string;
  via: PaymentVia;
  note: string;
  billId?: string; // Foreign key to VendorBill if linked
  invoiceId?: string; // Foreign key to CustomerInvoice if linked
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

// Module 6 Types
export enum SalesOrderStatus {
  Draft = 'Draft',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled'
}

export interface SalesOrderLine {
  id: string;
  productId: string;
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface SalesOrder {
  id: string;
  number: string;
  customerId: string;
  date: string;
  status: SalesOrderStatus;
  lines: SalesOrderLine[];
}

export enum CustomerInvoiceStatus {
  Draft = 'Draft',
  Confirmed = 'Confirmed',
  PartiallyPaid = 'Partially Paid',
  Paid = 'Paid'
}

export interface CustomerInvoiceLine {
  id: string;
  productId: string;
  accountId: string; // Defaults to Sales Income A/c
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface CustomerInvoice {
  id: string;
  number: string;
  customerId: string;
  invoiceReference: string;
  invoiceDate: string;
  dueDate: string;
  soReferenceId?: string; // Foreign key to SalesOrder
  status: CustomerInvoiceStatus;
  lines: CustomerInvoiceLine[];
  amountPaid: number;
  cashPaid: number;
  bankPaid: number;
  paymentRequested?: boolean;
  paymentRequestedAt?: string;
  total?: number;
  amountDue?: number;
  customerName?: string;
  customerEmail?: string;
}
