import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type SalesOrder, SalesOrderStatus, type SalesOrderLine, 
  CustomerInvoiceStatus,
  type Contact, type Product, type AnalyticAccount, ContactType
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';
import { calculateGST } from '../../utils/gstUtils';

const DEFAULT_SO: Partial<SalesOrder> = {
  customerId: '',
  date: new Date().toISOString().split('T')[0],
  status: SalesOrderStatus.Draft,
  lines: []
};

export function SalesOrderMaster() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [sos, setSos] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [eligibleAnalytics, setEligibleAnalytics] = useState<AnalyticAccount[]>([]);
  
  const [editingSO, setEditingSO] = useState<Partial<SalesOrder> | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const soData = await fetchWithCache<SalesOrder[]>(`/api/sales-orders?search=${encodeURIComponent(query)}`);
      setSos(soData);
    } catch {
      setSos(mockDb.getSalesOrders());
    }

    try {
      const cData = await fetchWithCache<Contact[]>('/api/contacts?type=Customer');
      setCustomers(cData);
    } catch {
      setCustomers(mockDb.getContacts().filter(c => c.type === ContactType.Customer || c.type === ContactType.Both));
    }

    try {
      const pData = await fetchWithCache<Product[]>('/api/products');
      setProducts(pData);
    } catch {
      setProducts(mockDb.getProducts());
    }

    try {
      const aData = await fetchWithCache<AnalyticAccount[]>('/api/analytics');
      setAnalytics(aData);
    } catch {
      setAnalytics(mockDb.getAnalyticAccounts());
    }

    try {
      const eData = await fetchWithCache<AnalyticAccount[]>('/api/analytics/eligible');
      setEligibleAnalytics(eData);
    } catch {
      setEligibleAnalytics(mockDb.getEligibleAnalyticAccounts());
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredSos = sos;

  // Actions
  const handleNew = () => {
    setEditingSO({ 
      ...DEFAULT_SO, 
      customerId: customers.length > 0 ? customers[0].id : '' 
    });
    setViewMode('form');
  };

  const handleEdit = (so: SalesOrder) => {
    setEditingSO({ ...so });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingSO(null);
    setViewMode('list');
  };

  const handleSave = async (status: SalesOrderStatus = SalesOrderStatus.Draft) => {
    if (!editingSO || !editingSO.customerId) return;

    const finalSO = { ...editingSO, status } as SalesOrder;

    try {
      if (finalSO.id) {
        await fetch(`/api/sales-orders/${finalSO.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(finalSO),
        });
      } else {
        await fetch('/api/sales-orders', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(finalSO),
        });
      }
      clientCache.invalidate('GET:/api/sales-orders');
      clientCache.invalidate('GET:/api/dashboard/summary');
      await loadData();
    } catch (e) {
      if (finalSO.id) {
        mockDb.updateSalesOrder(finalSO.id, finalSO);
      } else {
        mockDb.addSalesOrder(finalSO as Omit<SalesOrder, 'id' | 'number'>);
      }
      setSos(mockDb.getSalesOrders());
    }
    
    setViewMode('list');
    setEditingSO(null);
  };

  const handleCancel = async () => {
    if (!editingSO || !editingSO.id) return;
    try {
      await fetch(`/api/sales-orders/${editingSO.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: SalesOrderStatus.Cancelled }),
      });
      clientCache.invalidate('GET:/api/sales-orders');
      clientCache.invalidate('GET:/api/dashboard/summary');
      await loadData();
    } catch {
      mockDb.updateSalesOrder(editingSO.id, { status: SalesOrderStatus.Cancelled });
      setSos(mockDb.getSalesOrders());
    }
    setViewMode('list');
    setEditingSO(null);
  };

  const handleCreateInvoice = async () => {
    if (!editingSO) return;

    try {
      const invoicePayload = {
        customerId: editingSO.customerId,
        invoiceReference: editingSO.number || '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        soReferenceId: editingSO.id,
        status: CustomerInvoiceStatus.Draft,
        lines: (editingSO.lines || []).map((l) => ({
          productId: l.productId,
          analyticAccountId: l.analyticAccountId || undefined,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      };

      const res = await fetch('/api/customer-invoices', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(invoicePayload),
      });

      if (res.ok) {
        const createdInv = await res.json();
        clientCache.invalidate('GET:/api/customer-invoices');
        clientCache.invalidate('GET:/api/dashboard/summary');
        mockDb.addCustomerInvoice(createdInv);
        navigate(`/sales/invoices?createdId=${createdInv.id || createdInv._id}`);
        return;
      }
    } catch (e) {
      console.warn('API create invoice failed, navigating to invoice form', e);
    }

    navigate(`/sales/invoices?fromSo=${editingSO.id}`);
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingSO) return;
    const initialProduct = products.length > 0 ? products[0] : null;
    const newLine: SalesOrderLine = {
      id: Math.random().toString(36).substr(2, 9),
      productId: initialProduct ? initialProduct.id : '',
      analyticAccountId: '',
      qty: 1,
      unitPrice: initialProduct ? initialProduct.salesPrice : 0
    };
    setEditingSO({
      ...editingSO,
      lines: [...(editingSO.lines || []), newLine]
    });
  };

  const removeLine = (id: string) => {
    if (!editingSO) return;
    setEditingSO({
      ...editingSO,
      lines: editingSO.lines?.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof SalesOrderLine, value: any) => {
    if (!editingSO) return;
    setEditingSO({
      ...editingSO,
      lines: editingSO.lines?.map(l => {
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

  // List View configuration
  const columns: Column<SalesOrder>[] = [
    { key: 'number', header: 'SO NO.' },
    { 
      key: 'customerId', 
      header: 'CUSTOMER',
      render: (s) => {
        const cust = customers.find(c => c.id === s.customerId);
        return <span className="font-medium text-slate-800">{(s as any).customerName || cust?.name || 'Customer'}</span>;
      }
    },
    { key: 'date', header: 'ORDER DATE' },
    { 
      key: 'total', 
      header: 'TOTAL (INCL. GST)',
      render: (s) => {
        const rawTotal = s.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
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
      render: (s) => {
        const colors: Record<string, string> = {
          [SalesOrderStatus.Draft]: 'bg-slate-100 text-slate-700 border-slate-200',
          [SalesOrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          [SalesOrderStatus.Cancelled]: 'bg-rose-50 text-rose-700 border-rose-200/80',
        };
        return (
          <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md border ${colors[s.status] || 'bg-slate-100 text-slate-700'}`}>
            {s.status}
          </span>
        );
      }
    }
  ];

  const renderFormActions = () => {
    if (!editingSO) return null;
    
    if (editingSO.status === SalesOrderStatus.Confirmed) {
      return (
        <>
          <Button type="button" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleCreateInvoice} className="gap-2">
            Create Invoice <ArrowRight size={16} />
          </Button>
        </>
      );
    }

    if (editingSO.status === SalesOrderStatus.Cancelled) {
      return null;
    }

    // Draft
    return (
      <>
        {editingSO.id && (
          <Button type="button" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Cancel
          </Button>
        )}
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => handleSave(SalesOrderStatus.Draft)}
        >
          Save Draft
        </Button>
        <Button 
          type="button" 
          variant="primary"
          disabled={!editingSO.lines?.length || !editingSO.customerId}
          onClick={() => handleSave(SalesOrderStatus.Confirmed)}
        >
          Confirm Order
        </Button>
      </>
    );
  };

  const isReadonly = editingSO?.status !== SalesOrderStatus.Draft;
  const subtotalUntaxed = (editingSO?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
  const gstBreakdown = calculateGST(subtotalUntaxed);
  const totalOrderValue = gstBreakdown.totalWithGst;

  return (
    <MasterLayout
      title="Sales Orders"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredSos} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={s => s.id} 
        />
      )}
      
      {viewMode === 'kanban' && (
        <MasterKanbanView
          data={filteredSos}
          keyExtractor={s => s.id}
          onCardClick={handleEdit}
          renderCard={(so) => {
            const cust = customers.find(c => c.id === so.customerId);
            const subtotal = (so.lines || []).reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
            const gstInfo = calculateGST(subtotal);
            const lineCount = (so.lines || []).length;

            return (
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {so.number || 'Draft'}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                      so.status === SalesOrderStatus.Confirmed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : so.status === SalesOrderStatus.Cancelled
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {so.status}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate">
                    {(so as any).customerName || cust?.name || 'Customer'}
                  </div>
                  {((so as any).customerEmail || cust?.email) && (
                    <div className="text-xs text-slate-400 truncate mt-0.5">{(so as any).customerEmail || cust?.email}</div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>{lineCount} {lineCount === 1 ? 'Product' : 'Products'}</span>
                    <span>{so.date}</span>
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
      )}

      {viewMode === 'form' && editingSO && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800">
                {editingSO.number || 'New Sales Order'}
              </div>
              <span className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                ${editingSO.status === SalesOrderStatus.Confirmed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                  editingSO.status === SalesOrderStatus.Cancelled ? 'bg-red-100 text-red-800 border-red-200' :
                  'bg-slate-200 text-slate-800 border-slate-300'}`}>
                {editingSO.status}
              </span>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <SearchableSelect
                  label="Customer Name"
                  required
                  placeholder="Search customer by name or email..."
                  value={editingSO.customerId || ''}
                  disabled={isReadonly}
                  asyncSearchUrl="/api/contacts?type=Customer"
                  options={customers.map(c => ({
                    id: c.id,
                    name: c.name,
                    subtitle: c.email || c.phone,
                  }))}
                  onChange={(val) => setEditingSO({ ...editingSO, customerId: val })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingSO.date || ''}
                  onChange={e => setEditingSO({ ...editingSO, date: e.target.value })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Products</h3>
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
                    {(editingSO.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No products added yet.
                        </td>
                      </tr>
                    ) : null}
                    
                    {(editingSO.lines || []).map((line, idx) => {
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
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-medium text-slate-600 border-t border-slate-200">
                        Untaxed Subtotal:
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-800 border-t border-slate-200">
                        Rs. {subtotalUntaxed.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      {!isReadonly && <td className="border-t border-slate-200"></td>}
                    </tr>
                    <tr className="bg-blue-50/20 text-xs text-blue-900">
                      <td colSpan={4} className="p-2 text-right font-medium">
                        Central GST (CGST 9%):
                      </td>
                      <td className="p-2 text-right font-semibold">
                        + Rs. {gstBreakdown.cgst.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      {!isReadonly && <td></td>}
                    </tr>
                    <tr className="bg-blue-50/20 text-xs text-blue-900">
                      <td colSpan={4} className="p-2 text-right font-medium">
                        State GST (SGST 9%):
                      </td>
                      <td className="p-2 text-right font-semibold">
                        + Rs. {gstBreakdown.sgst.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      {!isReadonly && <td></td>}
                    </tr>
                    <tr>
                      <td colSpan={4} className="p-4 text-right font-bold text-slate-800 border-t-2 border-blue-200 bg-blue-50/40">
                        Grand Total (Incl. 18% GST):
                      </td>
                      <td className="p-4 text-right font-black text-lg text-blue-700 border-t-2 border-blue-200 bg-blue-50/40">
                        Rs. {totalOrderValue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      {!isReadonly && <td className="border-t-2 border-blue-200 bg-blue-50/40"></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {!isReadonly && (
                <div className="mt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-blue-600 bg-blue-50 hover:bg-blue-100">
                    <Plus size={16} /> Add Product
                  </Button>
                </div>
              )}
            </div>

          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
