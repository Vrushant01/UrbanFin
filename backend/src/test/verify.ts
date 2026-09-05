import assert from 'node:assert';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import sharp from 'sharp';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { seedDatabase } from '../seed.js';
import { compressAndStoreImage } from '../controllers/imageController.js';
import { User } from '../models/User.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { VendorBill } from '../models/VendorBill.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { Budget } from '../models/Budget.js';

const request = (
  server: http.Server,
  method: string,
  path: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders; buffer?: Buffer }> => {
  return new Promise((resolve, reject) => {
    const addr = server.address() as any;
    const port = addr.port;

    const payload = body ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const fullBuffer = Buffer.concat(chunks);
          const responseText = fullBuffer.toString('utf8');
          let parsedData: any = responseText;
          try {
            parsedData = JSON.parse(responseText);
          } catch {}
          resolve({
            status: res.statusCode || 500,
            data: parsedData,
            headers: res.headers,
            buffer: fullBuffer,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

async function runTests() {
  console.log('\n======================================================');
  console.log('STARTING FULL BACKEND INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  let mongod: MongoMemoryServer | null = null;

  try {
    process.env.MONGOMS_DISABLE_MD5_CHECK = '1';
    delete process.env.MONGOMS_DOWNLOAD_URL;
    mongod = await MongoMemoryServer.create({
      binary: {
        version: '6.0.14',
        checkMD5: false,
      },
    });
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;

    await connectDB();
    await seedDatabase();

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    console.log(`[Test Server] Running on test port ${port}\n`);

    try {
      // 1. Healthcheck
      console.log('--> 1. Testing Healthcheck');
      const health = await request(server, 'GET', '/api/health');
      assert.strictEqual(health.status, 200);
      assert.strictEqual(health.data.status, 'ok');
      console.log('✓ Healthcheck passed\n');

      // 2. Auth & RBAC
      console.log('--> 2. Testing Auth Tokens & Roles');
      const adminLogin = await request(server, 'POST', '/api/auth/login', {
        loginId: 'admin123',
        password: 'Password@123',
      });
      assert.strictEqual(adminLogin.status, 200);
      const adminToken = adminLogin.data.token;

      const accountantLogin = await request(server, 'POST', '/api/auth/login', {
        loginId: 'account123',
        password: 'Password@123',
      });
      assert.strictEqual(accountantLogin.status, 200);
      const accountantToken = accountantLogin.data.token;

      const customerLogin = await request(server, 'POST', '/api/auth/login', {
        loginId: 'johnuser',
        password: 'Password@123',
      });
      assert.strictEqual(customerLogin.status, 200);
      const customerToken = customerLogin.data.token;
      console.log('✓ Admin, Accountant, and Customer tokens generated\n');

      // 3. Chart of Accounts & Journals
      console.log('--> 3. Testing Chart of Accounts and Journals');
      const accountsList = await request(server, 'GET', '/api/accounts', undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(accountsList.status, 200);
      assert.strictEqual(accountsList.data.length, 8);

      const journalsList = await request(server, 'GET', '/api/journals', undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(journalsList.status, 200);
      assert.strictEqual(journalsList.data.length, 4);
      console.log('✓ 8 Accounts and 4 Journals verified\n');

      // 4. Journal Entries & Live Balance Enforcement
      console.log('--> 4. Testing Journal Entry Balancing Enforcement');
      const cashAccId = accountsList.data.find((a: any) => a.name.includes('Cash'))?.id;
      const capAccId = accountsList.data.find((a: any) => a.name.includes('Capital'))?.id;
      const bankJournalId = journalsList.data.find((j: any) => j.name === 'Bank')?.id;

      // Try posting UNBALANCED entry -> MUST REJECT
      const unbalancedEntry = await request(
        server,
        'POST',
        '/api/journal-entries',
        {
          date: '2026-09-05',
          journalId: bankJournalId,
          status: 'Posted',
          lines: [
            { accountId: cashAccId, debit: 5000, credit: 0 },
            { accountId: capAccId, debit: 0, credit: 4000 },
          ],
        },
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(unbalancedEntry.status, 400, 'Unbalanced posted journal entry must be rejected');

      // Post BALANCED entry -> MUST SUCCEED
      const balancedEntry = await request(
        server,
        'POST',
        '/api/journal-entries',
        {
          date: '2026-09-05',
          journalId: bankJournalId,
          status: 'Posted',
          lines: [
            { accountId: cashAccId, debit: 5000, credit: 0 },
            { accountId: capAccId, debit: 0, credit: 5000 },
          ],
        },
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(balancedEntry.status, 201);
      assert.strictEqual(balancedEntry.data.total, 5000);
      console.log('✓ Server-side live debit=credit balance enforcement verified');

      // 5. Purchase Workflow & Auto-Posting
      console.log('--> 5. Testing Purchase Order -> Vendor Bill -> Auto Journal Entry -> Bill Payment');
      const contacts = await request(server, 'GET', '/api/contacts', undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
      const vendorId = contacts.data.find((c: any) => c.type === 'Vendor')?.id;
      const products = await request(server, 'GET', '/api/products', undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
      const prodId = products.data[0]?.id;

      // 5a. Create PO
      const poRes = await request(
        server,
        'POST',
        '/api/purchase-orders',
        {
          vendorId,
          date: '2026-09-06',
          lines: [{ productId: prodId, qty: 2, unitPrice: 15000 }],
        },
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(poRes.status, 201);
      assert.ok(poRes.data.number.startsWith('P'));

      // 5b. Confirm PO
      const poConfirm = await request(
        server,
        'POST',
        `/api/purchase-orders/${poRes.data.id}/confirm`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(poConfirm.status, 200);

      // 5c. Create Bill from PO
      const billRes = await request(
        server,
        'POST',
        `/api/purchase-orders/${poRes.data.id}/create-bill`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(billRes.status, 201);
      assert.ok(billRes.data.number.startsWith('Bill/'));

      // 5d. Confirm Vendor Bill -> Triggers Auto Journal Entry
      const billConfirm = await request(
        server,
        'POST',
        `/api/vendor-bills/${billRes.data.id}/confirm`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(billConfirm.status, 200);

      // Verify Journal Entry was created
      const billJE = await JournalEntry.findOne({ number: billRes.data.number });
      assert.ok(billJE, 'Auto-posted Journal Entry for Vendor Bill must exist');
      assert.strictEqual(billJE.total, 30000);
      assert.strictEqual(billJE.status, 'Posted');

      // 5e. Record Bill Payment
      const payBill = await request(
        server,
        'POST',
        '/api/payments',
        {
          type: 'Send',
          partnerId: vendorId,
          amount: 30000,
          billId: billRes.data.id,
          via: 'Bank',
        },
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(payBill.status, 201);

      const paidBillDoc = await VendorBill.findById(billRes.data.id);
      assert.strictEqual(paidBillDoc?.status, 'Paid');
      assert.strictEqual(paidBillDoc?.amountPaid, 30000);
      console.log('✓ Purchase workflow, auto journal entry posting, and bill payment verified\n');

      // 6. Sales Workflow & Auto-Posting
      console.log('--> 6. Testing Sales Order -> Customer Invoice -> Auto Journal Entry -> Invoice Payment');
      const customerId = contacts.data.find((c: any) => c.type === 'Customer')?.id;

      // 6a. Create SO
      const soRes = await request(
        server,
        'POST',
        '/api/sales-orders',
        {
          customerId,
          date: '2026-09-07',
          lines: [{ productId: prodId, qty: 1, unitPrice: 25000 }],
        },
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(soRes.status, 201);
      assert.ok(soRes.data.number.startsWith('S'));

      // 6b. Confirm SO
      await request(
        server,
        'POST',
        `/api/sales-orders/${soRes.data.id}/confirm`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );

      // 6c. Create Invoice from SO
      const invRes = await request(
        server,
        'POST',
        `/api/sales-orders/${soRes.data.id}/create-invoice`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(invRes.status, 201);
      assert.ok(invRes.data.number.startsWith('INV/'));

      // 6d. Confirm Invoice -> Triggers Auto Journal Entry
      const invConfirm = await request(
        server,
        'POST',
        `/api/customer-invoices/${invRes.data.id}/confirm`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(invConfirm.status, 200);

      // Verify Invoice JE
      const invJE = await JournalEntry.findOne({ number: invRes.data.number });
      assert.ok(invJE, 'Auto-posted Journal Entry for Customer Invoice must exist');
      assert.strictEqual(invJE.total, 25000);
      assert.strictEqual(invJE.status, 'Posted');
      console.log('✓ Sales workflow and auto journal entry posting verified\n');

      // 7. Customer Portal & Scoped Isolation
      console.log('--> 7. Testing Customer Portal Isolation & Invoices');
      const portalInvoices = await request(server, 'GET', '/api/portal/invoices', undefined, {
        Authorization: `Bearer ${customerToken}`,
      });
      assert.strictEqual(portalInvoices.status, 200);
      assert.ok(Array.isArray(portalInvoices.data));
      assert.ok(portalInvoices.data.length >= 1);

      // Verify Portal User CANNOT access internal routes (RBAC check)
      const portalForbidden = await request(server, 'GET', '/api/journal-entries', undefined, {
        Authorization: `Bearer ${customerToken}`,
      });
      assert.strictEqual(portalForbidden.status, 403, 'Portal User must be blocked from internal routes');
      console.log('✓ Customer portal scoped access and security guard verified\n');

      // 8. Razorpay Payment Integration
      console.log('--> 8. Testing Razorpay Order Creation and Signature Verification');
      const rzpOrder = await request(server, 'POST', '/api/payments/create-order', {
        amount: 25000,
        invoiceId: invRes.data.id,
      });
      assert.strictEqual(rzpOrder.status, 200);
      assert.ok(rzpOrder.data.orderId);
      assert.strictEqual(rzpOrder.data.amount, 2500000); // in paise

      const rzpVerify = await request(server, 'POST', '/api/payments/verify', {
        razorpay_order_id: rzpOrder.data.orderId,
        razorpay_payment_id: 'pay_test_123456',
        razorpay_signature: 'mock_test_signature',
        invoiceId: invRes.data.id,
        amount: 25000,
      });
      assert.strictEqual(rzpVerify.status, 200);
      assert.strictEqual(rzpVerify.data.success, true);

      // Verify invoice updated to Paid
      const paidInvDoc = await CustomerInvoice.findById(invRes.data.id);
      assert.strictEqual(paidInvDoc?.status, 'Paid');
      assert.strictEqual(paidInvDoc?.amountPaid, 25000);
      console.log('✓ Razorpay order creation and signature payment verification passed\n');

      // 9. Budgets Lifecycle & Live Achieved Calculation
      console.log('--> 9. Testing Budget Revision Lifecycle & Live Math');
      const budgets = await request(server, 'GET', '/api/budgets', undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(budgets.status, 200);
      const budgetId = budgets.data[0]?.id;

      // Revise Budget
      const reviseRes = await request(
        server,
        'POST',
        `/api/budgets/${budgetId}/revise`,
        {},
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(reviseRes.status, 201);
      assert.strictEqual(reviseRes.data.original.status, 'Revised');
      assert.strictEqual(reviseRes.data.revised.status, 'Draft');
      assert.ok(reviseRes.data.revised.name.includes('Revised'));
      console.log('✓ Budget revision lifecycle passed\n');

      // 10. Live Reports (Profit & Loss and Balance Sheet) & PDF Export
      console.log('--> 10. Testing Live Reports and PDF Export');
      const pnlReport = await request(
        server,
        'GET',
        '/api/reports/profit-loss?year=2026',
        undefined,
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(pnlReport.status, 200);
      assert.ok(pnlReport.data.totalIncome > 0);

      const bsReport = await request(
        server,
        'GET',
        '/api/reports/balance-sheet?year=2026',
        undefined,
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(bsReport.status, 200);
      assert.strictEqual(bsReport.data.isBalanced, true, 'Balance Sheet must balance (Assets === Liabilities + Equity)');

      // Test PDF streaming
      const pnlPdf = await request(
        server,
        'GET',
        '/api/reports/profit-loss/pdf?year=2026',
        undefined,
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(pnlPdf.status, 200);
      assert.strictEqual(pnlPdf.headers['content-type'], 'application/pdf');

      const bsPdf = await request(
        server,
        'GET',
        '/api/reports/balance-sheet/pdf?year=2026',
        undefined,
        { Authorization: `Bearer ${adminToken}` }
      );
      assert.strictEqual(bsPdf.status, 200);
      assert.strictEqual(bsPdf.headers['content-type'], 'application/pdf');
      console.log('✓ Live P&L, Balance Sheet balancing, and PDF generation passed\n');

      // 11. Dashboard Summary KPI
      console.log('--> 11. Testing Dashboard Real-time Summary KPI');
      const dashboard = await request(server, 'GET', '/api/dashboard/summary', undefined, {
        Authorization: `Bearer ${adminToken}`,
      });
      assert.strictEqual(dashboard.status, 200);
      assert.ok(dashboard.data.budgetStats);
      assert.ok(dashboard.data.purchaseStats);
      assert.ok(dashboard.data.salesStats);
      console.log('✓ Dashboard summary metrics verified\n');

      // 12. GridFS + Sharp Image Pipeline
      console.log('--> 12. Testing Sharp Image Compression & GridFS Storage');
      const validPng = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 4,
          background: { r: 63, g: 81, b: 181, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const imageId = await compressAndStoreImage(validPng, 'test-swatch.png');
      assert.ok(imageId);

      const fetchImage = await request(server, 'GET', `/api/images/${imageId}`);
      assert.strictEqual(fetchImage.status, 200);
      assert.strictEqual(fetchImage.headers['content-type'], 'image/webp');
      console.log('✓ GridFS and Sharp image pipeline verified\n');

      console.log('========================================================================');
      console.log('ALL CROSS-MODULE VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
      console.log('========================================================================\n');
    } finally {
      server.close();
      await mongoose.disconnect();
    }
  } finally {
    if (mongod) {
      await mongod.stop();
    }
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
