import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type VendorBill, VendorBillStatus, type VendorBillLine, 
  type Contact, type Product, type AnalyticAccount, type Account, AccountType, type PurchaseOrder
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, ArrowRight, Printer, CheckCircle } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { BillPaymentModal } from '../../components/purchase/BillPaymentModal';

const DEFAULT_BILL: Partial<VendorBill> = {
  vendorId: '',
  billReference: '',
  billDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
  status: VendorBillStatus.Draft,
  lines: [],
  amountPaid: 0,
  cashPaid: 0,
  bankPaid: 0
};

export function VendorBillMaster() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [editingBill, setEditingBill] = useState<Partial<VendorBill> | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Load data
  useEffect(() => {
    setBills(mockDb.getVendorBills());
    setPos(mockDb.getPurchaseOrders());
    setVendors(mockDb.getContacts());
    setProducts(mockDb.getProducts());
    setAnalytics(mockDb.getAnalyticAccounts());
    setAccounts(mockDb.getAccounts());
  }, [viewMode]);

  // Handle initialization from PO
  useEffect(() => {
    const fromPoId = searchParams.get('fromPo');
    if (fromPoId && pos.length > 0) {
      const po = pos.find(p => p.id === fromPoId);
      if (po) {
        const purchaseAcc = accounts.find(a => a.type === AccountType.Expenses);
        
        const newBill: Partial<VendorBill> = {
          ...DEFAULT_BILL,
          vendorId: po.vendorId,
          poReferenceId: po.id,
          lines: po.lines.map(pl => ({
            id: Math.random().toString(36).substr(2, 9),
            productId: pl.productId,
            accountId: purchaseAcc ? purchaseAcc.id : '',
            analyticAccountId: pl.analyticAccountId,
            qty: pl.qty,
            unitPrice: pl.unitPrice
          }))
        };
        setEditingBill(newBill);
        setViewMode('form');
        setSearchParams({}); // Clear
      }
    }
  }, [searchParams, pos, accounts, setSearchParams]);

  const filteredBills = useMemo(() => {
    if (!searchTerm) return bills;
    const lower = searchTerm.toLowerCase();
    return bills.filter(b => 
      b.number?.toLowerCase().includes(lower) || 
      b.billReference?.toLowerCase().includes(lower) ||
      b.status.toLowerCase().includes(lower)
    );
  }, [bills, searchTerm]);

  // Actions
  const handleNew = () => {
    setEditingBill({ ...DEFAULT_BILL });
    setViewMode('form');
  };

  const handleEdit = (bill: VendorBill) => {
    setEditingBill({ ...bill });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingBill(null);
    setViewMode('list');
  };

  const handleSave = (status: VendorBillStatus = VendorBillStatus.Draft) => {
    if (!editingBill || !editingBill.vendorId) return;

    const finalBill = { ...editingBill, status } as VendorBill;

    let savedBill;
    if (finalBill.id) {
      savedBill = mockDb.updateVendorBill(finalBill.id, finalBill);
    } else {
      savedBill = mockDb.addVendorBill(finalBill as Omit<VendorBill, 'id' | 'number'>);
    }
    
    setBills(mockDb.getVendorBills());
    setEditingBill(savedBill);
    
    // If not moving to confirmed, we can go back to list (or stay). Let's stay if confirmed, else back to list.
    if (status === VendorBillStatus.Draft) {
      setViewMode('list');
      setEditingBill(null);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    // Reload bills and update editing bill
    const updatedBills = mockDb.getVendorBills();
    setBills(updatedBills);
    if (editingBill?.id) {
      const updated = updatedBills.find(b => b.id === editingBill.id);
      if (updated) setEditingBill(updated);
    }
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingBill) return;
    const initialProduct = products.length > 0 ? products[0] : null;
    const purchaseAcc = accounts.find(a => a.type === AccountType.Expenses);
    
    const newLine: VendorBillLine = {
      id: Math.random().toString(36).substr(2, 9),
      productId: initialProduct ? initialProduct.id : '',
      accountId: purchaseAcc ? purchaseAcc.id : '',
      analyticAccountId: '',
      qty: 1,
      unitPrice: initialProduct ? initialProduct.cost : 0
    };
    
    setEditingBill({
      ...editingBill,
      lines: [...(editingBill.lines || []), newLine]
    });
  };

  const removeLine = (id: string) => {
    if (!editingBill) return;
    setEditingBill({
      ...editingBill,
      lines: editingBill.lines?.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof VendorBillLine, value: any) => {
    if (!editingBill) return;
    setEditingBill({
      ...editingBill,
      lines: editingBill.lines?.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        
        // Auto-fill unit price when product changes
        if (field === 'productId') {
          const product = products.find(p => p.id === value);
          if (product) updated.unitPrice = product.cost;
        }
        
        return updated;
      })
    });
  };

  // Computations
  let totalBillAmount = (editingBill?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
  let amountDue = totalBillAmount - (editingBill?.amountPaid || 0);

  // List View configuration
  const columns: Column<VendorBill>[] = [
    { key: 'number', header: 'Bill No.' },
    { 
      key: 'vendorId', 
      header: 'Vendor',
      render: (b) => {
        const vendor = vendors.find(v => v.id === b.vendorId);
        return vendor ? vendor.name : 'Unknown';
      }
    },
    { key: 'billDate', header: 'Bill Date' },
    { key: 'dueDate', header: 'Due Date' },
    { 
      key: 'total', 
      header: 'Total',
      render: (b) => {
        const total = b.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        return <span className="font-semibold">Rs. {total.toLocaleString()}</span>;
      }
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (b) => {
        const colors = {
          [VendorBillStatus.Draft]: 'bg-slate-100 text-slate-700',
          [VendorBillStatus.Confirmed]: 'bg-blue-50 text-blue-700',
          [VendorBillStatus.PartiallyPaid]: 'bg-amber-50 text-amber-700',
          [VendorBillStatus.Paid]: 'bg-emerald-50 text-emerald-700',
          [VendorBillStatus.Cancelled]: 'bg-rose-50 text-rose-700',
        };
        return (
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors[b.status]}`}>
            {b.status}
          </span>
        );
      }
    }
  ];

  const renderFormActions = () => {
    if (!editingBill) return null;
    
    if (editingBill.status === VendorBillStatus.Draft) {
      return (
        <>
          <Button type="button" variant="secondary" onClick={() => handleSave(VendorBillStatus.Draft)}>
            Save Draft
          </Button>
          <Button 
            type="button" 
            variant="primary"
            disabled={!editingBill.lines?.length || !editingBill.vendorId}
            onClick={() => handleSave(VendorBillStatus.Confirmed)}
          >
            Confirm Bill
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
            alert('Print dialog mock opened!');
          }} 
          className="gap-2"
        >
          <Printer size={16} /> Print
        </Button>
        
        {(editingBill.status === VendorBillStatus.Confirmed || editingBill.status === VendorBillStatus.PartiallyPaid) && amountDue > 0 && (
          <Button type="button" variant="primary" onClick={() => setShowPaymentModal(true)} className="bg-emerald-600 hover:bg-emerald-700 border-emerald-700">
            Register Payment
          </Button>
        )}
      </div>
    );
  };

  const isReadonly = editingBill?.status !== VendorBillStatus.Draft;
  const originatingPo = editingBill?.poReferenceId ? pos.find(p => p.id === editingBill.poReferenceId) : null;

  return (
    <MasterLayout
      title="Vendor Bills"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredBills} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={b => b.id} 
        />
      )}
      
      {viewMode === 'form' && editingBill && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                {editingBill.number || 'New Vendor Bill'}
                {originatingPo && (
                  <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1 cursor-pointer hover:bg-indigo-100 transition-colors">
                    <Link to={`/purchase/orders`} className="flex items-center gap-1">
                      From PO: {originatingPo.number} <ArrowRight size={14} />
                    </Link>
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {editingBill.status === VendorBillStatus.Paid && (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full">
                    <CheckCircle size={16} /> PAID
                  </span>
                )}
                <span className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                  ${editingBill.status === VendorBillStatus.Confirmed ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                    editingBill.status === VendorBillStatus.PartiallyPaid ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    editingBill.status === VendorBillStatus.Paid ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    'bg-slate-200 text-slate-800 border-slate-300'}`}>
                  {editingBill.status}
                </span>
              </div>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingBill.vendorId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingBill({ ...editingBill, vendorId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Input 
                  label="Bill Reference" 
                  disabled={isReadonly}
                  value={editingBill.billReference || ''} 
                  onChange={e => setEditingBill({ ...editingBill, billReference: e.target.value })}
                  placeholder="e.g. INV-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bill Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingBill.billDate || ''}
                  onChange={e => setEditingBill({ ...editingBill, billDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingBill.dueDate || ''}
                  onChange={e => setEditingBill({ ...editingBill, dueDate: e.target.value })}
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
                      <th className="p-3">Account</th>
                      <th className="p-3">Budget Analytics</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right bg-slate-50">Total</th>
                      {!isReadonly && <th className="p-3 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editingBill.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No lines added yet.
                        </td>
                      </tr>
                    ) : null}
                    
                    {(editingBill.lines || []).map((line, idx) => {
                      const total = line.qty * line.unitPrice;
                      
                      return (
                        <tr key={line.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
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
                            <select 
                              className="w-full min-w-[120px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent font-medium text-indigo-700"
                              value={line.analyticAccountId || ''}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                            >
                              <option value="">(None)</option>
                              {analytics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
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
                    <span className="font-semibold">Rs. {totalBillAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  
                  {(editingBill.amountPaid || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid (Cash)</span>
                        <span>- Rs. {(editingBill.cashPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid (Bank)</span>
                        <span>- Rs. {(editingBill.bankPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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

      {showPaymentModal && editingBill && (
        <BillPaymentModal 
          bill={editingBill as VendorBill} 
          vendor={vendors.find(v => v.id === editingBill.vendorId)}
          amountDue={amountDue}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </MasterLayout>
  );
}
