export enum Role {
  MasterAdmin = 'MasterAdmin',
  Administrator = 'Administrator',
  SubAdmin = 'SubAdmin',
  Accountant = 'Accountant',
  Vendor = 'Vendor',
  User = 'User',
}

export interface UserResponse {
  id: string;
  name: string;
  loginId: string;
  email: string;
  role: Role;
  contactId?: string;
  isSuspended?: boolean;
  isMasterAdmin?: boolean;
  createdAt?: string;
}

export interface VendorProductResponse {
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
}

export enum ContactType {
  Customer = 'Customer',
  Vendor = 'Vendor',
  Both = 'Both',
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface ContactResponse {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string;
  image?: string;
  address: Address;
  hasPortalAccess?: boolean;
}

export enum ProductType {
  Goods = 'Goods',
  Service = 'Service',
  Combo = 'Combo',
}

export interface CategoryResponse {
  id: string;
  name: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  type: ProductType;
  categoryId: string;
  salesPrice: number;
  cost: number;
  image?: string;
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
  OtherExpenses = 'Other Expenses',
}

export interface AccountResponse {
  id: string;
  name: string;
  type: AccountType;
}

export enum JournalType {
  Sales = 'Sales',
  Purchase = 'Purchase',
  Bank = 'Bank',
  Cash = 'Cash',
}

export interface JournalResponse {
  id: string;
  name: string;
  type: JournalType;
  defaultAccountId: string;
}

export enum JournalEntryStatus {
  Draft = 'Draft',
  Posted = 'Posted',
}

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  partnerId?: string;
  debit: number;
  credit: number;
}

export interface JournalEntryResponse {
  id: string;
  date: string;
  number: string;
  journalId: string;
  partnerId?: string;
  status: JournalEntryStatus;
  lines: JournalEntryLine[];
  total: number;
  sourceDocument?: {
    model: 'VendorBill' | 'CustomerInvoice' | 'Payment';
    id: string;
  };
}

// Module 4 Types
export enum AnalyticAccountType {
  Income = 'Income',
  Expenses = 'Expenses',
}

export interface AnalyticAccountResponse {
  id: string;
  name: string;
  type: AnalyticAccountType;
}

export enum BudgetStatus {
  Draft = 'Draft',
  Confirmed = 'Confirmed',
  Revised = 'Revised',
  Cancelled = 'Cancelled',
}

export interface BudgetLine {
  id: string;
  analyticAccountId: string;
  type: AnalyticAccountType;
  committedAmount: number;
  achievedAmount: number;
}

export interface BudgetResponse {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  responsibleId: string;
  status: BudgetStatus;
  revisionOfId?: string;
  revisedById?: string;
  lines: BudgetLine[];
}

// Module 5 Types
export enum PurchaseOrderStatus {
  Draft = 'Draft',
  SentToVendor = 'Sent to Vendor',
  Accepted = 'Accepted',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled',
}

export interface PurchaseOrderLine {
  id: string;
  productId: string;
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface PurchaseOrderResponse {
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
}

export interface VendorBillLine {
  id: string;
  productId: string;
  accountId: string;
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface VendorBillResponse {
  id: string;
  number: string;
  vendorId: string;
  billReference: string;
  billDate: string;
  dueDate: string;
  poReferenceId?: string;
  status: VendorBillStatus;
  lines: VendorBillLine[];
  amountPaid: number;
  cashPaid: number;
  bankPaid: number;
  amountDue?: number;
  total?: number;
}

export enum PaymentType {
  Send = 'Send',
  Receive = 'Receive',
}

export enum PaymentVia {
  Bank = 'Bank',
  Cash = 'Cash',
}

export interface PaymentResponse {
  id: string;
  type: PaymentType;
  partnerId: string;
  amount: number;
  date: string;
  via: PaymentVia;
  note: string;
  billId?: string;
  invoiceId?: string;
}

// Module 6 Types
export enum SalesOrderStatus {
  Draft = 'Draft',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled',
}

export interface SalesOrderLine {
  id: string;
  productId: string;
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface SalesOrderResponse {
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
  Paid = 'Paid',
}

export interface CustomerInvoiceLine {
  id: string;
  productId: string;
  accountId: string;
  analyticAccountId?: string;
  qty: number;
  unitPrice: number;
}

export interface CustomerInvoiceResponse {
  id: string;
  number: string;
  customerId: string;
  invoiceReference: string;
  invoiceDate: string;
  dueDate: string;
  soReferenceId?: string;
  status: CustomerInvoiceStatus;
  lines: CustomerInvoiceLine[];
  amountPaid: number;
  cashPaid: number;
  bankPaid: number;
  amountDue?: number;
  total?: number;
  paymentRequested?: boolean;
  paymentRequestedAt?: string;
}

// Dashboard & Reports Types
export interface DashboardSummaryResponse {
  budgetStats: {
    achieved: number;
    budget: number;
    committed: number;
  };
  purchaseStats: {
    all: number;
    confirmed: number;
    draft: number;
  };
  salesStats: {
    all: number;
    confirmed: number;
    draft: number;
  };
}
