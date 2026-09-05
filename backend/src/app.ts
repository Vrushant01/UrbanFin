import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requestLogger, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import journalEntryRoutes from './routes/journalEntryRoutes.js';
import analyticRoutes from './routes/analyticRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import vendorBillRoutes from './routes/vendorBillRoutes.js';
import salesOrderRoutes from './routes/salesOrderRoutes.js';
import customerInvoiceRoutes from './routes/customerInvoiceRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

dotenv.config();

const app: Express = express();

// Security & Parsing Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request Logging
app.use(requestLogger);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'UrbanFin Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount All API Routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/contacts', contactRoutes);
app.use('/contacts', contactRoutes);

app.use('/api/products', productRoutes);
app.use('/products', productRoutes);

app.use('/api/categories', categoryRoutes);
app.use('/categories', categoryRoutes);

app.use('/api/images', imageRoutes);
app.use('/images', imageRoutes);

app.use('/api/accounts', accountRoutes);
app.use('/accounts', accountRoutes);

app.use('/api/journals', journalRoutes);
app.use('/journals', journalRoutes);

app.use('/api/journal-entries', journalEntryRoutes);
app.use('/journal-entries', journalEntryRoutes);

app.use('/api/analytics', analyticRoutes);
app.use('/analytics', analyticRoutes);
app.use('/api/analytic-accounts', analyticRoutes);
app.use('/analytic-accounts', analyticRoutes);

app.use('/api/budgets', budgetRoutes);
app.use('/budgets', budgetRoutes);

app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);

app.use('/api/vendor-bills', vendorBillRoutes);
app.use('/vendor-bills', vendorBillRoutes);

app.use('/api/sales-orders', salesOrderRoutes);
app.use('/sales-orders', salesOrderRoutes);

app.use('/api/customer-invoices', customerInvoiceRoutes);
app.use('/customer-invoices', customerInvoiceRoutes);

app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

app.use('/api/portal', portalRoutes);
app.use('/portal', portalRoutes);

app.use('/api/reports', reportRoutes);
app.use('/reports', reportRoutes);

app.use('/api/dashboard', dashboardRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api/payment-terms', dashboardRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
