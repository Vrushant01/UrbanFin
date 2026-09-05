import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type PurchaseOrder, PurchaseOrderStatus, type PurchaseOrderLine, 
  type Contact, type Product, type AnalyticAccount, ContactType
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { 
  Plus, 
  Trash2, 
  FileText, 
  ArrowRight, 
  Search, 
  Store, 
  PackageCheck, 
  Send, 
  CheckCircle, 
  Clock, 
  Banknote, 
  CheckCheck,
  XCircle,
  X
} from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { fetchWithCache, clientCache } from '../../utils/clientCache';
import { calculateGST } from '../../utils/gstUtils';

const DEFAULT_PO: Partial<PurchaseOrder> = {
  vendorId: '',
  date: new Date().toISOString().split('T')[0],
  paymentTerms: 'Immediate Payment',
  status: PurchaseOrderStatus.Draft,
  lines: []
};

interface SourcingResult {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  description?: string;
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
}

export function PurchaseOrderMaster() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form' | 'sourcing'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [termsList, setTermsList] = useState<string[]>([]);
  
  const [editingPO, setEditingPO] = useState<Partial<PurchaseOrder> | null>(null);
  const [customTerm, setCustomTerm] = useState('');

  // Sourcing Search States
  const [sourcingQuery, setSourcingQuery] = useState('');
  const debouncedSourcing = useDebounce(sourcingQuery, 250);
  const [sourcingResults, setSourcingResults] = useState<SourcingResult[]>([]);
  const [sourcingLoading, setSourcingLoading] = useState(false);

  // Direct Hand-to-Hand Payment Settlement Modal
  const [settleModalBill, setSettleModalBill] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [settleToast, setSettleToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load data with LRU client cache and backend live search
  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const pData = await fetchWithCache<PurchaseOrder[]>(`/api/purchase-orders?search=${encodeURIComponent(query)}`);
      setPos(pData);
    } catch {
      setPos(mockDb.getPurchaseOrders());
    }

    try {
      const vData = await fetchWithCache<Contact[]>('/api/contacts?type=Vendor');
      setVendors(vData);
    } catch {
      setVendors(mockDb.getContacts().filter(c => c.type === ContactType.Vendor || c.type === ContactType.Both));
    }

    try {
      const prData = await fetchWithCache<Product[]>('/api/products');
      setProducts(prData);
    } catch {
      setProducts(mockDb.getProducts());
    }

    setAnalytics(mockDb.getAnalyticAccounts());
    setTermsList(mockDb.getPaymentTerms());
  }, [debouncedSearch]);

  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  // Fetch Sourcing Results with Client LRU Caching
  const handleSearchSourcing = async (q: string = debouncedSourcing) => {
    setSourcingLoading(true);
    try {
      const data = await fetchWithCache<SourcingResult[]>(`/api/vendor-portal/sourcing?query=${encodeURIComponent(q)}`);
      setSourcingResults(data);
    } catch (err) {
      console.error('[Sourcing] Search failed:', err);
    } finally {
      setSourcingLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'sourcing') {
      handleSearchSourcing(debouncedSourcing);
    }
  }, [viewMode, debouncedSourcing]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setSettleToast({ type, text });
    setTimeout(() => setSettleToast(null), 4000);
  };

  const filteredPos = pos;

  // Actions
  const handleNew = () => {
    setEditingPO({ 
      ...DEFAULT_PO, 
      vendorId: vendors.length > 0 ? vendors[0].id : '' 
    });
    setCustomTerm('');
    setViewMode('form');
  };

  const handleEdit = (po: PurchaseOrder) => {
    setEditingPO({ ...po });
    setCustomTerm('');
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingPO(null);
    setViewMode('list');
  };

  // One-click Order from Sourcing Search
  const handleOrderFromSourcing = (item: SourcingResult) => {
    // Check if product exists in local products list, or create reference
    let prod = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
    let prodId = prod ? prod.id : item.id;

    const newLine: PurchaseOrderLine = {
      id: Math.random().toString(36).substr(2, 9),
      productId: prodId,
      analyticAccountId: '',
      qty: 1,
      unitPrice: item.price,
    };

    setEditingPO({
      ...DEFAULT_PO,
      vendorId: item.vendorId,
      lines: [newLine],
      status: PurchaseOrderStatus.Draft,
    });
    setViewMode('form');
  };

  const handleSave = async (status: PurchaseOrderStatus = PurchaseOrderStatus.Draft) => {
    if (!editingPO || !editingPO.vendorId) return;

    let finalTerm = editingPO.paymentTerms;
    if (customTerm && !termsList.includes(customTerm)) {
      mockDb.addPaymentTerm(customTerm);
      finalTerm = customTerm;
    }

    const payload = {
      ...editingPO,
      status,
      paymentTerms: finalTerm,
    };

    try {
      let res;
      if (editingPO.id) {
        res = await fetch(`/api/purchase-orders/${editingPO.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        showToast('success', status === PurchaseOrderStatus.SentToVendor ? 'Purchase order sent to Vendor!' : 'Purchase order saved.');
        await loadData();
        setViewMode('list');
        setEditingPO(null);
        return;
      }
    } catch {
      // local fallback
    }

    const finalPO = { ...editingPO, status, paymentTerms: finalTerm } as PurchaseOrder;
    if (finalPO.id) {
      mockDb.updatePurchaseOrder(finalPO.id, finalPO);
    } else {
      mockDb.addPurchaseOrder(finalPO as Omit<PurchaseOrder, 'id' | 'number'>);
    }
    
    setPos(mockDb.getPurchaseOrders());
    setViewMode('list');
    setEditingPO(null);
  };

  const handleCancel = () => {
    if (!editingPO || !editingPO.id) return;
    mockDb.updatePurchaseOrder(editingPO.id, { status: PurchaseOrderStatus.Cancelled });
    setPos(mockDb.getPurchaseOrders());
    setViewMode('list');
    setEditingPO(null);
  };

  const handleCreateBill = () => {
    if (!editingPO || !editingPO.id) return;
    navigate(`/purchase/bills/new?fromPo=${editingPO.id}`);
  };

  // Direct Hand-to-Hand Payment Settlement
  const handleOpenDirectSettle = async (poId: string) => {
    try {
      const res = await fetch(`/api/vendor-bills?search=${poId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const bills = await res.json();
        if (bills.length > 0) {
          setSettleModalBill(bills[0]);
          return;
        }
      }
    } catch {}

    const allBills = mockDb.getVendorBills();
    const matching = allBills.find(b => b.poReferenceId === poId || b.billReference === editingPO?.number);
    if (matching) {
      setSettleModalBill(matching);
    } else {
      showToast('error', 'No generated bill found for this order yet.');
    }
  };

  const handleRecordDirectPayment = async () => {
    if (!settleModalBill) return;

    try {
      const payload = {
        partnerId: settleModalBill.vendorId,
        amount: settleModalBill.amountDue || settleModalBill.total || 0,
        type: 'Send',
        via: paymentMethod,
        date: new Date().toISOString().split('T')[0],
        billId: settleModalBill.id,
        note: `Hand-to-Hand settlement for Bill ${settleModalBill.number}`,
      };

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast('success', `Payment of ₹${payload.amount.toLocaleString()} recorded via ${paymentMethod} (Hand-to-Hand)!`);
        setSettleModalBill(null);
        await loadData();
        return;
      }
    } catch {}

    mockDb.addPayment({
      partnerId: settleModalBill.vendorId,
      amount: settleModalBill.amountDue || settleModalBill.total || 0,
      type: 'Send' as any,
      via: paymentMethod as any,
      date: new Date().toISOString().split('T')[0],
      billId: settleModalBill.id,
      note: `Hand-to-Hand settlement for Bill ${settleModalBill.number}`,
    });

    mockDb.updateVendorBill(settleModalBill.id, {
      status: 'Paid' as any,
      amountPaid: settleModalBill.total,
      cashPaid: paymentMethod === 'Cash' ? settleModalBill.total : 0,
      bankPaid: paymentMethod === 'Bank' ? settleModalBill.total : 0,
    });

    showToast('success', `Direct payment completed and recorded.`);
    setSettleModalBill(null);
    loadData();
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingPO) return;
    const initialProduct = products.length > 0 ? products[0] : null;
    const newLine: PurchaseOrderLine = {
      id: Math.random().toString(36).substr(2, 9),
      productId: initialProduct ? initialProduct.id : '',
      analyticAccountId: '',
      qty: 1,
      unitPrice: initialProduct ? initialProduct.cost : 0
    };
    setEditingPO({
      ...editingPO,
      lines: [...(editingPO.lines || []), newLine]
    });
  };

  const removeLine = (id: string) => {
    if (!editingPO) return;
    setEditingPO({
      ...editingPO,
      lines: editingPO.lines?.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof PurchaseOrderLine, value: any) => {
    if (!editingPO) return;
    setEditingPO({
      ...editingPO,
      lines: editingPO.lines?.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        
        if (field === 'productId') {
          const product = products.find(p => p.id === value);
          if (product) updated.unitPrice = product.cost;
        }
        
        return updated;
      })
    });
  };

  // List View configuration
  const columns: Column<PurchaseOrder>[] = [
    { key: 'number', header: 'PO NO.' },
    { 
      key: 'vendorId', 
      header: 'VENDOR',
      render: (p) => {
        const vendor = vendors.find(v => v.id === p.vendorId);
        return <span className="font-bold text-slate-800">{(p as any).vendorName || (vendor ? vendor.name : 'Vendor')}</span>;
      }
    },
    { key: 'date', header: 'ORDER DATE' },
    { 
      key: 'total', 
      header: 'TOTAL VALUE (INCL. GST)',
      render: (p) => {
        const rawTotal = (p.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        const { totalWithGst } = calculateGST(rawTotal);
        return (
          <div>
            <div className="font-black text-slate-900">₹{totalWithGst.toLocaleString()}</div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
              18% GST
            </span>
          </div>
        );
      }
    },
    { 
      key: 'status', 
      header: 'STATUS',
      render: (p) => {
        const colors: Record<string, string> = {
          [PurchaseOrderStatus.Draft]: 'bg-slate-100 text-slate-700 border-slate-200',
          [PurchaseOrderStatus.SentToVendor]: 'bg-amber-50 text-amber-800 border-amber-200',
          [PurchaseOrderStatus.Accepted]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          [PurchaseOrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          [PurchaseOrderStatus.Cancelled]: 'bg-rose-50 text-rose-700 border-rose-200/80',
        };
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md border ${colors[p.status] || 'bg-slate-100 text-slate-700'}`}>
            {p.status === PurchaseOrderStatus.SentToVendor && <Clock size={12} className="animate-spin" />}
            {p.status === PurchaseOrderStatus.Accepted && <CheckCheck size={13} className="text-indigo-600" />}
            {p.status}
          </span>
        );
      }
    }
  ];

  const renderFormActions = () => {
    if (!editingPO) return null;

    if (editingPO.status === PurchaseOrderStatus.Accepted) {
      return (
        <>
          <Button 
            type="button" 
            variant="primary" 
            onClick={() => handleOpenDirectSettle(editingPO.id || '')} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-xs"
          >
            <Banknote size={17} /> Settle Payment (Hand-to-Hand)
          </Button>
          <Button type="button" variant="outline" onClick={handleCreateBill} className="gap-2">
            View / Create Bill <ArrowRight size={16} />
          </Button>
        </>
      );
    }
    
    if (editingPO.status === PurchaseOrderStatus.Confirmed) {
      return (
        <>
          <Button type="button" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleCreateBill} className="gap-2">
            Create Bill <ArrowRight size={16} />
          </Button>
        </>
      );
    }

    if (editingPO.status === PurchaseOrderStatus.Cancelled) {
      return null;
    }

    if (editingPO.status === PurchaseOrderStatus.SentToVendor) {
      return (
        <>
          <div className="text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5 mr-2">
            <Clock size={14} className="animate-spin text-amber-600" /> Awaiting Vendor Acceptance
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => handleSave(PurchaseOrderStatus.Confirmed)}
            className="text-xs"
          >
            Force Confirm
          </Button>
        </>
      );
    }

    // Draft Status
    return (
      <>
        {editingPO.id && (
          <Button type="button" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Cancel
          </Button>
        )}
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => handleSave(PurchaseOrderStatus.Draft)}
        >
          Save Draft
        </Button>
        <Button 
          type="button" 
          variant="primary"
          disabled={!editingPO.lines?.length || !editingPO.vendorId}
          onClick={() => handleSave(PurchaseOrderStatus.SentToVendor)}
          className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-bold shadow-xs"
        >
          <Send size={16} />
          <span>Send Request to Vendor</span>
        </Button>
      </>
    );
  };

  const isReadonly = editingPO?.status !== PurchaseOrderStatus.Draft && editingPO?.status !== undefined;
  let totalOrderValue = (editingPO?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {settleToast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            settleToast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-600" />
            <span className="text-sm font-semibold">{settleToast.text}</span>
          </div>
          <button onClick={() => setSettleToast(null)} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Mode Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📋 Purchase Orders List
          </button>
          <button
            onClick={() => setViewMode('sourcing')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'sourcing'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <Search size={14} />
            <span>Search Vendor Sourcing Catalog</span>
          </button>
        </div>

        {viewMode !== 'form' && (
          <Button
            variant="primary"
            onClick={handleNew}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
          >
            <Plus size={15} />
            <span>New Purchase Order</span>
          </Button>
        )}
      </div>

      {/* SOURCING SEARCH VIEW */}
      {viewMode === 'sourcing' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="relative z-10 max-w-3xl space-y-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-purple-200 backdrop-blur-xs">
                🏢 Enterprise Sourcing Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Search Products Across Verified Vendors
              </h2>
              <p className="text-sm text-purple-200">
                Find supplies from registered vendors in real-time. Check live stock levels, compare prices, and directly issue a purchase request.
              </p>

              <div className="pt-3 flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={sourcingQuery}
                    onChange={(e) => setSourcingQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchSourcing()}
                    placeholder="Search product (e.g. Air Conditioner, Chair, Desk, Refrigerator)..."
                    className="w-full pl-11 pr-4 py-3 bg-white text-slate-800 font-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-md"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={() => handleSearchSourcing()}
                  disabled={sourcingLoading}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-6 h-auto"
                >
                  {sourcingLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </div>

          {/* Sourcing Results Grid */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Store size={18} className="text-purple-600" /> Available Vendor Products ({sourcingResults.length})
            </h3>

            {sourcingResults.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                No vendor products found matching &quot;{sourcingQuery}&quot;. Try searching for &quot;Air Conditioner&quot; or &quot;Desk&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourcingResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base leading-snug">{item.name}</h4>
                          <div className="text-xs text-purple-600 font-semibold flex items-center gap-1 mt-0.5">
                            <Store size={12} /> {item.vendorName}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.stockQuantity > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {item.stockQuantity} in stock
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase">Unit Supply Price</div>
                        <div className="text-lg font-black text-slate-900">₹{item.price.toLocaleString()}</div>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOrderFromSourcing(item)}
                        className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-bold shadow-xs"
                      >
                        <PackageCheck size={15} />
                        <span>Order from Vendor</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <MasterLayout
          title="Purchase Orders"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNew={handleNew}
          onBack={handleBack}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        >
          <MasterListView 
            data={filteredPos} 
            columns={columns} 
            onRowClick={handleEdit} 
            keyExtractor={p => p.id} 
          />
        </MasterLayout>
      )}

      {/* KANBAN VIEW */}
      {viewMode === 'kanban' && (
        <MasterLayout
          title="Purchase Orders"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNew={handleNew}
          onBack={handleBack}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        >
          <MasterKanbanView
            data={filteredPos}
            keyExtractor={p => p.id}
            onCardClick={handleEdit}
            renderCard={(po) => {
              const vend = vendors.find(v => v.id === po.vendorId);
              const subtotal = (po.lines || []).reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
              const gstInfo = calculateGST(subtotal);
              const lineCount = (po.lines || []).length;

              return (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {po.number || 'Draft'}
                      </span>
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                        po.status === PurchaseOrderStatus.Confirmed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : po.status === PurchaseOrderStatus.Cancelled
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {po.status}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate">
                      {(po as any).vendorName || vend?.name || 'Vendor'}
                    </div>
                    {((po as any).vendorEmail || vend?.email) && (
                      <div className="text-xs text-slate-400 truncate mt-0.5">{(po as any).vendorEmail || vend?.email}</div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>{lineCount} {lineCount === 1 ? 'Product' : 'Products'}</span>
                      <span>{po.date}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-400">Total (Incl. GST)</span>
                    <span className="font-bold text-base text-slate-900">
                      Rs. {gstInfo.totalWithGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </MasterLayout>
      )}

      {/* FORM VIEW */}
      {viewMode === 'form' && editingPO && (
        <MasterLayout
          title="Purchase Orders"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNew={handleNew}
          onBack={handleBack}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        >
          <MasterFormView renderActions={renderFormActions}>
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Header Status Badge */}
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-2xl font-bold text-slate-800">
                  {editingPO.number || 'New Purchase Order'}
                </div>
                <span className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                  ${editingPO.status === PurchaseOrderStatus.Accepted ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
                    editingPO.status === PurchaseOrderStatus.SentToVendor ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    editingPO.status === PurchaseOrderStatus.Confirmed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                    editingPO.status === PurchaseOrderStatus.Cancelled ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-slate-200 text-slate-800 border-slate-300'}`}>
                  {editingPO.status}
                </span>
              </div>

              {/* Status Alert for Vendor Workflow */}
              {editingPO.status === PurchaseOrderStatus.SentToVendor && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2.5">
                  <Clock size={18} className="text-amber-600 animate-spin" />
                  <span>Request sent to Vendor. The vendor will review and accept this order in their Vendor Portal.</span>
                </div>
              )}

              {editingPO.status === PurchaseOrderStatus.Accepted && (
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-indigo-900 text-xs font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCheck size={18} className="text-indigo-600" />
                    <span>Vendor has accepted this order! Vendor Bill generated automatically for settlement.</span>
                  </div>
                  <button
                    onClick={() => handleOpenDirectSettle(editingPO.id || '')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                  >
                    💵 Record Hand-to-Hand Payment
                  </button>
                </div>
              )}

              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <SearchableSelect
                    label="Vendor Partner"
                    required
                    placeholder="Search vendor by name or email..."
                    value={editingPO.vendorId || ''}
                    disabled={isReadonly}
                    asyncSearchUrl="/api/contacts?type=Vendor"
                    options={vendors.map(v => ({
                      id: v.id,
                      name: v.name,
                      subtitle: v.email || v.phone,
                    }))}
                    onChange={(val) => setEditingPO({ ...editingPO, vendorId: val })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
                  <input 
                    type="date"
                    required
                    disabled={isReadonly}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    value={editingPO.date || ''}
                    onChange={e => setEditingPO({ ...editingPO, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms</label>
                  {!isReadonly ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        list="payment-terms-list"
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
                        value={customTerm || editingPO.paymentTerms || ''}
                        placeholder="Type or select term..."
                        onChange={e => {
                          setCustomTerm(e.target.value);
                          setEditingPO({ ...editingPO, paymentTerms: e.target.value });
                        }}
                      />
                      <datalist id="payment-terms-list">
                        {termsList.map((term, i) => <option key={i} value={term} />)}
                      </datalist>
                    </div>
                  ) : (
                    <input 
                      type="text"
                      disabled
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-slate-50 text-slate-500 px-3 py-2 text-sm"
                      value={editingPO.paymentTerms || ''}
                    />
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Requested Products</h3>
                <div className="border border-slate-200 rounded-xl overflow-visible bg-white">
                  <table className="w-full text-left text-sm min-w-max">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                      <tr>
                        <th className="p-3 w-12 text-center">Sr.</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">Budget Analytics</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right bg-slate-50">Total</th>
                        {!isReadonly && <th className="p-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(editingPO.lines || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No products added yet. Use &quot;Add Product&quot; or search vendor sourcing.
                          </td>
                        </tr>
                      ) : null}
                      
                      {(editingPO.lines || []).map((line, idx) => {
                        const total = line.qty * line.unitPrice;
                        
                        return (
                          <tr key={line.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2 min-w-[240px]">
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
                            </td>
                            <td className="p-2">
                              <input 
                                type="number" 
                                min="1" step="1"
                                className="w-full h-8 px-2 border border-slate-300 rounded text-sm text-right disabled:bg-transparent disabled:border-transparent font-bold"
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
                                ₹{total.toLocaleString(undefined, {minimumFractionDigits: 2})}
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
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="p-3 text-right font-medium text-slate-600 border-t border-slate-200">
                          Untaxed Purchase Subtotal:
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800 border-t border-slate-200">
                          ₹{((editingPO.lines || []).reduce((s, l) => s + (l.qty * l.unitPrice), 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        {!isReadonly && <td className="border-t border-slate-200"></td>}
                      </tr>
                      <tr className="bg-indigo-50/20 text-xs text-indigo-900">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Input Central GST (CGST 9%):
                        </td>
                        <td className="p-2 text-right font-semibold">
                          + ₹{calculateGST((editingPO.lines || []).reduce((s, l) => s + (l.qty * l.unitPrice), 0)).cgst.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        {!isReadonly && <td></td>}
                      </tr>
                      <tr className="bg-indigo-50/20 text-xs text-indigo-900">
                        <td colSpan={4} className="p-2 text-right font-medium">
                          Input State GST (SGST 9%):
                        </td>
                        <td className="p-2 text-right font-semibold">
                          + ₹{calculateGST((editingPO.lines || []).reduce((s, l) => s + (l.qty * l.unitPrice), 0)).sgst.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        {!isReadonly && <td></td>}
                      </tr>
                      <tr>
                        <td colSpan={4} className="p-4 text-right font-bold text-slate-800 border-t-2 border-indigo-200 bg-indigo-50/40">
                          Total Order Value (Incl. 18% GST):
                        </td>
                        <td className="p-4 text-right font-black text-lg text-indigo-700 border-t-2 border-indigo-200 bg-indigo-50/40">
                          ₹{calculateGST((editingPO.lines || []).reduce((s, l) => s + (l.qty * l.unitPrice), 0)).totalWithGst.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                        {!isReadonly && <td className="border-t-2 border-indigo-200 bg-indigo-50/40"></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {!isReadonly && (
                  <div className="mt-3">
                    <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100">
                      <Plus size={16} /> Add Product Line
                    </Button>
                  </div>
                )}
              </div>

            </div>
          </MasterFormView>
        </MasterLayout>
      )}

      {/* Direct Hand-to-Hand Settlement Modal */}
      {settleModalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Banknote size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Hand-to-Hand Direct Payment</h3>
                  <p className="text-xs text-slate-500">Record direct cash or bank transfer payment</p>
                </div>
              </div>
              <button
                onClick={() => setSettleModalBill(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Bill Reference:</span>
                  <span className="font-bold text-slate-900">{settleModalBill.number}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Vendor Partner:</span>
                  <span className="font-bold text-slate-900">
                    {vendors.find(v => v.id === settleModalBill.vendorId)?.name || 'Supplier'}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 text-emerald-800">
                  <span>Settlement Amount:</span>
                  <span className="text-base font-black">₹{(settleModalBill.amountDue || settleModalBill.total || 0).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    💵 Cash (Hand-to-Hand)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Bank')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentMethod === 'Bank'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    🏦 Bank Transfer / Direct
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettleModalBill(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRecordDirectPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm & Mark as Paid
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

