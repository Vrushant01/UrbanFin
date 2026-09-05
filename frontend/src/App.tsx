import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RoleGuard } from './components/RoleGuard';
import { AppLayout } from './components/layout/AppLayout';
import { Role } from './types';

// Pages
import { Login } from './pages/auth/Login';
import { SignUp } from './pages/auth/SignUp';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { CreateUser } from './pages/admin/CreateUser';
import { AppDashboard } from './pages/dashboard/AppDashboard';
import { CustomerPortal } from './pages/portal/CustomerPortal';
import { ContactMaster } from './pages/account/ContactMaster';
import { ProductMaster } from './pages/account/ProductMaster';
import { ChartOfAccountsMaster } from './pages/account/ChartOfAccountsMaster';
import { JournalsMaster } from './pages/account/JournalsMaster';
import { JournalEntriesMaster } from './pages/account/JournalEntriesMaster';
import { AnalyticAccountsMaster } from './pages/account/AnalyticAccountsMaster';
import { BudgetMaster } from './pages/account/BudgetMaster';
import { PurchaseOrderMaster } from './pages/purchase/PurchaseOrderMaster';
import { VendorBillMaster } from './pages/purchase/VendorBillMaster';
import { SalesOrderMaster } from './pages/sales/SalesOrderMaster';
import { CustomerInvoiceMaster } from './pages/sales/CustomerInvoiceMaster';
import { ReceiptMaster } from './pages/sales/ReceiptMaster';
import { PaymentMaster } from './pages/purchase/PaymentMaster';
import { ProfitAndLossReport } from './pages/report/ProfitAndLossReport';
import { BalanceSheet } from './pages/report/BalanceSheet';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes for Admin & Accountant */}
          <Route element={<RoleGuard allowedRoles={[Role.Administrator, Role.Accountant]} />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<AppDashboard />} />
              <Route path="/sales">
                <Route index element={<Navigate to="/sales/orders" replace />} />
                <Route path="orders" element={<SalesOrderMaster />} />
                <Route path="invoices" element={<CustomerInvoiceMaster />} />
                <Route path="receipt" element={<ReceiptMaster />} />
                <Route path="receipts" element={<ReceiptMaster />} />
                <Route path="Receipt" element={<ReceiptMaster />} />
                <Route path="Receipts" element={<ReceiptMaster />} />
                <Route path="*" element={<ReceiptMaster />} />
              </Route>
              <Route path="/purchase">
                <Route index element={<Navigate to="/purchase/orders" replace />} />
                <Route path="orders" element={<PurchaseOrderMaster />} />
                <Route path="bills" element={<VendorBillMaster />} />
                <Route path="payment" element={<PaymentMaster />} />
                <Route path="payments" element={<PaymentMaster />} />
                <Route path="Payment" element={<PaymentMaster />} />
                <Route path="Payments" element={<PaymentMaster />} />
                <Route path="*" element={<PaymentMaster />} />
              </Route>
              <Route path="/account">
                <Route index element={<Navigate to="/account/contact" replace />} />
                <Route path="contact" element={<ContactMaster />} />
                <Route path="product" element={<ProductMaster />} />
                <Route path="chart-of-accounts" element={<ChartOfAccountsMaster />} />
                <Route path="journals" element={<JournalsMaster />} />
                <Route path="journal-entries" element={<JournalEntriesMaster />} />
                <Route path="analyticals" element={<AnalyticAccountsMaster />} />
                <Route path="analytical-budget" element={<BudgetMaster />} />
                <Route path="*" element={<div className="p-4 bg-white rounded-lg border shadow-sm">Account Placeholder</div>} />
              </Route>
              <Route path="/report">
                <Route index element={<Navigate to="/report/profit-and-loss" replace />} />
                <Route path="budget" element={<BudgetMaster />} />
                <Route path="profit-and-loss" element={<ProfitAndLossReport />} />
                <Route path="balance-sheet" element={<BalanceSheet />} />
                <Route path="*" element={<div className="p-4 bg-white rounded-lg border shadow-sm">Report Placeholder</div>} />
              </Route>
            </Route>
          </Route>

          {/* Protected Routes for Admin Only */}
          <Route element={<RoleGuard allowedRoles={[Role.Administrator]} />}>
            <Route element={<AppLayout />}>
              <Route path="/users/new" element={<CreateUser />} />
            </Route>
          </Route>

          {/* Protected Routes for Users (Customers) */}
          <Route element={<RoleGuard allowedRoles={[Role.User]} />}>
            <Route path="/portal" element={<CustomerPortal />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
