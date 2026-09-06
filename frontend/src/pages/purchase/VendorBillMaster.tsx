import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type VendorBill, VendorBillStatus, type VendorBillLine, 
  type Contact, type Product, type AnalyticAccount, type Account, AccountType, type PurchaseOrder
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Plus, Trash2, ArrowRight, Printer, CheckCircle } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { BillPaymentModal } from '../../components/purchase/BillPaymentModal';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';
import { calculateGST } from '../../utils/gstUtils';

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
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [eligibleAnalytics, setEligibleAnalytics] = useState<AnalyticAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [editingBill, setEditingBill] = useState<Partial<VendorBill> | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const bData = await fetchWithCache<VendorBill[]>(`/api/vendor-bills?search=${encodeURIComponent(query)}`);
      setBills(bData);
    } catch {
      setBills(mockDb.getVendorBills());
    }

    try {
      const pData = await fetchWithCache<PurchaseOrder[]>('/api/purchase-orders');
      setPos(pData);
    } catch {
      setPos(mockDb.getPurchaseOrders());
    }

    try {
      const vData = await fetchWithCache<Contact[]>('/api/contacts?type=Vendor');
      setVendors(vData);
    } catch {
      setVendors(mockDb.getContacts());
    }

    try {
      const prData = await fetchWithCache<Product[]>('/api/products');
      setProducts(prData);
    } catch {
      setProducts(mockDb.getProducts());
    }

    setAnalytics(mockDb.getAnalyticAccounts());
    setEligibleAnalytics(mockDb.getEligibleAnalyticAccounts());
    setAccounts(mockDb.getAccounts());
  }, [debouncedSearch]);

  // Load data
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredBills = bills;

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

  // Computations with GST
  const subtotalUntaxed = (editingBill?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
  const gstBreakdown = calculateGST(subtotalUntaxed);
  const totalBillAmount = gstBreakdown.totalWithGst;
  const totalPaidAmount = (editingBill?.cashPaid || 0) + (editingBill?.bankPaid || 0) || (editingBill?.amountPaid || 0);
  const amountDue = Math.max(0, totalBillAmount - totalPaidAmount);

  // List View configuration
  const columns: Column<VendorBill>[] = [
    { key: 'number', header: 'BILL NO.' },
    { 
      key: 'vendorId', 
      header: 'VENDOR',
      render: (b) => {
        const vendor = vendors.find(v => v.id === b.vendorId);
        return <span className="font-medium text-slate-800">{(b as any).vendorName || (vendor ? vendor.name : 'Vendor')}</span>;
      }
    },
    { key: 'billDate', header: 'BILL DATE' },
    { key: 'dueDate', header: 'DUE DATE' },
    { 
      key: 'total', 
      header: 'TOTAL (INCL. GST)',
      render: (b) => {
        const rawTotal = b.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        const { totalWithGst } = calculateGST(rawTotal);
        return (
          <div>
            <div className="font-bold text-slate-900">Rs. {totalWithGst.toLocaleString()}</div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              18% GST
            </span>
          </div>
        );
      }
    },
    { 
      key: 'status', 
      header: 'STATUS',
      render: (b) => {
        const colors: Record<string, string> = {
          [VendorBillStatus.Draft]: 'bg-slate-100 text-slate-700 border-slate-200',
          [VendorBillStatus.Confirmed]: 'bg-blue-50 text-blue-700 border-blue-200/80',
          [VendorBillStatus.PartiallyPaid]: 'bg-amber-50 text-amber-700 border-amber-200/80',
          [VendorBillStatus.Paid]: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          [VendorBillStatus.Cancelled]: 'bg-rose-50 text-rose-700 border-rose-200/80',
        };
        return (
          <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md border ${colors[b.status] || 'bg-slate-100 text-slate-700'}`}>
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

      {viewMode === 'kanban' && (
        <MasterKanbanView
          data={filteredBills}
          keyExtractor={bill => bill.id}
          onCardClick={handleEdit}
          renderCard={(bill) => {
            const vend = vendors.find(v => v.id === bill.vendorId);
            const subtotal = bill.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
            const gstInfo = calculateGST(subtotal);
            const totalWithGst = gstInfo.totalWithGst;
            const due = totalWithGst - (bill.amountPaid || 0);

            return (
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {bill.number || 'Draft'}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                      bill.status === VendorBillStatus.Paid
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : bill.status === VendorBillStatus.PartiallyPaid
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : bill.status === VendorBillStatus.Confirmed
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {bill.status}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate">
                    {(bill as any).vendorName || vend?.name || 'Vendor'}
                  </div>
                  {((bill as any).vendorEmail || vend?.email) && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">{(bill as any).vendorEmail || vend?.email}</div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Due: {bill.dueDate}</span>
                    <span>{bill.billDate}</span>
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
      
      {viewMode === 'form' && editingBill && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                {editingBill.number || 'New Vendor Bill'}
                {originatingPo && (
                  <span className="text-sm font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-1 cursor-pointer hover:bg-blue-100 transition-colors">
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
                <SearchableSelect
                  label="Vendor Name"
                  required
                  placeholder="Search vendor by name or email..."
                  value={editingBill.vendorId || ''}
                  disabled={isReadonly}
                  asyncSearchUrl="/api/contacts?type=Vendor"
                  options={vendors.map(v => ({
                    id: v.id,
                    name: v.name,
                    subtitle: v.email || v.phone,
                  }))}
                  onChange={(val) => setEditingBill({ ...editingBill, vendorId: val })}
                />
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
              <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
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
                                price: p.cost || p.salesPrice,
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
                            <SearchableSelect
                              size="sm"
                              placeholder="(None)"
                              value={line.analyticAccountId || ''}
                              disabled={isReadonly}
                              asyncSearchUrl="/api/analytics/eligible"
                              options={eligibleAnalytics.map(a => ({
                                id: a.id,
                                name: a.name,
                                subtitle: a.type,
                              }))}
                              onChange={(val) => updateLine(line.id, 'analyticAccountId', val)}
                            />
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
                    <span className="text-blue-950 font-medium">Input Central GST (CGST 9%)</span>
                    <span className="font-bold text-blue-900">+ Rs. {gstBreakdown.cgst.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="flex justify-between text-slate-600 bg-blue-50/50 px-2.5 py-1.5 rounded-lg border border-blue-100/60">
                    <span className="text-blue-950 font-medium">Input State GST (SGST 9%)</span>
                    <span className="font-bold text-blue-900">+ Rs. {gstBreakdown.sgst.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-base">
                    <span className="font-bold text-slate-800">Total Bill (Incl. 18% GST)</span>
                    <span className="font-black text-slate-900">
                      Rs. {totalBillAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
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
