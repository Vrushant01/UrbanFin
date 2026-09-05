import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type CustomerInvoice, CustomerInvoiceStatus, type CustomerInvoiceLine, 
  type Contact, type Product, type AnalyticAccount, type Account, AccountType, type SalesOrder
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, ArrowRight, Printer, CheckCircle, ExternalLink } from 'lucide-react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { InvoicePaymentModal } from '../../components/sales/InvoicePaymentModal';

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
  
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [sos, setSos] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [editingInvoice, setEditingInvoice] = useState<Partial<CustomerInvoice> | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Load data
  useEffect(() => {
    setInvoices(mockDb.getCustomerInvoices());
    setSos(mockDb.getSalesOrders());
    setCustomers(mockDb.getContacts());
    setProducts(mockDb.getProducts());
    setAnalytics(mockDb.getAnalyticAccounts());
    setAccounts(mockDb.getAccounts());
  }, [viewMode]);

  // Handle initialization from SO
  useEffect(() => {
    const fromSoId = searchParams.get('fromSo');
    if (fromSoId && sos.length > 0 && accounts.length > 0) {
      const so = sos.find(p => p.id === fromSoId);
      if (so) {
        const salesAcc = accounts.find(a => a.type === AccountType.Income);
        
        const newInvoice: Partial<CustomerInvoice> = {
          ...DEFAULT_INVOICE,
          customerId: so.customerId,
          soReferenceId: so.id,
          lines: so.lines.map(sl => ({
            id: Math.random().toString(36).substr(2, 9),
            productId: sl.productId,
            accountId: salesAcc ? salesAcc.id : '',
            analyticAccountId: sl.analyticAccountId,
            qty: sl.qty,
            unitPrice: sl.unitPrice
          }))
        };
        setEditingInvoice(newInvoice);
        setViewMode('form');
        setSearchParams({}); // Clear
      }
    }
  }, [searchParams, sos, accounts, setSearchParams]);

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const lower = searchTerm.toLowerCase();
    return invoices.filter(i => 
      i.number?.toLowerCase().includes(lower) || 
      i.invoiceReference?.toLowerCase().includes(lower) ||
      i.status.toLowerCase().includes(lower)
    );
  }, [invoices, searchTerm]);

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

  const handleSave = (status: CustomerInvoiceStatus = CustomerInvoiceStatus.Draft) => {
    if (!editingInvoice || !editingInvoice.customerId) return;

    const finalInvoice = { ...editingInvoice, status } as CustomerInvoice;

    let savedInvoice;
    if (finalInvoice.id) {
      savedInvoice = mockDb.updateCustomerInvoice(finalInvoice.id, finalInvoice);
    } else {
      savedInvoice = mockDb.addCustomerInvoice(finalInvoice as Omit<CustomerInvoice, 'id' | 'number'>);
    }
    
    setInvoices(mockDb.getCustomerInvoices());
    setEditingInvoice(savedInvoice);
    
    if (status === CustomerInvoiceStatus.Draft) {
      setViewMode('list');
      setEditingInvoice(null);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    const updatedInvoices = mockDb.getCustomerInvoices();
    setInvoices(updatedInvoices);
    if (editingInvoice?.id) {
      const updated = updatedInvoices.find(b => b.id === editingInvoice.id);
      if (updated) setEditingInvoice(updated);
    }
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingInvoice) return;
    const initialProduct = products.length > 0 ? products[0] : null;
    const salesAcc = accounts.find(a => a.type === AccountType.Income);
    
    const newLine: CustomerInvoiceLine = {
      id: Math.random().toString(36).substr(2, 9),
      productId: initialProduct ? initialProduct.id : '',
      accountId: salesAcc ? salesAcc.id : '',
      analyticAccountId: '',
      qty: 1,
      unitPrice: initialProduct ? initialProduct.salesPrice : 0
    };
    
    setEditingInvoice({
      ...editingInvoice,
      lines: [...(editingInvoice.lines || []), newLine]
    });
  };

  const removeLine = (id: string) => {
    if (!editingInvoice) return;
    setEditingInvoice({
      ...editingInvoice,
      lines: editingInvoice.lines?.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof CustomerInvoiceLine, value: any) => {
    if (!editingInvoice) return;
    setEditingInvoice({
      ...editingInvoice,
      lines: editingInvoice.lines?.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        
        // Auto-fill unit price when product changes
        if (field === 'productId') {
          const product = products.find(p => p.id === value);
          if (product) updated.unitPrice = product.salesPrice;
        }
        
        return updated;
      })
    });
  };

  const openBudgetReport = (analyticId: string) => {
    navigate(`/account/budget?analyticId=${analyticId}`);
  };

  // Computations
  let totalInvoiceAmount = (editingInvoice?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
  let amountDue = totalInvoiceAmount - (editingInvoice?.amountPaid || 0);

  // List View configuration
  const columns: Column<CustomerInvoice>[] = [
    { key: 'number', header: 'Invoice No.' },
    { 
      key: 'customerId', 
      header: 'Customer',
      render: (i) => {
        const cust = customers.find(v => v.id === i.customerId);
        return cust ? cust.name : 'Unknown';
      }
    },
    { key: 'invoiceDate', header: 'Invoice Date' },
    { key: 'dueDate', header: 'Due Date' },
    { 
      key: 'total', 
      header: 'Total',
      render: (i) => {
        const total = i.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        return <span className="font-semibold">Rs. {total.toLocaleString()}</span>;
      }
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (i) => {
        const colors = {
          [CustomerInvoiceStatus.Draft]: 'bg-slate-100 text-slate-700',
          [CustomerInvoiceStatus.Confirmed]: 'bg-blue-50 text-blue-700',
          [CustomerInvoiceStatus.PartiallyPaid]: 'bg-amber-50 text-amber-700',
          [CustomerInvoiceStatus.Paid]: 'bg-emerald-50 text-emerald-700',
        };
        return (
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors[i.status]}`}>
            {i.status}
          </span>
        );
      }
    }
  ];

  const renderFormActions = () => {
    if (!editingInvoice) return null;
    
    if (editingInvoice.status === CustomerInvoiceStatus.Draft) {
      return (
        <>
          <Button type="button" variant="secondary" onClick={() => handleSave(CustomerInvoiceStatus.Draft)}>
            Save Draft
          </Button>
          <Button 
            type="button" 
            variant="primary"
            disabled={!editingInvoice.lines?.length || !editingInvoice.customerId}
            onClick={() => handleSave(CustomerInvoiceStatus.Confirmed)}
          >
            Confirm Invoice
          </Button>
        </>
      );
    }

    // Confirmed or Paid
    return (
      <div className="flex gap-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            alert('Mock: Invoice sent to customer successfully!');
          }} 
          className="gap-2"
        >
          <Printer size={16} /> Print / Send
        </Button>
        
        {(editingInvoice.status === CustomerInvoiceStatus.Confirmed || editingInvoice.status === CustomerInvoiceStatus.PartiallyPaid) && amountDue > 0 && (
          <Button type="button" variant="primary" onClick={() => setShowPaymentModal(true)} className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700">
            Register Payment
          </Button>
        )}
      </div>
    );
  };

  const isReadonly = editingInvoice?.status !== CustomerInvoiceStatus.Draft;
  const originatingSo = editingInvoice?.soReferenceId ? sos.find(p => p.id === editingInvoice.soReferenceId) : null;

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
          keyExtractor={b => b.id} 
        />
      )}
      
      {viewMode === 'form' && editingInvoice && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                {editingInvoice.number || 'New Customer Invoice'}
                {originatingSo && (
                  <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1 cursor-pointer hover:bg-indigo-100 transition-colors">
                    <Link to={`/sales/orders`} className="flex items-center gap-1">
                      From SO: {originatingSo.number} <ArrowRight size={14} />
                    </Link>
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {editingInvoice.status === CustomerInvoiceStatus.Paid && (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    <CheckCircle size={16} /> PAID
                  </span>
                )}
                <span className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                  ${editingInvoice.status === CustomerInvoiceStatus.Confirmed ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                    editingInvoice.status === CustomerInvoiceStatus.PartiallyPaid ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    editingInvoice.status === CustomerInvoiceStatus.Paid ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    'bg-slate-200 text-slate-800 border-slate-300'}`}>
                  {editingInvoice.status}
                </span>
              </div>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingInvoice.customerId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingInvoice({ ...editingInvoice, customerId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select Customer</option>
                  {customers.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
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
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
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
                          <td className="p-2">
                            <select 
                              className="w-full min-w-[150px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent font-medium"
                              value={line.productId}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'productId', e.target.value)}
                            >
                              <option value="" disabled>Select Product...</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <select 
                              className="w-full min-w-[150px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent"
                              value={line.accountId}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'accountId', e.target.value)}
                            >
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <select 
                                className="w-full min-w-[120px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent font-medium text-indigo-700"
                                value={line.analyticAccountId || ''}
                                disabled={isReadonly}
                                onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                              >
                                <option value="">(None)</option>
                                {analytics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                              {line.analyticAccountId && isReadonly && (
                                <button 
                                  title="View Budget Report"
                                  onClick={() => openBudgetReport(line.analyticAccountId!)}
                                  className="text-slate-400 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100">
                    <Plus size={16} /> Add Line
                  </Button>
                </div>
              )}
            </div>

            {/* Totals Block */}
            <div className="flex justify-end pt-4">
              <div className="w-full max-w-sm bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Untaxed Amount</span>
                    <span className="font-semibold">Rs. {totalInvoiceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  
                  {(editingInvoice.amountPaid || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid (Cash)</span>
                        <span>- Rs. {(editingInvoice.cashPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid (Bank)</span>
                        <span>- Rs. {(editingInvoice.bankPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </>
                  )}
                  
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-lg">
                    <span className="font-bold text-slate-800">Amount Due</span>
                    <span className={`font-bold ${amountDue <= 0 ? 'text-emerald-600' : 'text-indigo-700'}`}>
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
