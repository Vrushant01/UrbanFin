import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type SalesOrder, SalesOrderStatus, type SalesOrderLine, 
  type Contact, type Product, type AnalyticAccount, ContactType
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  
  const [sos, setSos] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  
  const [editingSO, setEditingSO] = useState<Partial<SalesOrder> | null>(null);

  // Load data
  useEffect(() => {
    setSos(mockDb.getSalesOrders());
    setCustomers(mockDb.getContacts().filter(c => c.type === ContactType.Customer || c.type === ContactType.Both));
    setProducts(mockDb.getProducts());
    setAnalytics(mockDb.getAnalyticAccounts());
  }, [viewMode]);

  const filteredSos = useMemo(() => {
    if (!searchTerm) return sos;
    const lower = searchTerm.toLowerCase();
    return sos.filter(s => 
      s.number?.toLowerCase().includes(lower) || 
      s.status.toLowerCase().includes(lower)
    );
  }, [sos, searchTerm]);

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

  const handleSave = (status: SalesOrderStatus = SalesOrderStatus.Draft) => {
    if (!editingSO || !editingSO.customerId) return;

    const finalSO = { ...editingSO, status } as SalesOrder;

    if (finalSO.id) {
      mockDb.updateSalesOrder(finalSO.id, finalSO);
    } else {
      mockDb.addSalesOrder(finalSO as Omit<SalesOrder, 'id' | 'number'>);
    }
    
    setSos(mockDb.getSalesOrders());
    setViewMode('list');
    setEditingSO(null);
  };

  const handleCancel = () => {
    if (!editingSO || !editingSO.id) return;
    mockDb.updateSalesOrder(editingSO.id, { status: SalesOrderStatus.Cancelled });
    setSos(mockDb.getSalesOrders());
    setViewMode('list');
    setEditingSO(null);
  };

  const handleCreateInvoice = () => {
    if (!editingSO || !editingSO.id) return;
    navigate(`/sales/invoices/new?fromSo=${editingSO.id}`);
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
    { key: 'number', header: 'SO No.' },
    { 
      key: 'customerId', 
      header: 'Customer',
      render: (s) => {
        const cust = customers.find(c => c.id === s.customerId);
        return cust ? cust.name : 'Unknown';
      }
    },
    { key: 'date', header: 'Order Date' },
    { 
      key: 'total', 
      header: 'Total',
      render: (s) => {
        const total = s.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        return <span className="font-semibold text-indigo-700">Rs. {total.toLocaleString()}</span>;
      }
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (s) => {
        const colors = {
          [SalesOrderStatus.Draft]: 'bg-slate-100 text-slate-700',
          [SalesOrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
          [SalesOrderStatus.Cancelled]: 'bg-red-50 text-red-700',
        };
        return (
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors[s.status]}`}>
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
  let totalOrderValue = (editingSO?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);

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
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <ShoppingCart size={48} className="mb-4 text-slate-300" />
          <p>Kanban view not enabled for Sales Orders.</p>
          <button onClick={() => setViewMode('list')} className="mt-4 text-indigo-600 hover:underline">Switch to List View</button>
        </div>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingSO.customerId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingSO({ ...editingSO, customerId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
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
                          <td className="p-2">
                            <select 
                              className="w-full min-w-[200px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent font-medium"
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
                              className="w-full min-w-[150px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent font-medium"
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
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="p-4 text-right font-medium text-slate-600 border-t border-slate-200">
                        Total Amount
                      </td>
                      <td className="p-4 text-right font-bold text-lg text-indigo-700 border-t border-slate-200 bg-indigo-50/30">
                        Rs. {totalOrderValue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      {!isReadonly && <td className="border-t border-slate-200"></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {!isReadonly && (
                <div className="mt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100">
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
