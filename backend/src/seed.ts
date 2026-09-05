import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Contact } from './models/Contact.js';
import { Category } from './models/Category.js';
import { Product } from './models/Product.js';
import { VendorProduct } from './models/VendorProduct.js';
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
  VendorBillStatus,
  PurchaseOrderStatus,
  SalesOrderStatus,
  PaymentType as PType,
  PaymentVia,
} from './types/index.js';

dotenv.config();

// Helper to batch insert documents in chunks
async function insertInChunks<T>(model: any, docs: T[], chunkSize = 1000): Promise<any[]> {
  const allInserted: any[] = [];
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const inserted = await model.insertMany(chunk, { ordered: false });
    allInserted.push(...inserted);
  }
  return allInserted;
}

export const seedDatabase = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('[Seed] Connected to MongoDB. Starting database high-volume bulk seeding (20,000+ records)...');

    // 1. Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Contact.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      VendorProduct.deleteMany({}),
      Account.deleteMany({}),
      Journal.deleteMany({}),
      JournalEntry.deleteMany({}),
      AnalyticAccount.deleteMany({}),
      Budget.deleteMany({}),
      PurchaseOrder.deleteMany({}),
      VendorBill.deleteMany({}),
      SalesOrder.deleteMany({}),
      CustomerInvoice.deleteMany({}),
      Payment.deleteMany({}),
      PaymentTerm.deleteMany({}),
      SequenceCounter.deleteMany({}),
    ]);
    console.log('[Seed] Cleared existing collections.');

    // 2. Seed Categories (10 categories)
    const categoriesData = [
      { name: 'Office Furniture' },
      { name: 'Living Room Furniture' },
      { name: 'Bedroom Furniture' },
      { name: 'Dining & Kitchen' },
      { name: 'Raw Timber & Wood' },
      { name: 'Hardware & Fittings' },
      { name: 'Upholstery & Fabrics' },
      { name: 'Electronics & Appliances' },
      { name: 'Consulting & Services' },
      { name: 'Storage & Organization' },
    ];
    const categories = await Category.insertMany(categoriesData);
    const catOffice = categories[0]._id.toString();
    const catLiving = categories[1]._id.toString();
    const catWood = categories[4]._id.toString();
    const catHardware = categories[5]._id.toString();

    // 3. Seed Chart of Accounts (15 Accounts - sensible/clean size)
    const accountsData = [
      { name: 'HDFC Bank', type: AccountType.Bank },
      { name: 'Cash', type: AccountType.Cash },
      { name: 'Cost of Goods Sold (Purchases)', type: AccountType.Expenses },
      { name: 'Furniture Sales', type: AccountType.Income },
      { name: 'Debtors A/c', type: AccountType.Asset },
      { name: 'Creditors A/c', type: AccountType.Liability },
      { name: 'Capital A/c', type: AccountType.Capital },
      { name: 'Office Supplies & Logistics', type: AccountType.Expenses },
      { name: 'Consulting & Services Revenue', type: AccountType.Income },
      { name: 'Rent & Utility Expenses', type: AccountType.OtherExpenses },
      { name: 'Marketing & Advertising', type: AccountType.Expenses },
      { name: 'State Bank of India', type: AccountType.Bank },
      { name: 'GST Input Tax Credit', type: AccountType.Asset },
      { name: 'GST Output Liability', type: AccountType.Liability },
      { name: 'Equipment & Machinery', type: AccountType.Asset },
    ];
    const accounts = await Account.insertMany(accountsData);
    const accBank = accounts[0];
    const accCash = accounts[1];
    const accPurchase = accounts[2];
    const accSales = accounts[3];
    const accDebtors = accounts[4];
    const accCreditors = accounts[5];
    const accCapital = accounts[6];
    const accRent = accounts[9];

    // 4. Seed Journals (4 Journals)
    const journalsData = [
      { name: 'Bank Journal', type: JournalType.Bank, defaultAccountId: accBank._id.toString() },
      { name: 'Cash Journal', type: JournalType.Cash, defaultAccountId: accCash._id.toString() },
      { name: 'Purchase Journal', type: JournalType.Purchase, defaultAccountId: accPurchase._id.toString() },
      { name: 'Sales Journal', type: JournalType.Sales, defaultAccountId: accSales._id.toString() },
    ];
    const journals = await Journal.insertMany(journalsData);
    const jBank = journals[0];
    const jCash = journals[1];
    const jPurchase = journals[2];
    const jSales = journals[3];

    // 5. Seed Contacts (2,000 contacts: 1,000 Vendors + 1,000 Customers)
    const cities = ['Mumbai', 'Delhi', 'Bengaluru', 'Ahmedabad', 'Pune', 'Surat', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur', 'Indore', 'Vadodara', 'Nagpur', 'Coimbatore', 'Chandigarh'];
    const vendorPrefixes = ['Apex', 'Royal', 'Shree', 'Global', 'National', 'Classic', 'Metro', 'Urban', 'Elite', 'Zenith', 'Prabhat', 'Siddhi', 'Omkar', 'Vanguard', 'Pinnacle', 'Radiant', 'Bharat', 'Mahalaxmi'];
    const vendorSuffixes = ['Timbers & Woods', 'Steel & Hardware Fittings', 'Foam & Upholstery Works', 'Laminates & Veneers', 'Furniture Crafts', 'Logistics & Supply', 'Fabrics & Leather', 'Plywood Industries', 'Precision Fasteners', 'Modular Systems'];
    
    const customerFirstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Saanvi', 'Riya', 'Kavya', 'Pooja', 'Neha', 'Priya', 'Sneha', 'Rahul', 'Vrushant', 'Rudra', 'Rohan', 'Kunal', 'Manish', 'Deepak', 'Vikram', 'Anil', 'Sanjay', 'Gaurav', 'Nikhil', 'Tanvi', 'Isha', 'Meera', 'Roshni'];
    const customerLastNames = ['Shah', 'Patel', 'Mehta', 'Sharma', 'Verma', 'Joshi', 'Desai', 'Kulkarni', 'Iyer', 'Nair', 'Reddy', 'Chauhan', 'Gupta', 'Singh', 'Agarwal', 'Bansal', 'Malhotra', 'Bhatia', 'Trivedi', 'Pandey', 'Mishra', 'Choudhary', 'Menon'];

    const contactsBatch: any[] = [
      // Demo accounts
      {
        name: 'Rahul Vendor Supplies',
        type: ContactType.Vendor,
        email: 'vendor123@urbanfin.com',
        phone: '+91 98250 11223',
        gstNumber: '24AAAAA0000A1Z5',
        hasPortalAccess: true,
        address: { street: '101 Industrial Estate', city: 'Ahmedabad', state: 'Gujarat', zip: '380015', country: 'India' }
      },
      {
        name: 'John Customer Enterprises',
        type: ContactType.Customer,
        email: 'johnuser@urbanfin.com',
        phone: '+91 98765 43210',
        gstNumber: '27AABCU9603R1ZM',
        hasPortalAccess: true,
        address: { street: '402 Skyline Towers', city: 'Mumbai', state: 'Maharashtra', zip: '400001', country: 'India' }
      },
    ];

    // Generate 999 additional Vendors (Total: 1,000 Vendors)
    for (let i = 1; i < 1000; i++) {
      const pfx = vendorPrefixes[i % vendorPrefixes.length];
      const sfx = vendorSuffixes[(i * 3) % vendorSuffixes.length];
      const city = cities[i % cities.length];
      contactsBatch.push({
        name: `${pfx} ${sfx} Unit-${i}`,
        type: ContactType.Vendor,
        email: `supplier_${i}@vendornetwork.in`,
        phone: `+91 ${98000 + (i % 999)} ${String(10000 + (i * 73) % 90000)}`,
        gstNumber: `${24 + (i % 5)}AAAA${String(1000 + i).slice(-4)}A1Z${i % 9}`,
        hasPortalAccess: i <= 50,
        address: {
          street: `Plot ${10 + (i % 200)}, Phase ${1 + (i % 4)} GIDC Industrial Zone`,
          city,
          state: city === 'Mumbai' || city === 'Pune' || city === 'Nagpur' ? 'Maharashtra' : city === 'Ahmedabad' || city === 'Surat' || city === 'Vadodara' ? 'Gujarat' : 'Karnataka',
          zip: `400${String(100 + (i % 900)).slice(-3)}`,
          country: 'India'
        }
      });
    }

    // Generate 999 additional Customers (Total: 1,000 Customers)
    for (let i = 1; i < 1000; i++) {
      const fn = customerFirstNames[i % customerFirstNames.length];
      const ln = customerLastNames[(i * 3) % customerLastNames.length];
      const city = cities[(i * 2) % cities.length];
      contactsBatch.push({
        name: `${fn} ${ln} ${i % 3 === 0 ? 'Enterprises' : i % 5 === 0 ? 'Pvt Ltd' : 'Trading'}`,
        type: ContactType.Customer,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}_${i}@businessmail.com`,
        phone: `+91 ${97000 + (i % 999)} ${String(20000 + (i * 91) % 80000)}`,
        gstNumber: `${27 + (i % 4)}BBBB${String(2000 + i).slice(-4)}B2Z${i % 8}`,
        hasPortalAccess: i <= 50,
        address: {
          street: `${100 + (i % 300)}, Commercial Hub, Sector ${1 + (i % 25)}`,
          city,
          state: city === 'Mumbai' || city === 'Pune' ? 'Maharashtra' : city === 'Ahmedabad' || city === 'Surat' ? 'Gujarat' : 'Delhi',
          zip: `380${String(200 + (i % 800)).slice(-3)}`,
          country: 'India'
        }
      });
    }

    const contacts = await insertInChunks(Contact, contactsBatch);
    const vendorContacts = contacts.filter(c => c.type === ContactType.Vendor);
    const customerContacts = contacts.filter(c => c.type === ContactType.Customer);
    console.log(`[Seed] Seeded ${contacts.length} Contacts (${vendorContacts.length} Vendors, ${customerContacts.length} Customers).`);

    // 6. Seed Users
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('Password@123', salt);

    const usersData = [
      { name: 'Master Administrator', loginId: 'admin123', email: 'admin@urbanfin.com', passwordHash: defaultPasswordHash, role: Role.MasterAdmin, isSuspended: false },
      { name: 'Sub Admin Operations', loginId: 'subadmin', email: 'subadmin@urbanfin.com', passwordHash: defaultPasswordHash, role: Role.SubAdmin, isSuspended: false },
      { name: 'Rahul Vendor', loginId: 'vendor123', email: 'vendor123@urbanfin.com', passwordHash: defaultPasswordHash, role: Role.Vendor, contactId: vendorContacts[0]._id.toString(), isSuspended: false },
      { name: 'Senior Accountant', loginId: 'account123', email: 'account123@urbanfin.com', passwordHash: defaultPasswordHash, role: Role.Accountant, isSuspended: false },
      { name: 'John Customer', loginId: 'johnuser', email: 'johnuser@urbanfin.com', passwordHash: defaultPasswordHash, role: Role.User, contactId: customerContacts[0]._id.toString(), isSuspended: false },
    ];

    for (let i = 1; i <= 20; i++) {
      if (vendorContacts[i]) {
        usersData.push({
          name: vendorContacts[i].name,
          loginId: `vendor_${i}`,
          email: vendorContacts[i].email,
          passwordHash: defaultPasswordHash,
          role: Role.Vendor,
          contactId: vendorContacts[i]._id.toString(),
          isSuspended: false,
        });
      }
    }

    await User.insertMany(usersData);
    console.log(`[Seed] Seeded ${usersData.length} Users with authentication credentials.`);

    // 7. Seed Products (500 Master Catalog Products)
    const productItemNames = [
      'Ergonomic Mesh High-Back Chair', 'Executive Leather Recliner Desk Chair', 'Solid Teak Wood Executive Desk',
      'Conference Room 8-Seater Table', 'Modern L-Shaped Corner Workstation', 'Compact Minimalist Study Desk',
      'Dual Motor Electric Height Adjustable Desk', '3-Drawer Mobile Metal File Pedestal', 'Bookshelf Display Cabinet Glass Door',
      'Velvet 3-Seater Living Room Sofa', 'Chesterfield Genuine Leather Sofa', 'King Size Solid Sheesham Bed Frame',
      'Queen Size Upholstered Platform Bed', '4-Door Modular Wooden Wardrobe', '6-Seater Solid Oak Dining Table Set',
      'Industrial Steel Storage Rack 5-Tier', 'Tempered Glass Coffee Table', 'Wall Mounted Floating TV Unit',
      'Lounge Accent Armchair Fabric', 'Heavy Duty Office Reception Counter Desk', 'Ergonomic Footrest Cushion',
      'Solid Mahogany Timber Plank (Per Bundle)', 'BIFMA Certified Gas Lift Hydraulic Cylinder', 'Heavy Duty Castor Wheels (Set of 5)',
      'High-Density Polyurethane Foam Block', 'Marine Grade Plywood Sheet 18mm', 'Matte Black Aluminum Handles & Hinges',
      'Acoustic Felt Privacy Desk Divider', 'Under-Desk Cable Management Spine Tray', 'LED Anti-Glare Studio Desk Lamp'
    ];

    const productsBatch: any[] = [];
    for (let i = 0; i < 500; i++) {
      const baseName = productItemNames[i % productItemNames.length];
      const modelNum = String(100 + i);
      const isService = i % 25 === 0;
      const isConsumable = i % 15 === 0;
      const catId = isService ? categories[8]._id.toString() : i % 3 === 0 ? catOffice : i % 4 === 0 ? catWood : catLiving;
      
      const cost = Math.round(1500 + ((i * 370) % 45000));
      const salesPrice = Math.round(cost * 1.35);

      productsBatch.push({
        name: i < productItemNames.length ? baseName : `${baseName} (Series ${modelNum})`,
        type: isService ? ProductType.Service : isConsumable ? ProductType.Combo : ProductType.Goods,
        categoryId: catId,
        salesPrice,
        cost,
        image: undefined,
      });
    }
    const products = await insertInChunks(Product, productsBatch);
    console.log(`[Seed] Seeded ${products.length} Products.`);

    // 8. Seed Vendor Products (2,500 Vendor Sourcing Offerings)
    const vendorProductsBatch: any[] = [];
    for (let i = 0; i < 2500; i++) {
      const vendor = vendorContacts[i % vendorContacts.length];
      const prod = products[i % products.length];
      const wholesalePrice = Math.round(prod.cost * 0.95);
      const stock = 10 + ((i * 29) % 650);

      vendorProductsBatch.push({
        vendorId: vendor._id.toString(),
        name: prod.name,
        categoryId: prod.categoryId,
        price: wholesalePrice,
        stockQuantity: stock,
        description: `Direct wholesale batch supply from ${vendor.name}. High precision finish, QA verified.`,
        image: undefined,
      });
    }
    await insertInChunks(VendorProduct, vendorProductsBatch);
    console.log(`[Seed] Seeded ${vendorProductsBatch.length} Vendor Supply Offerings.`);

    // 9. Seed Analytic Accounts & Budgets
    const analyticsData = [
      { name: 'Corporate Office HQ Project', type: AnalyticAccountType.Income },
      { name: 'Retail Store Showroom Fitouts', type: AnalyticAccountType.Income },
      { name: 'Institutional School Furniture Project', type: AnalyticAccountType.Income },
      { name: 'R&D Ergonomic Chair Line Prototype', type: AnalyticAccountType.Expenses },
      { name: 'Direct Factory Timber Sourcing', type: AnalyticAccountType.Expenses },
      { name: 'Digital Marketing & Social Ads', type: AnalyticAccountType.Expenses },
      { name: 'Export Furniture Packaging & Freight', type: AnalyticAccountType.Expenses },
      { name: 'Showroom Interior Remodeling', type: AnalyticAccountType.Expenses },
      { name: 'Quality Testing & Automation Hub', type: AnalyticAccountType.Expenses },
      { name: 'Tier-2 Warehousing & Hub Logistics', type: AnalyticAccountType.Expenses }
    ];
    const analytics = await AnalyticAccount.insertMany(analyticsData);

    const budgetsData = [
      {
        name: 'FY 2026 Q1 Growth & Operations Budget',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        responsibleId: vendorContacts[0]._id.toString(),
        status: BudgetStatus.Confirmed,
        lines: [
          { id: 'bline1', analyticAccountId: analytics[0]._id.toString(), type: AnalyticAccountType.Income, committedAmount: 500000, achievedAmount: 380000 },
          { id: 'bline2', analyticAccountId: analytics[3]._id.toString(), type: AnalyticAccountType.Expenses, committedAmount: 180000, achievedAmount: 145000 },
          { id: 'bline3', analyticAccountId: analytics[4]._id.toString(), type: AnalyticAccountType.Expenses, committedAmount: 300000, achievedAmount: 260000 },
        ]
      },
      {
        name: 'FY 2026 Q2 Showroom & Export Expansion',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        responsibleId: vendorContacts[1]._id.toString(),
        status: BudgetStatus.Draft,
        lines: [
          { id: 'bline4', analyticAccountId: analytics[1]._id.toString(), type: AnalyticAccountType.Income, committedAmount: 850000, achievedAmount: 0 },
          { id: 'bline5', analyticAccountId: analytics[6]._id.toString(), type: AnalyticAccountType.Expenses, committedAmount: 220000, achievedAmount: 0 },
        ]
      },
      {
        name: 'FY 2025 Annual Core Operations Review',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        responsibleId: vendorContacts[2]._id.toString(),
        status: BudgetStatus.Confirmed,
        lines: [
          { id: 'bline6', analyticAccountId: analytics[0]._id.toString(), type: AnalyticAccountType.Income, committedAmount: 1200000, achievedAmount: 1150000 },
          { id: 'bline7', analyticAccountId: analytics[4]._id.toString(), type: AnalyticAccountType.Expenses, committedAmount: 800000, achievedAmount: 760000 },
        ]
      }
    ];
    await Budget.insertMany(budgetsData);
    console.log(`[Seed] Seeded ${analytics.length} Analytic Accounts & Budgets.`);

    // 10. Seed Purchase Orders (2,500 POs)
    const poStatuses = [
      PurchaseOrderStatus.Confirmed,
      PurchaseOrderStatus.Accepted,
      PurchaseOrderStatus.SentToVendor,
      PurchaseOrderStatus.Draft,
    ];
    const poBatch: any[] = [];
    for (let i = 1; i <= 2500; i++) {
      const vendor = vendorContacts[i % vendorContacts.length];
      const prod1 = products[i % products.length];
      const prod2 = products[(i * 3) % products.length];
      const status = poStatuses[i % poStatuses.length];
      const month = String(1 + (i % 12)).padStart(2, '0');
      const day = String(1 + ((i * 7) % 28)).padStart(2, '0');
      const year = i % 4 === 0 ? '2025' : '2026';

      poBatch.push({
        number: `P${String(i).padStart(5, '0')}`,
        vendorId: vendor._id.toString(),
        date: `${year}-${month}-${day}`,
        paymentTerms: i % 2 === 0 ? '15 Days' : 'Immediate Payment',
        status,
        lines: [
          {
            id: `line_po_${i}_1`,
            productId: prod1._id.toString(),
            analyticAccountId: analytics[i % analytics.length]._id.toString(),
            qty: 2 + (i % 15),
            unitPrice: prod1.cost,
          },
          {
            id: `line_po_${i}_2`,
            productId: prod2._id.toString(),
            analyticAccountId: analytics[(i + 1) % analytics.length]._id.toString(),
            qty: 1 + ((i * 2) % 10),
            unitPrice: prod2.cost,
          }
        ]
      });
    }
    const createdPOs = await insertInChunks(PurchaseOrder, poBatch);
    console.log(`[Seed] Seeded ${createdPOs.length} Purchase Orders.`);

    // 11. Seed Vendor Bills (2,500 Bills)
    const billStatuses = [
      VendorBillStatus.Paid,
      VendorBillStatus.Confirmed,
      VendorBillStatus.PartiallyPaid,
      VendorBillStatus.Draft,
    ];
    const billBatch: any[] = [];
    for (let i = 1; i <= 2500; i++) {
      const vendor = vendorContacts[i % vendorContacts.length];
      const prod1 = products[(i * 2) % products.length];
      const status = billStatuses[i % billStatuses.length];
      const month = String(1 + (i % 12)).padStart(2, '0');
      const day = String(1 + ((i * 5) % 28)).padStart(2, '0');
      const year = i % 3 === 0 ? '2025' : '2026';
      const qty1 = 3 + (i % 12);
      const totalAmount = qty1 * prod1.cost;

      let amountPaid = 0;
      let cashPaid = 0;
      let bankPaid = 0;

      if (status === VendorBillStatus.Paid) {
        amountPaid = totalAmount;
        if (i % 2 === 0) bankPaid = totalAmount;
        else cashPaid = totalAmount;
      } else if (status === VendorBillStatus.PartiallyPaid) {
        amountPaid = Math.round(totalAmount / 2);
        bankPaid = amountPaid;
      }

      billBatch.push({
        number: `Bill/${year}/${String(i).padStart(5, '0')}`,
        vendorId: vendor._id.toString(),
        billReference: `P${String(i).padStart(5, '0')}`,
        billDate: `${year}-${month}-${day}`,
        dueDate: `${year}-${month}-${String(Math.min(28, Number(day) + 14)).padStart(2, '0')}`,
        poReferenceId: createdPOs[i - 1]?._id.toString(),
        status,
        lines: [
          {
            id: `line_vb_${i}_1`,
            productId: prod1._id.toString(),
            accountId: accPurchase._id.toString(),
            analyticAccountId: analytics[i % analytics.length]._id.toString(),
            qty: qty1,
            unitPrice: prod1.cost,
          }
        ],
        amountPaid,
        cashPaid,
        bankPaid,
      });
    }
    const createdBills = await insertInChunks(VendorBill, billBatch);
    console.log(`[Seed] Seeded ${createdBills.length} Vendor Bills.`);

    // 12. Seed Sales Orders (2,500 SOs)
    const soStatuses = [SalesOrderStatus.Confirmed, SalesOrderStatus.Draft];
    const soBatch: any[] = [];
    for (let i = 1; i <= 2500; i++) {
      const customer = customerContacts[i % customerContacts.length];
      const prod1 = products[(i * 4) % products.length];
      const month = String(1 + (i % 12)).padStart(2, '0');
      const day = String(1 + ((i * 3) % 28)).padStart(2, '0');
      const year = i % 4 === 0 ? '2025' : '2026';

      soBatch.push({
        number: `S${String(i).padStart(5, '0')}`,
        customerId: customer._id.toString(),
        date: `${year}-${month}-${day}`,
        status: soStatuses[i % soStatuses.length],
        lines: [
          {
            id: `line_so_${i}_1`,
            productId: prod1._id.toString(),
            analyticAccountId: analytics[i % analytics.length]._id.toString(),
            qty: 1 + (i % 6),
            unitPrice: prod1.salesPrice,
          }
        ]
      });
    }
    const createdSOs = await insertInChunks(SalesOrder, soBatch);
    console.log(`[Seed] Seeded ${createdSOs.length} Sales Orders.`);

    // 13. Seed Customer Invoices (2,500 Invoices)
    const invStatuses = [
      CustomerInvoiceStatus.Paid,
      CustomerInvoiceStatus.Confirmed,
      CustomerInvoiceStatus.PartiallyPaid,
      CustomerInvoiceStatus.Draft,
    ];
    const invBatch: any[] = [];
    for (let i = 1; i <= 2500; i++) {
      const customer = customerContacts[i % customerContacts.length];
      const prod1 = products[(i * 5) % products.length];
      const status = invStatuses[i % invStatuses.length];
      const month = String(1 + (i % 12)).padStart(2, '0');
      const day = String(1 + ((i * 9) % 28)).padStart(2, '0');
      const year = i % 3 === 0 ? '2025' : '2026';
      const qty1 = 2 + (i % 5);
      const totalAmount = qty1 * prod1.salesPrice;

      let amountPaid = 0;
      let cashPaid = 0;
      let bankPaid = 0;

      if (status === CustomerInvoiceStatus.Paid) {
        amountPaid = totalAmount;
        if (i % 2 === 0) bankPaid = totalAmount;
        else cashPaid = totalAmount;
      } else if (status === CustomerInvoiceStatus.PartiallyPaid) {
        amountPaid = Math.round(totalAmount / 2);
        bankPaid = amountPaid;
      }

      invBatch.push({
        number: `INV/${year}/${String(i).padStart(5, '0')}`,
        customerId: customer._id.toString(),
        invoiceReference: `S${String(i).padStart(5, '0')}`,
        invoiceDate: `${year}-${month}-${day}`,
        dueDate: `${year}-${month}-${String(Math.min(28, Number(day) + 15)).padStart(2, '0')}`,
        soReferenceId: createdSOs[i - 1]?._id.toString(),
        status,
        lines: [
          {
            id: `line_inv_${i}_1`,
            productId: prod1._id.toString(),
            accountId: accSales._id.toString(),
            analyticAccountId: analytics[i % analytics.length]._id.toString(),
            qty: qty1,
            unitPrice: prod1.salesPrice,
          }
        ],
        amountPaid,
        cashPaid,
        bankPaid,
      });
    }
    const createdInvoices = await insertInChunks(CustomerInvoice, invBatch);
    console.log(`[Seed] Seeded ${createdInvoices.length} Customer Invoices.`);

    // 14. Seed Payments & Receipts (2,500 Records)
    const paymentsBatch: any[] = [];
    for (let i = 1; i <= 2500; i++) {
      const isReceipt = i % 2 === 0;
      const partner = isReceipt ? customerContacts[i % customerContacts.length] : vendorContacts[i % vendorContacts.length];
      const linkedDoc = isReceipt ? createdInvoices[i - 1] : createdBills[i - 1];
      const amount = 5000 + ((i * 1230) % 45000);
      const month = String(1 + (i % 12)).padStart(2, '0');
      const day = String(1 + ((i * 11) % 28)).padStart(2, '0');
      const year = i % 3 === 0 ? '2025' : '2026';

      paymentsBatch.push({
        type: isReceipt ? PType.Receive : PType.Send,
        partnerId: partner._id.toString(),
        amount,
        date: `${year}-${month}-${day}`,
        via: i % 3 === 0 ? PaymentVia.Cash : PaymentVia.Bank,
        note: isReceipt ? `Sales invoice settlement for ${partner.name}` : `Vendor bill settlement payout to ${partner.name}`,
        billId: !isReceipt ? linkedDoc?._id.toString() : undefined,
        invoiceId: isReceipt ? linkedDoc?._id.toString() : undefined,
      });
    }
    await insertInChunks(Payment, paymentsBatch);
    console.log(`[Seed] Seeded ${paymentsBatch.length} Payments & Receipts.`);

    // 15. Seed Balanced Journal Entries (2,500 Entries: Balanced Debits = Credits)
    const journalEntriesBatch: any[] = [];
    for (let i = 1; i <= 2500; i++) {
      const isSales = i % 3 === 0;
      const isPurchase = i % 3 === 1;
      const journal = isSales ? jSales : isPurchase ? jPurchase : (i % 2 === 0 ? jBank : jCash);
      const partner = isSales ? customerContacts[i % customerContacts.length] : vendorContacts[i % vendorContacts.length];
      const amount = 10000 + ((i * 1750) % 95000);
      const month = String(1 + (i % 12)).padStart(2, '0');
      const day = String(1 + ((i * 13) % 28)).padStart(2, '0');
      const year = i % 3 === 0 ? '2025' : '2026';

      const lines: any[] = [];
      if (isSales) {
        // Sales: Debit Debtors / Bank, Credit Furniture Sales
        lines.push({
          id: `jl_${i}_1`,
          accountId: accDebtors._id.toString(),
          partnerId: partner._id.toString(),
          debit: amount,
          credit: 0,
        });
        lines.push({
          id: `jl_${i}_2`,
          accountId: accSales._id.toString(),
          partnerId: partner._id.toString(),
          debit: 0,
          credit: amount,
        });
      } else if (isPurchase) {
        // Purchase: Debit Cost of Goods Sold, Credit Creditors
        lines.push({
          id: `jl_${i}_1`,
          accountId: accPurchase._id.toString(),
          partnerId: partner._id.toString(),
          debit: amount,
          credit: 0,
        });
        lines.push({
          id: `jl_${i}_2`,
          accountId: accCreditors._id.toString(),
          partnerId: partner._id.toString(),
          debit: 0,
          credit: amount,
        });
      } else {
        // Operational / Rent / Capital
        lines.push({
          id: `jl_${i}_1`,
          accountId: accRent._id.toString(),
          partnerId: partner._id.toString(),
          debit: amount,
          credit: 0,
        });
        lines.push({
          id: `jl_${i}_2`,
          accountId: accBank._id.toString(),
          partnerId: partner._id.toString(),
          debit: 0,
          credit: amount,
        });
      }

      journalEntriesBatch.push({
        number: `JRNL/${year}/${String(i).padStart(5, '0')}`,
        journalId: journal._id.toString(),
        partnerId: partner._id.toString(),
        date: `${year}-${month}-${day}`,
        status: JournalEntryStatus.Posted,
        total: amount,
        lines,
      });
    }
    await insertInChunks(JournalEntry, journalEntriesBatch);
    console.log(`[Seed] Seeded ${journalEntriesBatch.length} Balanced Journal Entries.`);

    // 16. Seed Payment Terms & Sequence Counters
    const terms = [
      { name: 'Immediate Payment' },
      { name: '15 Days' },
      { name: '30 Days' },
      { name: 'End of Following Month' },
    ];
    await PaymentTerm.insertMany(terms);

    await SequenceCounter.insertMany([
      { key: 'PO', seq: 2500 },
      { key: 'SO', seq: 2500 },
      { key: 'BILL_2026', seq: 2500 },
      { key: 'INV_2026', seq: 2500 },
      { key: 'JRNL_2026', seq: 2500 },
    ]);

    console.log('===============================================================');
    console.log('[Seed] High-Performance Database Bulk Seeding Completed!');
    console.log(`[Seed] Total Dataset Size: ~20,000+ records in MongoDB Atlas.`);
    console.log('===============================================================');
  } catch (error) {
    console.error('[Seed] Bulk Seeding Error:', error);
    throw error;
  }
};

export const ensureSeeded = async (): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Seed] Database is empty. Running initial database seeding...');
      await seedDatabase();
    }
  } catch (error) {
    console.error('[Seed] Error in ensureSeeded:', error);
  }
};

if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Process finished successfully. Exiting...');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Process exited with error:', err);
      process.exit(1);
    });
}
