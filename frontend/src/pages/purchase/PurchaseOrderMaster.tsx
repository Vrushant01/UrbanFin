import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type PurchaseOrder, PurchaseOrderStatus, type PurchaseOrderLine, 
  type Contact, type Product, type AnalyticAccount, ContactType
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Plus, Trash2, FileText, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_PO: Partial<PurchaseOrder> = {
  vendorId: '',
  date: new Date().toISOString().split('T')[0],
  paymentTerms: 'Immediate Payment',
  status: PurchaseOrderStatus.Draft,
  lines: []
};

export function PurchaseOrderMaster() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [termsList, setTermsList] = useState<string[]>([]);
  
  const [editingPO, setEditingPO] = useState<Partial<PurchaseOrder> | null>(null);
  
  // Create on the fly state
  const [customTerm, setCustomTerm] = useState('');

  // Load data
  useEffect(() => {
    setPos(mockDb.getPurchaseOrders());
    setVendors(mockDb.getContacts().filter(c => c.type === ContactType.Vendor || c.type === ContactType.Both));
    setProducts(mockDb.getProducts());
    setAnalytics(mockDb.getAnalyticAccounts());
    setTermsList(mockDb.getPaymentTerms());
  }, [viewMode]);

  const filteredPos = useMemo(() => {
    if (!searchTerm) return pos;
    const lower = searchTerm.toLowerCase();
    return pos.filter(p => 
      p.number?.toLowerCase().includes(lower) || 
      p.status.toLowerCase().includes(lower)
    );
  }, [pos, searchTerm]);

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

  const handleSave = (status: PurchaseOrderStatus = PurchaseOrderStatus.Draft) => {
    if (!editingPO || !editingPO.vendorId) return;

    let finalTerm = editingPO.paymentTerms;
    if (customTerm && !termsList.includes(customTerm)) {
      mockDb.addPaymentTerm(customTerm);
      finalTerm = customTerm;
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
        
        // Auto-fill unit price when product changes
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
    { key: 'number', header: 'PO No.' },
    { 
      key: 'vendorId', 
      header: 'Vendor',
      render: (p) => {
        const vendor = vendors.find(v => v.id === p.vendorId);
        return vendor ? vendor.name : 'Unknown';
      }
    },
    { key: 'date', header: 'Order Date' },
    { 
      key: 'total', 
      header: 'Total',
      render: (p) => {
        const total = p.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
        return <span className="font-semibold">Rs. {total.toLocaleString()}</span>;
      }
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (p) => {
        const colors = {
          [PurchaseOrderStatus.Draft]: 'bg-slate-100 text-slate-700',
          [PurchaseOrderStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
          [PurchaseOrderStatus.Cancelled]: 'bg-red-50 text-red-700',
        };
        return (
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors[p.status]}`}>
            {p.status}
          </span>
        );
      }
    }
  ];

  const renderFormActions = () => {
    if (!editingPO) return null;
    
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

    // Draft
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
          onClick={() => handleSave(PurchaseOrderStatus.Confirmed)}
        >
          Confirm Order
        </Button>
      </>
    );
  };

  const isReadonly = editingPO?.status !== PurchaseOrderStatus.Draft;
  let totalOrderValue = (editingPO?.lines || []).reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);

  return (
    <MasterLayout
      title="Purchase Orders"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredPos} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={p => p.id} 
        />
      )}
      
      {viewMode === 'kanban' && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <FileText size={48} className="mb-4 text-slate-300" />
          <p>Kanban view not enabled for Purchase Orders.</p>
          <button onClick={() => setViewMode('list')} className="mt-4 text-indigo-600 hover:underline">Switch to List View</button>
        </div>
      )}

      {viewMode === 'form' && editingPO && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800">
                {editingPO.number || 'New Purchase Order'}
              </div>
              <span className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                ${editingPO.status === PurchaseOrderStatus.Confirmed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                  editingPO.status === PurchaseOrderStatus.Cancelled ? 'bg-red-100 text-red-800 border-red-200' :
                  'bg-slate-200 text-slate-800 border-slate-300'}`}>
                {editingPO.status}
              </span>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingPO.vendorId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingPO({ ...editingPO, vendorId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select Vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
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
                    {(editingPO.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No products added yet.
                        </td>
                      </tr>
                    ) : null}
                    
                    {(editingPO.lines || []).map((line, idx) => {
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
