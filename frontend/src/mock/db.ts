import { 
  Role, type User, type OmitPassword, 
  type Contact, type Product, type Category, ContactType, ProductType,
  type Account, type Journal, type JournalEntry, AccountType, JournalType, JournalEntryStatus,
  type AnalyticAccount, AnalyticAccountType, type Budget, BudgetStatus,
  type PurchaseOrder, type VendorBill, type Payment, PurchaseOrderStatus, VendorBillStatus, PaymentType, PaymentVia,
  type SalesOrder, type CustomerInvoice, SalesOrderStatus, CustomerInvoiceStatus
} from '../types';

const STORAGE_KEY = 'urban_furniture_users';
const SESSION_KEY = 'urban_furniture_session';
const CONTACTS_KEY = 'urban_furniture_contacts';
const PRODUCTS_KEY = 'urban_furniture_products';
const CATEGORIES_KEY = 'urban_furniture_categories';
const ACCOUNTS_KEY = 'urban_furniture_accounts';
const JOURNALS_KEY = 'urban_furniture_journals';
const JOURNAL_ENTRIES_KEY = 'urban_furniture_journal_entries';
const ANALYTIC_ACCOUNTS_KEY = 'urban_furniture_analytic_accounts';
const BUDGETS_KEY = 'urban_furniture_budgets';
const PO_KEY = 'urban_furniture_po';
const BILLS_KEY = 'urban_furniture_bills';
const PAYMENTS_KEY = 'urban_furniture_payments';
const PAYMENT_TERMS_KEY = 'urban_furniture_payment_terms';
const SO_KEY = 'urban_furniture_so';
const INVOICES_KEY = 'urban_furniture_invoices';

const API_BASE = '/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('urbanfin_jwt_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export async function apiCall<T>(method: string, path: string, body?: any): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status !== 401 && res.status !== 403) {
        console.warn(`[API] ${method} ${path} returned status ${res.status}`);
      }
      return null;
    }
    return await res.json();
  } catch (err) {
    return null;
  }
}

