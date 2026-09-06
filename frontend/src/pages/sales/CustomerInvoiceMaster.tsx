import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type CustomerInvoice, CustomerInvoiceStatus, type CustomerInvoiceLine, 
  type Contact, type Product, type AnalyticAccount, type Account, AccountType, type SalesOrder
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Plus, Trash2, ArrowRight, Printer, CheckCircle, ExternalLink, Send, Bell } from 'lucide-react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { InvoicePaymentModal } from '../../components/sales/InvoicePaymentModal';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';
import { calculateGST } from '../../utils/gstUtils';

const DEFAULT_INVOICE: Partial<CustomerInvoice> = {
  customerId: '',
  invoiceReference: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: CustomerInvoiceStatus.Draft,
  lines: [],
  amountPaid: 0,
  cashPaid: 0,
  bankPaid: 0
};

export function CustomerInvoiceMaster() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [sos, setSos] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [editingInvoice, setEditingInvoice] = useState<Partial<CustomerInvoice> | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const invData = await fetchWithCache<CustomerInvoice[]>(`/api/customer-invoices?search=${encodeURIComponent(query)}`);
      setInvoices(invData);
    } catch {
      setInvoices(mockDb.getCustomerInvoices());
    }

    try {
      const soData = await fetchWithCache<SalesOrder[]>('/api/sales-orders');
      setSos(soData);
    } catch {
      setSos(mockDb.getSalesOrders());
    }

    try {
      const cData = await fetchWithCache<Contact[]>('/api/contacts?type=Customer');
      setCustomers(cData);
    } catch {
      setCustomers(mockDb.getContacts());
    }

    try {
      const prData = await fetchWithCache<Product[]>('/api/products');
      setProducts(prData);
    } catch {
      setProducts(mockDb.getProducts());
    }

    setAnalytics(mockDb.getAnalyticAccounts());
    setAccounts(mockDb.getAccounts());
  }, [debouncedSearch]);

  // Load data
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  // Handle URL query parameters (e.g. from Sales Order creation or direct link)
  useEffect(() => {
    const createdId = searchParams.get('createdId');
    const fromSo = searchParams.get('fromSo');

    if (createdId) {
      (async () => {
        try {
          const inv = await fetchWithCache<CustomerInvoice>(`/api/customer-invoices/${createdId}`);
          if (inv) {
            setEditingInvoice(inv);
            setViewMode('form');
            return;
          }
        } catch {
          const localInv = invoices.find((i) => i.id === createdId);
          if (localInv) {
            setEditingInvoice(localInv);
            setViewMode('form');
            return;
          }
        }
      })();
    } else if (fromSo) {
      (async () => {
        let so = sos.find((s) => s.id === fromSo);
        if (!so) {
          try {
            so = await fetchWithCache<SalesOrder>(`/api/sales-orders/${fromSo}`);
          } catch {}
        }

        if (so) {
          const initialIncomeAcc = accounts.find((a) => a.type === AccountType.Income);
          const lines: CustomerInvoiceLine[] = (so.lines || []).map((l) => ({
            id: Math.random().toString(36).substr(2, 9),
            productId: l.productId,
            accountId: initialIncomeAcc ? initialIncomeAcc.id : 'default_acc',
            analyticAccountId: l.analyticAccountId || '',
            qty: l.qty,
            unitPrice: l.unitPrice,
          }));

          setEditingInvoice({
            customerId: so.customerId,
            invoiceReference: so.number || '',
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            soReferenceId: so.id,
            status: CustomerInvoiceStatus.Draft,
            lines,
            amountPaid: 0,
            cashPaid: 0,
            bankPaid: 0,
          });
          setViewMode('form');
        }
      })();
    }
  }, [searchParams, sos, accounts, invoices]);

  const filteredInvoices = invoices;

  // Actions
  const handleNew = () => {
    setEditingInvoice({ ...DEFAULT_INVOICE });
    setViewMode('form');
  };

  const handleEdit = (invoice: CustomerInvoice) => {
    setEditingInvoice({ ...invoice });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingInvoice(null);
    setViewMode('list');
  };

  const handleSave = async (status: CustomerInvoiceStatus = CustomerInvoiceStatus.Draft) => {
    if (!editingInvoice || !editingInvoice.customerId) return;

    const finalInvoice = { ...editingInvoice, status } as CustomerInvoice;

    try {
      let savedInvoice: CustomerInvoice;
      if (finalInvoice.id) {
        const res = await fetch(`/api/customer-invoices/${finalInvoice.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(finalInvoice),
        });
        savedInvoice = await res.json();
      } else {
        const res = await fetch('/api/customer-invoices', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(finalInvoice),
        });
        savedInvoice = await res.json();
      }

      clientCache.invalidate('GET:/api/customer-invoices');
      clientCache.invalidate('GET:/api/dashboard/summary');
      clientCache.invalidate('GET:/api/journal-entries');
      await loadData();

      if (savedInvoice) {
        setEditingInvoice(savedInvoice);
      }
    } catch (e) {
      let savedInvoice: CustomerInvoice;
      if (finalInvoice.id) {
        savedInvoice = mockDb.updateCustomerInvoice(finalInvoice.id, finalInvoice) as CustomerInvoice;
      } else {
        savedInvoice = mockDb.addCustomerInvoice(
          finalInvoice as Omit<CustomerInvoice, 'id' | 'number'>
        ) as CustomerInvoice;
      }
      setInvoices(mockDb.getCustomerInvoices());
      setEditingInvoice(savedInvoice);
    }

    if (status === CustomerInvoiceStatus.Draft) {
      setViewMode('list');
      setEditingInvoice(null);
    }
  };

  const handleSendPaymentRequest = async () => {
    if (!editingInvoice) return;
    setIsRequestingPayment(true);
    setPaymentNotice(null);

    let invoiceId = editingInvoice.id;

    // If invoice is Draft, save it first to ensure it exists on the backend
    if (editingInvoice.status === CustomerInvoiceStatus.Draft) {
      try {
        const saveBody = {
          customerId: editingInvoice.customerId,
          invoiceReference: editingInvoice.invoiceReference,
          invoiceDate: editingInvoice.invoiceDate,
          dueDate: editingInvoice.dueDate,
          soReferenceId: editingInvoice.soReferenceId,
          lines: editingInvoice.lines,
          status: CustomerInvoiceStatus.Draft,
        };
        const isNew = !invoiceId || invoiceId.startsWith('new_');
        const url = isNew ? '/api/customer-invoices' : `/api/customer-invoices/${invoiceId}`;
        const method = isNew ? 'POST' : 'PUT';
        const saveRes = await fetch(url, {
          method,
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(saveBody),
        });
        if (saveRes.ok) {
          const saved = await saveRes.json();
          invoiceId = saved.id || saved._id;
        } else {
          setPaymentNotice('Failed to save invoice before sending request.');
          setIsRequestingPayment(false);
          return;
        }
      } catch {
        setPaymentNotice('Error saving invoice.');
        setIsRequestingPayment(false);
        return;
      }
    }

    try {
      const res = await fetch(`/api/customer-invoices/${invoiceId}/request-payment`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentNotice(data.message || 'Payment request sent to customer successfully!');
        setEditingInvoice((prev) =>
          prev
            ? {
                ...prev,
                id: invoiceId,
                status: CustomerInvoiceStatus.Confirmed,
                paymentRequested: true,
                paymentRequestedAt: new Date().toISOString(),
              }
            : null
        );
        clientCache.invalidate('GET:/api/customer-invoices');
        clientCache.invalidate('GET:/api/portal/invoices');
        await loadData();
      } else {
        setPaymentNotice(`Failed to send request: ${data.message || 'Error'}`);
      }
    } catch (e: any) {
      setPaymentNotice('Payment request recorded.');
      setEditingInvoice((prev) =>
        prev
          ? {
              ...prev,
              paymentRequested: true,
              paymentRequestedAt: new Date().toISOString(),
            }
          : null
      );
    } finally {
      setIsRequestingPayment(false);
      setTimeout(() => setPaymentNotice(null), 5000);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    const updatedInvoices = mockDb.getCustomerInvoices();
    setInvoices(updatedInvoices);
    if (editingInvoice?.id) {
      const updated = updatedInvoices.find((b) => b.id === editingInvoice.id);
      if (updated) setEditingInvoice(updated);
    }
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingInvoice) return;
    const initialProduct = products.length > 0 ? products[0] : null;
    const salesAcc = accounts.find((a) => a.type === AccountType.Income);

    const newLine: CustomerInvoiceLine = {
      id: Math.random().toString(36).substr(2, 9),
      productId: initialProduct ? initialProduct.id : '',
      accountId: salesAcc ? salesAcc.id : '',
      analyticAccountId: '',
      qty: 1,
      unitPrice: initialProduct ? initialProduct.salesPrice : 0,
    };

    setEditingInvoice({
      ...editingInvoice,
      lines: [...(editingInvoice.lines || []), newLine],
    });
  };

  const removeLine = (id: string) => {
    if (!editingInvoice) return;
    setEditingInvoice({
      ...editingInvoice,
      lines: editingInvoice.lines?.filter((l) => l.id !== id),
    });
  };

  const updateLine = (id: string, field: keyof CustomerInvoiceLine, value: any) => {
    if (!editingInvoice) return;
    setEditingInvoice({
      ...editingInvoice,
      lines: editingInvoice.lines?.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };

        // Auto-fill unit price when product changes
        if (field === 'productId') {
          const product = products.find((p) => p.id === value);
          if (product) updated.unitPrice = product.salesPrice;
        }

        return updated;
      }),
    });
  };

  const openBudgetReport = (analyticId: string) => {
    navigate(`/account/budget?analyticId=${analyticId}`);
  };

  // Computations with GST
  const subtotalUntaxed = (editingInvoice?.lines || []).reduce(
    (sum, l) => sum + l.qty * l.unitPrice,
    0
  );
  const gstBreakdown = calculateGST(subtotalUntaxed);
  const totalInvoiceAmount = gstBreakdown.totalWithGst;
  const totalPaidAmount =
    (editingInvoice?.cashPaid || 0) + (editingInvoice?.bankPaid || 0) ||
    (editingInvoice?.amountPaid || 0);
  const amountDue = Math.max(0, totalInvoiceAmount - totalPaidAmount);

  // List View configuration
  const columns: Column<CustomerInvoice>[] = [
    { key: 'number', header: 'INVOICE NO.' },
    {
      key: 'customerId',
      header: 'CUSTOMER',
      render: (i) => {
        const cust = customers.find((v) => v.id === i.customerId);
        return (
          <span className="font-medium text-slate-800">
            {(i as any).customerName || cust?.name || 'Customer'}
          </span>
        );
      },
    },
    { key: 'invoiceDate', header: 'INVOICE DATE' },
    { key: 'dueDate', header: 'DUE DATE' },
    {
      key: 'total',
      header: 'TOTAL (INCL. GST)',
      render: (i) => {
        const rawTotal = i.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
        const { totalWithGst } = calculateGST(rawTotal);
        return (
          <div>
            <div className="font-bold text-slate-900">Rs. {totalWithGst.toLocaleString()}</div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              18% GST
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (i) => {
        const colors: Record<string, string> = {
          [CustomerInvoiceStatus.Draft]: 'bg-slate-100 text-slate-700 border-slate-200',
          [CustomerInvoiceStatus.Confirmed]: 'bg-blue-50 text-blue-700 border-blue-200/80',
          [CustomerInvoiceStatus.PartiallyPaid]: 'bg-amber-50 text-amber-700 border-amber-200/80',
          [CustomerInvoiceStatus.Paid]: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        };
        return (
          <div className="space-y-1">
            <span
              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md border ${
                colors[i.status] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {i.status}
            </span>
            {i.paymentRequested && i.status !== CustomerInvoiceStatus.Paid && (
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                  <Send size={10} /> Request Sent
                </span>
              </div>
            )}
          </div>
        );
      },
    },
  ];

  const renderFormActions = () => {
    if (!editingInvoice) return null;

    if (editingInvoice.status === CustomerInvoiceStatus.Draft) {
      return (
        <>
          <Button type="button" variant="secondary" onClick={() => handleSave(CustomerInvoiceStatus.Draft)}>
            Save Draft
          </Button>
          {(editingInvoice.lines?.length || 0) > 0 && editingInvoice.customerId && amountDue > 0 && (
            <Button
              type="button"
              variant="primary"
              disabled={isRequestingPayment}
              onClick={handleSendPaymentRequest}
              className="gap-2"
            >
              <Send size={15} />
              {isRequestingPayment ? 'Sending...' : 'Confirm & Send Payment Request'}
            </Button>
          )}
        </>
      );
    }

    // Confirmed or Paid
    return (
      <div className="flex flex-wrap gap-2 items-center">
        {(editingInvoice.status === CustomerInvoiceStatus.Confirmed ||
          editingInvoice.status === CustomerInvoiceStatus.PartiallyPaid) &&
          amountDue > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={isRequestingPayment}
              onClick={handleSendPaymentRequest}
              className={`gap-2 ${
                editingInvoice.paymentRequested
                  ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Send size={15} />
              {isRequestingPayment
                ? 'Sending Request...'
                : editingInvoice.paymentRequested
                ? 'Re-send Payment Request'
                : 'Send Payment Request'}
            </Button>
          )}


        {(editingInvoice.status === CustomerInvoiceStatus.Confirmed ||
          editingInvoice.status === CustomerInvoiceStatus.PartiallyPaid) &&
          amountDue > 0 && (
            <Button
              type="button"
              variant="primary"
              onClick={() => setShowPaymentModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700"
            >
              Register Payment
            </Button>
          )}
      </div>
    );
  };

  const isReadonly = editingInvoice?.status !== CustomerInvoiceStatus.Draft;
  const originatingSo = editingInvoice?.soReferenceId
    ? sos.find((p) => p.id === editingInvoice.soReferenceId)
    : null;

  return (
    <MasterLayout
      title="Customer Invoices"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView
          data={filteredInvoices}
          columns={columns}
          onRowClick={handleEdit}
          keyExtractor={(b) => b.id}
        />
      )}

      {viewMode === 'kanban' && (
        <MasterKanbanView
          data={filteredInvoices}
          keyExtractor={(inv) => inv.id}
          onCardClick={handleEdit}
          renderCard={(inv) => {
            const cust = customers.find((c) => c.id === inv.customerId);
            const subtotal = inv.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
            const gstInfo = calculateGST(subtotal);
            const totalWithGst = gstInfo.totalWithGst;
            const due = totalWithGst - (inv.amountPaid || 0);

            return (
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {inv.number || 'Draft'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                        inv.status === CustomerInvoiceStatus.Paid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : inv.status === CustomerInvoiceStatus.PartiallyPaid
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : inv.status === CustomerInvoiceStatus.Confirmed
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate">
                    {(inv as any).customerName || cust?.name || 'Customer'}
                  </div>
                  {((inv as any).customerEmail || cust?.email) && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {(inv as any).customerEmail || cust?.email}
                    </div>
                  )}

                  {inv.paymentRequested && inv.status !== CustomerInvoiceStatus.Paid && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                      <Send size={11} /> Payment Request Sent
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Due: {inv.dueDate}</span>
                    <span>{inv.invoiceDate}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-400">Total (Incl. GST)</span>
                    <span className="font-bold text-sm text-slate-900">
                      Rs. {totalWithGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {due > 0 && (
                    <div className="flex items-baseline justify-between text-xs font-semibold text-red-600">
                      <span>Due</span>
                      <span>Rs. {due.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
        />
      )}

      {viewMode === 'form' && editingInvoice && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            {paymentNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fadeIn">
                <CheckCircle className="text-emerald-600 flex-shrink-0" size={20} />
                <div className="font-medium text-sm">{paymentNotice}</div>
              </div>
            )}

            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                {editingInvoice.number || 'New Customer Invoice'}
                {originatingSo && (
                  <span className="text-sm font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1 cursor-pointer hover:bg-blue-100 transition-colors">
                    <Link to={`/sales/orders`} className="flex items-center gap-1">
                      From SO: {originatingSo.number} <ArrowRight size={14} />
                    </Link>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingInvoice.paymentRequested && editingInvoice.status !== CustomerInvoiceStatus.Paid && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <Send size={13} /> Payment Request Sent
                  </span>
                )}
                {editingInvoice.status === CustomerInvoiceStatus.Paid && (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    <CheckCircle size={16} /> PAID
                  </span>
                )}
                <span
                  className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                  ${
                    editingInvoice.status === CustomerInvoiceStatus.Confirmed
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : editingInvoice.status === CustomerInvoiceStatus.PartiallyPaid
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : editingInvoice.status === CustomerInvoiceStatus.Paid
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  {editingInvoice.status}
                </span>
              </div>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <SearchableSelect
                  label="Customer Name"
                  required
                  placeholder="Search customer by name or email..."
                  value={editingInvoice.customerId || ''}
                  disabled={isReadonly}
                  asyncSearchUrl="/api/contacts?type=Customer"
                  options={customers.map(v => ({
                    id: v.id,
                    name: v.name,
                    subtitle: v.email || v.phone,
                  }))}
                  onChange={(val) => setEditingInvoice({ ...editingInvoice, customerId: val })}
                />
              </div>

              <div>
                <Input 
                  label="Invoice Reference" 
                  disabled={isReadonly}
                  value={editingInvoice.invoiceReference || ''} 
                  onChange={e => setEditingInvoice({ ...editingInvoice, invoiceReference: e.target.value })}
                  placeholder="e.g. PO-789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingInvoice.invoiceDate || ''}
                  onChange={e => setEditingInvoice({ ...editingInvoice, invoiceDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingInvoice.dueDate || ''}
                  onChange={e => setEditingInvoice({ ...editingInvoice, dueDate: e.target.value })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Invoice Lines</h3>
              <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
                <table className="w-full text-left text-sm min-w-max">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                    <tr>
                      <th className="p-3 w-12 text-center">Sr.</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Chart of Account</th>
                      <th className="p-3">Budget Analytics</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right bg-slate-50">Total</th>
                      {!isReadonly && <th className="p-3 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editingInvoice.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No lines added yet.
                        </td>
                      </tr>
                    ) : null}
                    
                    {(editingInvoice.lines || []).map((line, idx) => {
                      const total = line.qty * line.unitPrice;
                      
                      return (
                        <tr key={line.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
                          <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-2 min-w-[200px]">
                            <SearchableSelect
                              size="sm"
                              placeholder="Search product..."
                              value={line.productId}
                              disabled={isReadonly}
                              asyncSearchUrl="/api/products"
                              options={products.map(p => ({
                                id: p.id,
                                name: p.name,
                                subtitle: p.categoryName || p.type,
                                price: p.salesPrice,
                              }))}
                              onChange={(val, opt) => {
                                updateLine(line.id, 'productId', val);
                                if (opt?.price !== undefined) {
                                  updateLine(line.id, 'unitPrice', opt.price);
                                }
                              }}
                            />
                          </td>
                          <td className="p-2 min-w-[170px]">
                            <SearchableSelect
                              size="sm"
                              placeholder="Select Account"
                              value={line.accountId}
                              disabled={isReadonly}
                              asyncSearchUrl="/api/accounts"
                              options={accounts.map(a => ({
                                id: a.id,
                                name: a.name,
                                subtitle: a.type,
                              }))}
                              onChange={(val) => updateLine(line.id, 'accountId', val)}
                            />
                          </td>
                          <td className="p-2 min-w-[150px]">
                            <div className="flex items-center gap-1">
                              <SearchableSelect
                                size="sm"
                                placeholder="(None)"
                                value={line.analyticAccountId || ''}
                                disabled={isReadonly}
                                asyncSearchUrl="/api/analytics"
                                options={analytics.map(a => ({
                                  id: a.id,
                                  name: a.name,
                                  subtitle: a.type,
                                }))}
                                onChange={(val) => updateLine(line.id, 'analyticAccountId', val)}
                              />
                              {line.analyticAccountId && isReadonly && (
                                <button 
                                  title="View Budget Report"
                                  onClick={() => openBudgetReport(line.analyticAccountId!)}
                                  className="text-slate-400 hover:text-blue-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <ExternalLink size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              min="1" step="1"
                              className="w-full h-8 px-2 border border-slate-300 rounded text-sm text-right disabled:bg-transparent disabled:border-transparent"
                              value={line.qty || ''}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'qty', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              min="0" step="0.01"
                              className="w-full h-8 px-2 border border-slate-300 rounded text-sm text-right disabled:bg-transparent disabled:border-transparent"
                              value={line.unitPrice || ''}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-2 text-right bg-slate-50/50">
                            <span className="font-semibold text-slate-700">
                              Rs. {total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                          </td>
                          {!isReadonly && (
                            <td className="p-2 text-center">
                              <button 
                                type="button" 
                                onClick={() => removeLine(line.id)}
                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {!isReadonly && (
                <div className="mt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-blue-600 bg-blue-50 hover:bg-blue-100">
                    <Plus size={16} /> Add Line
                  </Button>
                </div>
              )}
            </div>

            {/* Totals Block with GST Breakdown */}
            <div className="flex justify-end pt-4">
              <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 space-y-2.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Untaxed Subtotal</span>
                    <span className="font-semibold text-slate-800">Rs. {subtotalUntaxed.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="flex justify-between text-slate-600 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100/60">
                    <span className="text-blue-950 font-medium">Central GST (CGST 9%)</span>
                    <span className="font-bold text-blue-900">+ Rs. {gstBreakdown.cgst.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="flex justify-between text-slate-600 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100/60">
                    <span className="text-blue-950 font-medium">State GST (SGST 9%)</span>
                    <span className="font-bold text-blue-900">+ Rs. {gstBreakdown.sgst.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-base">
                    <span className="font-bold text-slate-800">Total Invoice (Incl. 18% GST)</span>
                    <span className="font-black text-slate-900">
                      Rs. {totalInvoiceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  
                  {totalPaidAmount > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-600 pt-1 border-t border-dashed border-slate-200">
                        <span>Paid Amount (Cash + Bank)</span>
                        <span>- Rs. {totalPaidAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-lg">
                    <span className="font-bold text-slate-800">Amount Due</span>
                    <span className={`font-black ${amountDue <= 0 ? 'text-emerald-600' : 'text-blue-700'}`}>
                      Rs. {amountDue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </MasterFormView>
      )}

      {showPaymentModal && editingInvoice && (
        <InvoicePaymentModal 
          invoice={editingInvoice as CustomerInvoice} 
          customer={customers.find(v => v.id === editingInvoice.customerId)}
          amountDue={amountDue}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </MasterLayout>
  );
}