// Seed data
const seedData = () => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    const defaultUsers: User[] = [
      { id: '1', name: 'Master Admin', loginId: 'admin123', email: 'admin@urban.com', role: Role.MasterAdmin, isMasterAdmin: true, isSuspended: false, password: 'Password@123' },
      { id: '2', name: 'Operations SubAdmin', loginId: 'subadmin', email: 'subadmin@urban.com', role: Role.SubAdmin, isMasterAdmin: false, isSuspended: false, password: 'Password@123' },
      { id: '3', name: 'Rahul Vendor', loginId: 'vendor123', email: 'rahul@example.com', role: Role.Vendor, isMasterAdmin: false, isSuspended: false, password: 'Password@123', contactId: 'c1' },
      { id: '4', name: 'Accountant User', loginId: 'account123', email: 'accountant@urban.com', role: Role.Accountant, isMasterAdmin: false, isSuspended: false, password: 'Password@123' },
      { id: '5', name: 'Customer John', loginId: 'johnuser', email: 'john@example.com', role: Role.User, isMasterAdmin: false, isSuspended: false, password: 'Password@123', contactId: 'c2' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem(CATEGORIES_KEY)) {
    const defaultCategories: Category[] = [
      { id: 'cat1', name: 'Electronics' },
      { id: 'cat2', name: 'Furniture' },
    ];
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(defaultCategories));
  }

  if (!localStorage.getItem(CONTACTS_KEY)) {
    const defaultContacts: Contact[] = [
      {
        id: 'c1',
        name: 'Mr. Rahul',
        type: ContactType.Vendor,
        email: 'rahul@example.com',
        phone: '123-456-7890',
        address: { street: '123 Main St', city: 'Anytown', state: 'NY', country: 'USA', pincode: '12345' },
      },
      {
        id: 'c2',
        name: 'Mr. Raj',
        type: ContactType.Customer,
        email: 'raj@example.com',
        phone: '987-654-3210',
        address: { street: '456 Market St', city: 'Business City', state: 'CA', country: 'USA', pincode: '98765' },
        hasPortalAccess: true
      },
      {
        id: 'c3',
        name: 'Urban Furnishings Supplier',
        type: ContactType.Vendor,
        email: 'supplier@urbanfurnish.com',
        phone: '998-877-6655',
        address: { street: '78 Industrial Area', city: 'Mumbai', state: 'MH', country: 'India', pincode: '400001' },
      },
      {
        id: 'c4',
        name: 'Acme Woodworks Ltd',
        type: ContactType.Vendor,
        email: 'contact@acmewood.com',
        phone: '887-766-5544',
        address: { street: '12 Timber Estate', city: 'Bangalore', state: 'KA', country: 'India', pincode: '560001' },
      },
      {
        id: 'c5',
        name: 'Priya Sharma Enterprises',
        type: ContactType.Customer,
        email: 'priya@enterprise.com',
        phone: '776-655-4433',
        address: { street: '55 Tech Park Avenue', city: 'Pune', state: 'MH', country: 'India', pincode: '411001' },
        hasPortalAccess: true
      },
      {
        id: 'c6',
        name: 'Nexus Commercial Interiors',
        type: ContactType.Customer,
        email: 'orders@nexuscorp.com',
        phone: '665-544-3322',
        address: { street: '90 Cyber City', city: 'Gurugram', state: 'HR', country: 'India', pincode: '122002' },
        hasPortalAccess: true
      }
    ];
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(defaultContacts));
  }

  if (!localStorage.getItem(PRODUCTS_KEY)) {
    const defaultProducts: Product[] = [
      {
        id: 'p1',
        name: 'Air Conditioner',
        type: ProductType.Goods,
        categoryId: 'cat1',
        salesPrice: 25000,
        cost: 15000
      },
      {
        id: 'p2',
        name: 'Refrigerator',
        type: ProductType.Goods,
        categoryId: 'cat1',
        salesPrice: 10000,
        cost: 7000
      },
      {
        id: 'p3',
        name: 'Executive Teak Desk',
        type: ProductType.Goods,
        categoryId: 'cat2',
        salesPrice: 22000,
        cost: 14000
      },
      {
        id: 'p4',
        name: 'Ergonomic Mesh Chair',
        type: ProductType.Goods,
        categoryId: 'cat2',
        salesPrice: 8500,
        cost: 5000
      },
      {
        id: 'p5',
        name: 'Premium L-Shape Sofa Set',
        type: ProductType.Goods,
        categoryId: 'cat2',
        salesPrice: 45000,
        cost: 28000
      }
    ];
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(defaultProducts));
  }

  if (!localStorage.getItem(ACCOUNTS_KEY)) {
    const defaultAccounts: Account[] = [
      { id: 'a1', name: 'HDFC Bank', type: AccountType.Bank },
      { id: 'a2', name: 'Cash', type: AccountType.Cash },
      { id: 'a3', name: 'Cost of Goods Sold (Purchases)', type: AccountType.Expenses },
      { id: 'a4', name: 'Furniture Sales', type: AccountType.Income },
      { id: 'a5', name: 'Debtors A/c', type: AccountType.Asset },
      { id: 'a6', name: 'Creditors A/c', type: AccountType.Liability },
      { id: 'a7', name: 'Capital A/c', type: AccountType.Capital },
      { id: 'a8', name: 'Office Supplies & Logistics', type: AccountType.Expenses },
      { id: 'a9', name: 'Consulting & Services Revenue', type: AccountType.Income },
      { id: 'a10', name: 'Rent & Utility Expenses', type: AccountType.OtherExpenses },
    ];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(defaultAccounts));
  }

  if (!localStorage.getItem(JOURNALS_KEY)) {
    const defaultJournals: Journal[] = [
      { id: 'j1', name: 'Bank Journal', type: JournalType.Bank, defaultAccountId: 'a1' },
      { id: 'j2', name: 'Cash Journal', type: JournalType.Cash, defaultAccountId: 'a2' },
      { id: 'j3', name: 'Purchase Journal', type: JournalType.Purchase, defaultAccountId: 'a3' },
      { id: 'j4', name: 'Sales Journal', type: JournalType.Sales, defaultAccountId: 'a4' },
    ];
    localStorage.setItem(JOURNALS_KEY, JSON.stringify(defaultJournals));
  }

  if (!localStorage.getItem(JOURNAL_ENTRIES_KEY)) {
    const defaultEntries: JournalEntry[] = [
      {
        id: 'je0',
        date: '2026-01-01',
        number: 'JRNL/2026/0001',
        journalId: 'j1',
        status: JournalEntryStatus.Posted,
        total: 100000,
        lines: [
          { id: 'jel0_1', accountId: 'a1', debit: 100000, credit: 0 },
          { id: 'jel0_2', accountId: 'a7', debit: 0, credit: 100000 }
        ]
      },
      {
        id: 'je1',
        date: '2026-09-01',
        number: 'JRNL/2026/0002',
        journalId: 'j3',
        partnerId: 'c1',
        status: JournalEntryStatus.Posted,
        total: 30000,
        lines: [
          { id: 'jel1', accountId: 'a3', partnerId: 'c1', debit: 30000, credit: 0 },
          { id: 'jel2', accountId: 'a6', partnerId: 'c1', debit: 0, credit: 30000 }
        ]
      },
      {
        id: 'je2',
        date: '2026-09-02',
        number: 'JRNL/2026/0003',
        journalId: 'j4',
        partnerId: 'c2',
        status: JournalEntryStatus.Posted,
        total: 10500,
        lines: [
          { id: 'jel3', accountId: 'a5', partnerId: 'c2', debit: 10500, credit: 0 },
          { id: 'jel4', accountId: 'a4', partnerId: 'c2', debit: 0, credit: 10500 }
        ]
      },
      {
        id: 'je3',
        date: '2026-09-03',
        number: 'JRNL/2026/0004',
        journalId: 'j2',
        status: JournalEntryStatus.Posted,
        total: 15000,
        lines: [
          { id: 'jel5', accountId: 'a2', debit: 15000, credit: 0 },
          { id: 'jel6', accountId: 'a1', debit: 0, credit: 15000 }
        ]
      },
      {
        id: 'je4',
        date: '2026-09-04',
        number: 'JRNL/2026/0005',
        journalId: 'j1',
        status: JournalEntryStatus.Posted,
        total: 8000,
        lines: [
          { id: 'jel7', accountId: 'a10', debit: 8000, credit: 0 },
          { id: 'jel8', accountId: 'a1', debit: 0, credit: 8000 }
        ]
      }
    ];
    localStorage.setItem(JOURNAL_ENTRIES_KEY, JSON.stringify(defaultEntries));
  }

  if (!localStorage.getItem(ANALYTIC_ACCOUNTS_KEY)) {
    const defaultAnalytics: AnalyticAccount[] = [
      { id: 'ana1', name: 'Furniture', type: AnalyticAccountType.Expenses },
      { id: 'ana2', name: 'Software Sales', type: AnalyticAccountType.Income },
      { id: 'ana3', name: 'Corporate Fitout Project Alpha', type: AnalyticAccountType.Income },
      { id: 'ana4', name: 'Showroom Maintenance & Operations', type: AnalyticAccountType.Expenses },
      { id: 'ana5', name: 'Digital Marketing & PR Campaign', type: AnalyticAccountType.Expenses },
    ];
    localStorage.setItem(ANALYTIC_ACCOUNTS_KEY, JSON.stringify(defaultAnalytics));
  }

  if (!localStorage.getItem(BUDGETS_KEY)) {
    const defaultBudgets: Budget[] = [
      {
        id: 'b1',
        name: 'FY2026 Annual Operations Budget',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        responsibleId: '1',
        status: BudgetStatus.Confirmed,
        lines: [
          {
            id: 'bl1',
            analyticAccountId: 'ana1',
            type: AnalyticAccountType.Expenses,
            committedAmount: 500000,
            achievedAmount: 0
          },
          {
            id: 'bl2',
            analyticAccountId: 'ana4',
            type: AnalyticAccountType.Expenses,
            committedAmount: 150000,
            achievedAmount: 0
          },
          {
            id: 'bl3',
            analyticAccountId: 'ana5',
            type: AnalyticAccountType.Expenses,
            committedAmount: 200000,
            achievedAmount: 0
          }
        ]
      },
      {
        id: 'b2',
        name: 'January 2026 Monthly Budget',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        responsibleId: '1',
        status: BudgetStatus.Confirmed,
        lines: [
          {
            id: 'bl4',
            analyticAccountId: 'ana1',
            type: AnalyticAccountType.Expenses,
            committedAmount: 60000,
            achievedAmount: 0
          }
        ]
      }
    ];
    localStorage.setItem(BUDGETS_KEY, JSON.stringify(defaultBudgets));
  }

  if (!localStorage.getItem(PAYMENT_TERMS_KEY)) {
    localStorage.setItem(PAYMENT_TERMS_KEY, JSON.stringify(['Immediate Payment', '15 Days', '30 Days', '45 Days']));
  }


  if (!localStorage.getItem(INVOICES_KEY)) {
    const defaultInvoices: CustomerInvoice[] = [
      {
        id: 'inv1',
        number: 'INV/2026/1213',
        customerId: 'c2',
        invoiceReference: '',
        invoiceDate: '2026-08-11',
        dueDate: '2026-08-11',
        status: CustomerInvoiceStatus.Paid,
        amountPaid: 100000,
        cashPaid: 0,
        bankPaid: 100000,
        lines: [
          {
            id: 'il1',
            productId: 'p1',
            accountId: 'a6',
            qty: 4,
            unitPrice: 25000
          }
        ]
      },
      {
        id: 'inv2',
        number: 'INV/2026/1820',
        customerId: 'c2',
        invoiceReference: '',
        invoiceDate: '2026-08-25',
        dueDate: '2026-08-25',
        status: CustomerInvoiceStatus.Confirmed,
        amountPaid: 0,
        cashPaid: 0,
        bankPaid: 0,
        lines: [
          {
            id: 'il2',
            productId: 'p1',
            accountId: 'a6',
            qty: 1,
            unitPrice: 25000
          }
        ]
      },
      {
        id: 'inv3',
        number: 'INV/2026/0500',
        customerId: 'c2',
        invoiceReference: 'Maintenance Test Service',
        invoiceDate: '2026-09-01',
        dueDate: '2026-09-15',
        status: CustomerInvoiceStatus.Confirmed,
        amountPaid: 0,
        cashPaid: 0,
        bankPaid: 0,
        lines: [
          {
            id: 'il3',
            productId: 'p2',
            accountId: 'a6',
            qty: 1,
            unitPrice: 500
          }
        ]
      }
    ];
    localStorage.setItem(INVOICES_KEY, JSON.stringify(defaultInvoices));
  }

  if (!localStorage.getItem(PAYMENTS_KEY)) {
    const defaultPayments: Payment[] = [
      {
        id: 'pay1',
        type: PaymentType.Receive,
        partnerId: 'c2',
        amount: 100000,
        date: '2026-08-11',
        via: PaymentVia.Bank,
        note: 'Full payment for INV/2026/1213',
        invoiceId: 'inv1'
      }
    ];
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(defaultPayments));
  }
};

seedData();

export const mockDb = {
  // Sync with Backend
  syncWithBackend: async () => {
    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      if (!token) return;

      const session = mockDb.getSession();
      if (!session) return;

      // Customer Portal User role only syncs their own scoped portal invoices
      if (session.role === Role.User) {
        const portalInvoices = await apiCall<CustomerInvoice[]>('GET', '/portal/invoices');
        if (portalInvoices && Array.isArray(portalInvoices)) {
          localStorage.setItem(INVOICES_KEY, JSON.stringify(portalInvoices));
        }
        return;
      }

      // Vendor role does not need to sync the admin suite
      if (session.role === Role.Vendor) {
        return;
      }

      // Administrator / Accountant role syncs full suite
      const [contacts, products, categories, accounts, journals, journalEntries, analytics, budgets, pos, bills, sos, invoices, payments] = await Promise.all([
        apiCall<Contact[]>('GET', '/contacts'),
        apiCall<Product[]>('GET', '/products'),
        apiCall<Category[]>('GET', '/categories'),
        apiCall<Account[]>('GET', '/accounts'),
        apiCall<Journal[]>('GET', '/journals'),
        apiCall<JournalEntry[]>('GET', '/journal-entries'),
        apiCall<AnalyticAccount[]>('GET', '/analytics'),
        apiCall<Budget[]>('GET', '/budgets'),
        apiCall<PurchaseOrder[]>('GET', '/purchase-orders'),
        apiCall<VendorBill[]>('GET', '/vendor-bills'),
        apiCall<SalesOrder[]>('GET', '/sales-orders'),
        apiCall<CustomerInvoice[]>('GET', '/customer-invoices'),
        apiCall<Payment[]>('GET', '/payments'),
      ]);

      if (contacts) localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
      if (products) localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
      if (categories) localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
      if (accounts) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      if (journals) localStorage.setItem(JOURNALS_KEY, JSON.stringify(journals));
      if (journalEntries) localStorage.setItem(JOURNAL_ENTRIES_KEY, JSON.stringify(journalEntries));
      if (analytics) localStorage.setItem(ANALYTIC_ACCOUNTS_KEY, JSON.stringify(analytics));
      if (budgets) localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
      if (pos) localStorage.setItem(PO_KEY, JSON.stringify(pos));
      if (bills) localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
      if (sos) localStorage.setItem(SO_KEY, JSON.stringify(sos));
      if (invoices) localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
      if (payments) localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
    } catch (e) {
      console.warn('[Sync] Backend sync error:', e);
    }
  },

  // Users
  getUsers: (): User[] => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
  saveUsers: (users: User[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(users)),
  addUser: (user: Omit<User, 'id'>): User => {
    const users = mockDb.getUsers();
    const newUser = { ...user, id: Math.random().toString(36).substr(2, 9) };
    users.push(newUser);
    mockDb.saveUsers(users);

    apiCall('POST', '/auth/create-user', user).catch(console.warn);
    return newUser;
  },
  checkUnique: (field: 'loginId' | 'email', value: string): boolean => {
    return !mockDb.getUsers().some(u => u[field].toLowerCase() === value.toLowerCase());
  },
  
  // Session
  getSession: (): OmitPassword<User> | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },
  setSession: (user: OmitPassword<User>) => localStorage.setItem(SESSION_KEY, JSON.stringify(user)),
  clearSession: () => localStorage.removeItem(SESSION_KEY),

  // Contacts
  getContacts: (): Contact[] => JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]'),
  saveContacts: (contacts: Contact[]) => localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)),
  addContact: (contact: Omit<Contact, 'id'>): Contact => {
    const contacts = mockDb.getContacts();
    const newContact = { ...contact, id: Math.random().toString(36).substr(2, 9) };
    contacts.push(newContact);
    mockDb.saveContacts(contacts);

    apiCall<Contact>('POST', '/contacts', contact).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getContacts();
        const idx = list.findIndex(c => c.id === newContact.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveContacts(list);
        }
      }
    }).catch(console.warn);

    return newContact;
  },
  updateContact: (id: string, contact: Partial<Contact>): Contact | null => {
    const contacts = mockDb.getContacts();
    const index = contacts.findIndex(c => c.id === id);
    if (index === -1) return null;
    contacts[index] = { ...contacts[index], ...contact };
    mockDb.saveContacts(contacts);

    apiCall('PUT', `/contacts/${id}`, contact).catch(console.warn);
    return contacts[index];
  },
  deleteContact: (id: string): boolean => {
    const contacts = mockDb.getContacts().filter(c => c.id !== id);
    mockDb.saveContacts(contacts);
    apiCall('DELETE', `/contacts/${id}`).catch(console.warn);
    return true;
  },
  checkUniqueContactEmail: (email: string, excludeId?: string): boolean => {
    const contacts = mockDb.getContacts();
    return !contacts.some(c => c.email.toLowerCase() === email.toLowerCase() && c.id !== excludeId);
  },

  // Categories
  getCategories: (): Category[] => JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]'),
  saveCategories: (categories: Category[]) => localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories)),
  addCategory: (name: string): Category => {
    const categories = mockDb.getCategories();
    const newCategory = { id: Math.random().toString(36).substr(2, 9), name };
    categories.push(newCategory);
    mockDb.saveCategories(categories);

    apiCall<Category>('POST', '/categories', { name }).catch(console.warn);
    return newCategory;
  },

  // Products
  getProducts: (): Product[] => JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]'),
  saveProducts: (products: Product[]) => localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products)),
  addProduct: (product: Omit<Product, 'id'>): Product => {
    const products = mockDb.getProducts();
    const newProduct = { ...product, id: Math.random().toString(36).substr(2, 9) };
    products.push(newProduct);
    mockDb.saveProducts(products);

    apiCall<Product>('POST', '/products', product).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getProducts();
        const idx = list.findIndex(p => p.id === newProduct.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveProducts(list);
        }
      }
    }).catch(console.warn);

    return newProduct;
  },
  updateProduct: (id: string, product: Partial<Product>): Product | null => {
    const products = mockDb.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return null;
    products[index] = { ...products[index], ...product };
    mockDb.saveProducts(products);

    apiCall('PUT', `/products/${id}`, product).catch(console.warn);
    return products[index];
  },
  deleteProduct: (id: string): boolean => {
    const products = mockDb.getProducts().filter(p => p.id !== id);
    mockDb.saveProducts(products);
    apiCall('DELETE', `/products/${id}`).catch(console.warn);
    return true;
  },

  // Accounts
  getAccounts: (): Account[] => JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'),
  saveAccounts: (accounts: Account[]) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)),
  addAccount: (account: Omit<Account, 'id'>): Account => {
    const accounts = mockDb.getAccounts();
    const newAccount = { ...account, id: Math.random().toString(36).substr(2, 9) };
    accounts.push(newAccount);
    mockDb.saveAccounts(accounts);

    apiCall<Account>('POST', '/accounts', account).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getAccounts();
        const idx = list.findIndex(a => a.id === newAccount.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveAccounts(list);
        }
      }
    }).catch(console.warn);
    return newAccount;
  },
  updateAccount: (id: string, account: Partial<Account>): Account | null => {
    const accounts = mockDb.getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) return null;
    accounts[index] = { ...accounts[index], ...account };
    mockDb.saveAccounts(accounts);

    apiCall('PUT', `/accounts/${id}`, account).catch(console.warn);
    return accounts[index];
  },
  deleteAccount: (id: string): boolean => {
    const accounts = mockDb.getAccounts().filter(a => a.id !== id);
    mockDb.saveAccounts(accounts);
    apiCall('DELETE', `/accounts/${id}`).catch(console.warn);
    return true;
  },

  // Journals
  getJournals: (): Journal[] => JSON.parse(localStorage.getItem(JOURNALS_KEY) || '[]'),
  saveJournals: (journals: Journal[]) => localStorage.setItem(JOURNALS_KEY, JSON.stringify(journals)),
  addJournal: (journal: Omit<Journal, 'id'>): Journal => {
    const journals = mockDb.getJournals();
    const newJournal = { ...journal, id: Math.random().toString(36).substr(2, 9) };
    journals.push(newJournal);
    mockDb.saveJournals(journals);

    apiCall<Journal>('POST', '/journals', journal).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getJournals();
        const idx = list.findIndex(j => j.id === newJournal.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveJournals(list);
        }
      }
    }).catch(console.warn);
    return newJournal;
  },
  updateJournal: (id: string, journal: Partial<Journal>): Journal | null => {
    const journals = mockDb.getJournals();
    const index = journals.findIndex(j => j.id === id);
    if (index === -1) return null;
    journals[index] = { ...journals[index], ...journal };
    mockDb.saveJournals(journals);

    apiCall('PUT', `/journals/${id}`, journal).catch(console.warn);
    return journals[index];
  },
  deleteJournal: (id: string): boolean => {
    const journals = mockDb.getJournals().filter(j => j.id !== id);
    mockDb.saveJournals(journals);
    apiCall('DELETE', `/journals/${id}`).catch(console.warn);
    return true;
  },

  // Journal Entries
  getJournalEntries: (): JournalEntry[] => JSON.parse(localStorage.getItem(JOURNAL_ENTRIES_KEY) || '[]'),
  saveJournalEntries: (entries: JournalEntry[]) => localStorage.setItem(JOURNAL_ENTRIES_KEY, JSON.stringify(entries)),
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>): JournalEntry => {
    const entries = mockDb.getJournalEntries();
    
    let number = entry.number;
    if (!number || number.trim() === '') {
       number = `JRNL/2026/${String(entries.length + 1).padStart(4, '0')}`;
    }

    const newEntry = { ...entry, number, id: Math.random().toString(36).substr(2, 9) };
    entries.push(newEntry);
    mockDb.saveJournalEntries(entries);

    apiCall<JournalEntry>('POST', '/journal-entries', entry).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getJournalEntries();
        const idx = list.findIndex(e => e.id === newEntry.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveJournalEntries(list);
        }
      }
    }).catch(console.warn);
    return newEntry;
  },
  updateJournalEntry: (id: string, entry: Partial<JournalEntry>): JournalEntry | null => {
    const entries = mockDb.getJournalEntries();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    let updatedEntry = { ...entries[index], ...entry };

    if (updatedEntry.status === JournalEntryStatus.Posted && (!updatedEntry.number || updatedEntry.number.trim() === '')) {
       updatedEntry.number = `JRNL/2026/${String(entries.length + 1).padStart(4, '0')}`;
    }

    entries[index] = updatedEntry;
    mockDb.saveJournalEntries(entries);

    if (entry.status === JournalEntryStatus.Posted) {
      apiCall('POST', `/journal-entries/${id}/post`, entry).catch(() => {
        apiCall('PUT', `/journal-entries/${id}`, entry).catch(console.warn);
      });
    } else {
      apiCall('PUT', `/journal-entries/${id}`, entry).catch(console.warn);
    }

    return updatedEntry;
  },
  deleteJournalEntry: (id: string): boolean => {
    const entries = mockDb.getJournalEntries().filter(e => e.id !== id);
    mockDb.saveJournalEntries(entries);
    apiCall('DELETE', `/journal-entries/${id}`).catch(console.warn);
    return true;
  },

  // Analytic Accounts
  getAnalyticAccounts: (): AnalyticAccount[] => JSON.parse(localStorage.getItem(ANALYTIC_ACCOUNTS_KEY) || '[]'),
  saveAnalyticAccounts: (analytics: AnalyticAccount[]) => localStorage.setItem(ANALYTIC_ACCOUNTS_KEY, JSON.stringify(analytics)),
  addAnalyticAccount: (analytic: Omit<AnalyticAccount, 'id'>): AnalyticAccount => {
    const analytics = mockDb.getAnalyticAccounts();
    const newAnalytic = { ...analytic, id: Math.random().toString(36).substr(2, 9) };
    analytics.push(newAnalytic);
    mockDb.saveAnalyticAccounts(analytics);

    apiCall<AnalyticAccount>('POST', '/analytics', analytic).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getAnalyticAccounts();
        const idx = list.findIndex(a => a.id === newAnalytic.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveAnalyticAccounts(list);
        }
      }
    }).catch(console.warn);
    return newAnalytic;
  },
  updateAnalyticAccount: (id: string, analytic: Partial<AnalyticAccount>): AnalyticAccount | null => {
    const analytics = mockDb.getAnalyticAccounts();
    const index = analytics.findIndex(a => a.id === id);
    if (index === -1) return null;
    analytics[index] = { ...analytics[index], ...analytic };
    mockDb.saveAnalyticAccounts(analytics);

    apiCall('PUT', `/analytics/${id}`, analytic).catch(console.warn);
    return analytics[index];
  },
  deleteAnalyticAccount: (id: string): boolean => {
    const analytics = mockDb.getAnalyticAccounts().filter(a => a.id !== id);
    mockDb.saveAnalyticAccounts(analytics);
    apiCall('DELETE', `/analytics/${id}`).catch(console.warn);
    return true;
  },

  // Budgets
  getBudgets: (): Budget[] => JSON.parse(localStorage.getItem(BUDGETS_KEY) || '[]'),
  saveBudgets: (budgets: Budget[]) => localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets)),
  addBudget: (budget: Omit<Budget, 'id'>): Budget => {
    const budgets = mockDb.getBudgets();
    const newBudget = { ...budget, id: Math.random().toString(36).substr(2, 9) };
    budgets.push(newBudget);
    mockDb.saveBudgets(budgets);

    apiCall<Budget>('POST', '/budgets', budget).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getBudgets();
        const idx = list.findIndex(b => b.id === newBudget.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveBudgets(list);
        }
      }
    }).catch(console.warn);
    return newBudget;
  },
  updateBudget: (id: string, budget: Partial<Budget>): Budget | null => {
    const budgets = mockDb.getBudgets();
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) return null;
    budgets[index] = { ...budgets[index], ...budget };
    mockDb.saveBudgets(budgets);

    if (budget.status === BudgetStatus.Confirmed) {
      apiCall('POST', `/budgets/${id}/confirm`, budget).catch(() => {
        apiCall('PUT', `/budgets/${id}`, budget).catch(console.warn);
      });
    } else {
      apiCall('PUT', `/budgets/${id}`, budget).catch(console.warn);
    }

    return budgets[index];
  },
  deleteBudget: (id: string): boolean => {
    const budgets = mockDb.getBudgets().filter(b => b.id !== id);
    mockDb.saveBudgets(budgets);
    apiCall('DELETE', `/budgets/${id}`).catch(console.warn);
    return true;
  },


  // Budgets computation
  computeAchievedAmount: (analyticAccountId: string, startDate: string, endDate: string): number => {
    let achieved = 0;

    const bills = mockDb.getVendorBills();
    bills.forEach(bill => {
      if (bill.status !== VendorBillStatus.Draft && bill.status !== (VendorBillStatus as any).Cancelled) {
        if (bill.billDate >= startDate && bill.billDate <= endDate) {
          bill.lines.forEach(line => {
            if (line.analyticAccountId === analyticAccountId) {
              achieved += (line.qty * line.unitPrice);
            }
          });
        }
      }
    });

    const invoices = mockDb.getCustomerInvoices();
    invoices.forEach(inv => {
      if (inv.status !== CustomerInvoiceStatus.Draft) {
        if (inv.invoiceDate >= startDate && inv.invoiceDate <= endDate) {
          inv.lines.forEach(line => {
            if (line.analyticAccountId === analyticAccountId) {
              achieved += (line.qty * line.unitPrice);
            }
          });
        }
      }
    });
    
    if (analyticAccountId === 'ana1' && achieved === 0 && bills.length === 0) {
      return 10000;
    }

    return achieved;
  },

  // Payment Terms
  getPaymentTerms: (): string[] => JSON.parse(localStorage.getItem(PAYMENT_TERMS_KEY) || '[]'),
  addPaymentTerm: (term: string) => {
    const terms = mockDb.getPaymentTerms();
    if (!terms.includes(term)) {
      terms.push(term);
      localStorage.setItem(PAYMENT_TERMS_KEY, JSON.stringify(terms));
    }
  },

  // Purchase Orders
  getPurchaseOrders: (): PurchaseOrder[] => JSON.parse(localStorage.getItem(PO_KEY) || '[]'),
  savePurchaseOrders: (pos: PurchaseOrder[]) => localStorage.setItem(PO_KEY, JSON.stringify(pos)),
  addPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'number'>): PurchaseOrder => {
    const pos = mockDb.getPurchaseOrders();
    const number = `P${String(pos.length + 1).padStart(5, '0')}`;
    const newPO = { ...po, number, id: Math.random().toString(36).substr(2, 9) };
    pos.push(newPO);
    mockDb.savePurchaseOrders(pos);

    apiCall<PurchaseOrder>('POST', '/purchase-orders', po).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getPurchaseOrders();
        const idx = list.findIndex(p => p.id === newPO.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.savePurchaseOrders(list);
        }
      }
    }).catch(console.warn);

    return newPO;
  },
  updatePurchaseOrder: (id: string, po: Partial<PurchaseOrder>): PurchaseOrder | null => {
    const pos = mockDb.getPurchaseOrders();
    const index = pos.findIndex(p => p.id === id);
    if (index === -1) return null;
    pos[index] = { ...pos[index], ...po };
    mockDb.savePurchaseOrders(pos);

    if (po.status === PurchaseOrderStatus.Confirmed) {
      apiCall('POST', `/purchase-orders/${id}/confirm`, po).catch(() => {
        apiCall('PUT', `/purchase-orders/${id}`, po).catch(console.warn);
      });
    } else {
      apiCall('PUT', `/purchase-orders/${id}`, po).catch(console.warn);
    }

    return pos[index];
  },

  // Vendor Bills
  getVendorBills: (): VendorBill[] => JSON.parse(localStorage.getItem(BILLS_KEY) || '[]'),
  saveVendorBills: (bills: VendorBill[]) => localStorage.setItem(BILLS_KEY, JSON.stringify(bills)),
  addVendorBill: (bill: Omit<VendorBill, 'id' | 'number'>): VendorBill => {
    const bills = mockDb.getVendorBills();
    const number = `Bill/2026/${String(bills.length + 1).padStart(4, '0')}`;
    const newBill = { ...bill, number, id: Math.random().toString(36).substr(2, 9) };
    bills.push(newBill);
    mockDb.saveVendorBills(bills);

    apiCall<VendorBill>('POST', '/vendor-bills', bill).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getVendorBills();
        const idx = list.findIndex(b => b.id === newBill.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveVendorBills(list);
        }
      }
    }).catch(console.warn);

    return newBill;
  },
  updateVendorBill: (id: string, bill: Partial<VendorBill>): VendorBill | null => {
    const bills = mockDb.getVendorBills();
    const index = bills.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    const oldStatus = bills[index].status;
    bills[index] = { ...bills[index], ...bill };
    
    if (oldStatus === VendorBillStatus.Draft && bills[index].status === VendorBillStatus.Confirmed) {
      const total = bills[index].lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
      
      const purchaseJournal = mockDb.getJournals().find(j => j.type === JournalType.Purchase);
      const purchaseAcc = mockDb.getAccounts().find(a => a.type === AccountType.Expenses);
      const credAcc = mockDb.getAccounts().find(a => a.type === AccountType.Liability);
      
      if (purchaseJournal && purchaseAcc && credAcc) {
        mockDb.addJournalEntry({
          date: bills[index].billDate,
          journalId: purchaseJournal.id,
          partnerId: bills[index].vendorId,
          status: JournalEntryStatus.Posted,
          number: '',
          total: total,
          lines: [
            { id: Math.random().toString(), accountId: purchaseAcc.id, partnerId: bills[index].vendorId, debit: total, credit: 0 },
            { id: Math.random().toString(), accountId: credAcc.id, partnerId: bills[index].vendorId, debit: 0, credit: total }
          ]
        });
      }

      apiCall('POST', `/vendor-bills/${id}/confirm`, bill).catch(() => {
        apiCall('PUT', `/vendor-bills/${id}`, bill).catch(console.warn);
      });
    } else {
      apiCall('PUT', `/vendor-bills/${id}`, bill).catch(console.warn);
    }

    mockDb.saveVendorBills(bills);
    return bills[index];
  },

  // Sales Orders
  getSalesOrders: (): SalesOrder[] => JSON.parse(localStorage.getItem(SO_KEY) || '[]'),
  saveSalesOrders: (sos: SalesOrder[]) => localStorage.setItem(SO_KEY, JSON.stringify(sos)),
  addSalesOrder: (so: Omit<SalesOrder, 'id' | 'number'>): SalesOrder => {
    const sos = mockDb.getSalesOrders();
    const number = `S${String(sos.length + 1).padStart(5, '0')}`;
    const newSO = { ...so, number, id: Math.random().toString(36).substr(2, 9) };
    sos.push(newSO);
    mockDb.saveSalesOrders(sos);

    apiCall<SalesOrder>('POST', '/sales-orders', so).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getSalesOrders();
        const idx = list.findIndex(s => s.id === newSO.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveSalesOrders(list);
        }
      }
    }).catch(console.warn);

    return newSO;
  },
  updateSalesOrder: (id: string, so: Partial<SalesOrder>): SalesOrder | null => {
    const sos = mockDb.getSalesOrders();
    const index = sos.findIndex(s => s.id === id);
    if (index === -1) return null;
    sos[index] = { ...sos[index], ...so };
    mockDb.saveSalesOrders(sos);

    if (so.status === SalesOrderStatus.Confirmed) {
      apiCall('POST', `/sales-orders/${id}/confirm`, so).catch(() => {
        apiCall('PUT', `/sales-orders/${id}`, so).catch(console.warn);
      });
    } else {
      apiCall('PUT', `/sales-orders/${id}`, so).catch(console.warn);
    }

    return sos[index];
  },

  // Customer Invoices
  getCustomerInvoices: (): CustomerInvoice[] => JSON.parse(localStorage.getItem(INVOICES_KEY) || '[]'),
  saveCustomerInvoices: (invoices: CustomerInvoice[]) => localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices)),
  addCustomerInvoice: (invoice: Omit<CustomerInvoice, 'id' | 'number'>): CustomerInvoice => {
    const invoices = mockDb.getCustomerInvoices();
    const number = `INV/2026/${String(invoices.length + 1).padStart(4, '0')}`;
    const newInvoice = { ...invoice, number, id: Math.random().toString(36).substr(2, 9) };
    invoices.push(newInvoice);
    mockDb.saveCustomerInvoices(invoices);

    apiCall<CustomerInvoice>('POST', '/customer-invoices', invoice).then(saved => {
      if (saved && saved.id) {
        const list = mockDb.getCustomerInvoices();
        const idx = list.findIndex(i => i.id === newInvoice.id);
        if (idx !== -1) {
          list[idx] = saved;
          mockDb.saveCustomerInvoices(list);
        }
      }
    }).catch(console.warn);

    return newInvoice;
  },
  updateCustomerInvoice: (id: string, invoice: Partial<CustomerInvoice>): CustomerInvoice | null => {
    const invoices = mockDb.getCustomerInvoices();
    const index = invoices.findIndex(i => i.id === id);
    if (index === -1) return null;
    
    const oldStatus = invoices[index].status;
    invoices[index] = { ...invoices[index], ...invoice };
    
    if (oldStatus === CustomerInvoiceStatus.Draft && invoices[index].status === CustomerInvoiceStatus.Confirmed) {
      const total = invoices[index].lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
      
      const salesJournal = mockDb.getJournals().find(j => j.type === JournalType.Sales);
      const salesAcc = mockDb.getAccounts().find(a => a.type === AccountType.Income);
      const debAcc = mockDb.getAccounts().find(a => a.type === AccountType.Asset && a.name.includes('Debtors'));
      
      if (salesJournal && salesAcc && debAcc) {
        mockDb.addJournalEntry({
          date: invoices[index].invoiceDate,
          journalId: salesJournal.id,
          partnerId: invoices[index].customerId,
          status: JournalEntryStatus.Posted,
          number: '',
          total: total,
          lines: [
            { id: Math.random().toString(), accountId: debAcc.id, partnerId: invoices[index].customerId, debit: total, credit: 0 },
            { id: Math.random().toString(), accountId: salesAcc.id, partnerId: invoices[index].customerId, debit: 0, credit: total }
          ]
        });
      }

      apiCall('POST', `/customer-invoices/${id}/confirm`, invoice).catch(() => {
        apiCall('PUT', `/customer-invoices/${id}`, invoice).catch(console.warn);
      });
    } else {
      apiCall('PUT', `/customer-invoices/${id}`, invoice).catch(console.warn);
    }

    mockDb.saveCustomerInvoices(invoices);
    return invoices[index];
  },

  // Payments
  getPayments: (): Payment[] => JSON.parse(localStorage.getItem(PAYMENTS_KEY) || '[]'),
  savePayments: (payments: Payment[]) => localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments)),
  addPayment: (payment: Omit<Payment, 'id'>): Payment => {
    const payments = mockDb.getPayments();
    const newPayment = { ...payment, id: Math.random().toString(36).substr(2, 9) };
    payments.push(newPayment);
    mockDb.savePayments(payments);

    if (newPayment.billId) {
      const bills = mockDb.getVendorBills();
      const billIndex = bills.findIndex(b => b.id === newPayment.billId);
      if (billIndex !== -1) {
        const bill = bills[billIndex];
        bill.amountPaid += newPayment.amount;
        if (newPayment.via === PaymentVia.Cash) bill.cashPaid += newPayment.amount;
        else bill.bankPaid += newPayment.amount;

        const total = bill.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        
        if (bill.amountPaid >= total) bill.status = VendorBillStatus.Paid;
        else if (bill.amountPaid > 0) bill.status = VendorBillStatus.PartiallyPaid;

        mockDb.saveVendorBills(bills);
      }
    }

    if (newPayment.invoiceId) {
      const invoices = mockDb.getCustomerInvoices();
      const invIndex = invoices.findIndex(i => i.id === newPayment.invoiceId);
      if (invIndex !== -1) {
        const inv = invoices[invIndex];
        inv.amountPaid += newPayment.amount;
        if (newPayment.via === PaymentVia.Cash) inv.cashPaid += newPayment.amount;
        else inv.bankPaid += newPayment.amount;

        const total = inv.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        
        if (inv.amountPaid >= total) inv.status = CustomerInvoiceStatus.Paid;
        else if (inv.amountPaid > 0) inv.status = CustomerInvoiceStatus.PartiallyPaid;

        mockDb.saveCustomerInvoices(invoices);
      }
    }

    // Backend Payment persistence
    const journalType = newPayment.via === PaymentVia.Cash ? JournalType.Cash : JournalType.Bank;
    const journals = mockDb.getJournals();
    const targetJournal = journals.find(j => j.type === journalType);

    apiCall('POST', '/payments', {
      type: newPayment.type,
      paymentType: newPayment.type,
      partnerId: newPayment.partnerId,
      amount: newPayment.amount,
      date: newPayment.date,
      via: newPayment.via,
      paymentMethod: newPayment.via,
      note: newPayment.note || '',
      billId: newPayment.billId,
      invoiceId: newPayment.invoiceId,
      documentType: newPayment.billId ? 'VendorBill' : 'CustomerInvoice',
      documentId: newPayment.billId || newPayment.invoiceId,
      razorpayOrderId: newPayment.razorpayOrderId,
      razorpayPaymentId: newPayment.razorpayPaymentId,
    }).catch(console.warn);

    return newPayment;
  },

  // Reporting
  computeAccountBalance: (accountId: string, year: string): number => {
    const entries = mockDb.getJournalEntries();
    const account = mockDb.getAccounts().find(a => a.id === accountId || (a as any)._id === accountId || a.name === accountId);
    if (!account) return 0;

    let balance = 0;
    entries.forEach(entry => {
      if (entry.status === JournalEntryStatus.Posted && (!year || entry.date.startsWith(year))) {
        (entry.lines || []).forEach(line => {
          if (line.accountId === account.id || line.accountId === (account as any)._id || line.accountId === account.name) {
            if ([AccountType.Asset, AccountType.Expenses, AccountType.OtherExpenses, AccountType.Bank, AccountType.Cash].includes(account.type)) {
              balance += ((Number(line.debit) || 0) - (Number(line.credit) || 0));
            } 
            else {
              balance += ((Number(line.credit) || 0) - (Number(line.debit) || 0));
            }
          }
        });
      }
    });
    return Math.round(balance * 100) / 100;
  }
};
