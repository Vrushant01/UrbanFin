import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  Package, 
  ShoppingCart, 
  FileText, 
  Plus, 
  CheckCircle, 
  XCircle, 
  LogOut, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Layers, 
  DollarSign, 
  Clock, 
  CheckCheck,
  AlertCircle,
  X
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

interface VendorProductItem {
  id: string;
  name: string;
  categoryId?: string;
  price: number;
  stockQuantity: number;
  description?: string;
  image?: string;
}

interface PurchaseOrderItem {
  id: string;
  number: string;
  date: string;
  paymentTerms: string;
  status: string;
  total: number;
  lines: Array<{
    id: string;
    productId: string;
    productName?: string;
    qty: number;
    unitPrice: number;
  }>;
}

interface VendorBillItem {
  id: string;
  number: string;
  billReference: string;
  billDate: string;
  dueDate: string;
  status: string;
  total: number;
  amountPaid: number;
  amountDue: number;
}

export function VendorPortal() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'bills'>('products');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [products, setProducts] = useState<VendorProductItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [bills, setBills] = useState<VendorBillItem[]>([]);

  // Modal State for Add / Edit Product
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProductItem | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    stockQuantity: '',
    description: '',
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchVendorData = async () => {
    setLoading(true);
    try {
      // 1. Products
      const pData = await fetchWithCache<VendorProductItem[]>('/api/vendor-portal/products');
      setProducts(pData);

      // 2. Orders
      const oData = await fetchWithCache<PurchaseOrderItem[]>('/api/vendor-portal/orders');
      setOrders(oData);

      // 3. Bills
      const bData = await fetchWithCache<VendorBillItem[]>('/api/vendor-portal/bills');
      setBills(bData);
    } catch (err) {
      console.error('[VendorPortal] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Product Actions
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', price: '', stockQuantity: '', description: '' });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: VendorProductItem) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      price: prod.price.toString(),
      stockQuantity: prod.stockQuantity.toString(),
      description: prod.description || '',
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showToast('error', 'Product name is required');
      return;
    }

    const payload = {
      name: productForm.name.trim(),
      price: parseFloat(productForm.price) || 0,
      stockQuantity: parseInt(productForm.stockQuantity) || 0,
      description: productForm.description.trim(),
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/vendor-portal/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/vendor-portal/products', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        showToast('success', editingProduct ? 'Product updated successfully!' : 'Product added to catalog and synchronized!');
        setIsProductModalOpen(false);
        clientCache.invalidate('GET:/api/vendor-portal');
        fetchVendorData();
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Failed to save product');
      }
    } catch (e: any) {
      showToast('error', e.message || 'Network error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product from your catalog?')) return;
    try {
      const res = await fetch(`/api/vendor-portal/products/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast('success', 'Product removed successfully');
        clientCache.invalidate('GET:/api/vendor-portal');
        fetchVendorData();
      }
    } catch (e) {
      showToast('error', 'Failed to remove product');
    }
  };

  // Order Actions
  const handleAcceptOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/vendor-portal/orders/${orderId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('success', `Order accepted! Bill #${data.bill?.number || 'BILL/2026/0001'} generated and sent to Admin.`);
        clientCache.invalidate('GET:/api/vendor-portal');
        fetchVendorData();
      } else {
        showToast('error', data.message || 'Failed to accept order');
      }
    } catch (e: any) {
      showToast('error', e.message || 'Network error');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to reject this purchase order?')) return;
    try {
      const res = await fetch(`/api/vendor-portal/orders/${orderId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast('success', 'Order has been rejected.');
        clientCache.invalidate('GET:/api/vendor-portal');
        fetchVendorData();
      }
    } catch (e: any) {
      showToast('error', e.message || 'Network error');
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalStock = products.reduce((acc, p) => acc + (p.stockQuantity || 0), 0);
    const pendingOrders = orders.filter((o) => o.status === 'Draft' || o.status === 'Sent to Vendor').length;
    const totalBilled = bills.reduce((acc, b) => acc + (b.total || 0), 0);
    const totalPaid = bills.filter((b) => b.status === 'Paid').reduce((acc, b) => acc + (b.total || 0), 0);

    return { totalStock, pendingOrders, totalBilled, totalPaid };
  }, [products, orders, bills]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-black flex items-center justify-center shadow-md">
              <Store size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">UrbanFin Vendor Portal</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  Verified Supplier
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Logged in as: <strong className="text-slate-700">{currentUser?.name}</strong> (@{currentUser?.loginId})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchVendorData}
              disabled={loading}
              className="gap-1.5 text-xs font-semibold"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-purple-600' : ''} />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <CheckCircle size={20} className="text-emerald-600" />
              ) : (
                <AlertCircle size={20} className="text-rose-600" />
              )}
              <span className="text-sm font-semibold">{toast.text}</span>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Catalog Products</span>
              <Package size={18} className="text-purple-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{products.length}</div>
            <p className="text-xs text-slate-400 mt-1">{metrics.totalStock} total units in stock</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Orders</span>
              <ShoppingCart size={18} className="text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-2">{metrics.pendingOrders}</div>
            <p className="text-xs text-slate-400 mt-1">Awaiting your acceptance</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Billed</span>
              <DollarSign size={18} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-900 mt-2">
              ₹{metrics.totalBilled.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-1">{bills.length} generated bills</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Settled / Paid</span>
              <CheckCheck size={18} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-800 mt-2">
              ₹{metrics.totalPaid.toLocaleString()}
            </div>
            <p className="text-xs text-emerald-600 font-medium mt-1">Hand-to-Hand & Direct</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs flex gap-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Package size={17} />
            <span>My Product Catalog ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer relative ${
              activeTab === 'orders'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShoppingCart size={17} />
            <span>Incoming PO Requests ({orders.length})</span>
            {metrics.pendingOrders > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bills')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'bills'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText size={17} />
            <span>My Bills & Settlements ({bills.length})</span>
          </button>
        </div>

        {/* TAB 1: PRODUCT CATALOG */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Manage Your Supply Catalog</h2>
                <p className="text-xs text-slate-500">Products added here are immediately visible to Urban Furniture procurement team.</p>
              </div>
              <Button
                variant="primary"
                onClick={handleOpenAddProduct}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 shadow-xs"
              >
                <Plus size={16} />
                <span>Add New Product</span>
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Product Details</th>
                    <th className="py-3.5 px-6">Unit Supply Price</th>
                    <th className="py-3.5 px-6">Current Stock Available</th>
                    <th className="py-3.5 px-6">Description</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No products added to catalog yet. Click &quot;Add New Product&quot; to begin.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-xs text-purple-600 font-semibold">SKU: {p.id.slice(-6).toUpperCase()}</div>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900">
                          ₹{p.price.toLocaleString()}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.stockQuantity > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {p.stockQuantity} Units
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs max-w-xs truncate">
                          {p.description || '—'}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                              title="Edit product"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete product"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: INCOMING ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Purchase Orders from Urban Furniture</h2>
              <p className="text-xs text-slate-500">Review requested items and accept orders to automatically create your Vendor Bill.</p>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                No incoming purchase order requests at this time.
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const isPending = order.status === 'Draft' || order.status === 'Sent to Vendor';
                  const isAccepted = order.status === 'Accepted' || order.status === 'Confirmed';
                  const isCancelled = order.status === 'Cancelled';

                  return (
                    <div key={order.id} className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-lg">{order.number}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isAccepted ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              isCancelled ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">Order Date: {order.date} | Payment Terms: {order.paymentTerms}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-400 uppercase font-bold">Total Order Value</div>
                          <div className="text-xl font-black text-indigo-600">₹{order.total.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="border border-slate-100 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-bold">
                            <tr>
                              <th className="py-2.5 px-4">Item</th>
                              <th className="py-2.5 px-4 text-right">Quantity</th>
                              <th className="py-2.5 px-4 text-right">Unit Price</th>
                              <th className="py-2.5 px-4 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(order.lines || []).map((l, i) => (
                              <tr key={i}>
                                <td className="py-2.5 px-4 font-semibold text-slate-800">{l.productName || 'Requested Product'}</td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-700">{l.qty}</td>
                                <td className="py-2.5 px-4 text-right text-slate-600">₹{l.unitPrice.toLocaleString()}</td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{(l.qty * l.unitPrice).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Order Action Buttons */}
                      {isPending && (
                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectOrder(order.id)}
                            className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                          >
                            <XCircle size={15} />
                            <span>Reject Order</span>
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleAcceptOrder(order.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
                          >
                            <CheckCircle size={15} />
                            <span>Accept Order & Generate Bill</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BILLS & SETTLEMENTS */}
        {activeTab === 'bills' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Your Submitted Vendor Bills</h2>
              <p className="text-xs text-slate-500">Track bills generated from accepted purchase orders and their settlement status.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Bill Number</th>
                    <th className="py-3.5 px-6">PO Reference</th>
                    <th className="py-3.5 px-6">Bill Date / Due Date</th>
                    <th className="py-3.5 px-6">Total Amount</th>
                    <th className="py-3.5 px-6">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No vendor bills generated yet. Accept incoming orders to generate bills.
                      </td>
                    </tr>
                  ) : (
                    bills.map((b) => {
                      const isPaid = b.status === 'Paid';
                      return (
                        <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            {b.number}
                          </td>
                          <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                            {b.billReference || 'PO Order'}
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-600">
                            <div>Date: {b.billDate}</div>
                            <div className="text-slate-400">Due: {b.dueDate}</div>
                          </td>
                          <td className="py-4 px-6 font-black text-slate-900">
                            ₹{(b.total || 0).toLocaleString()}
                          </td>
                          <td className="py-4 px-6">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle size={13} className="text-emerald-600" /> Settled (Paid)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock size={13} className="text-amber-600" /> Pending Admin Payment
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Package size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? 'Edit Catalog Product' : 'Add Product to Supply Catalog'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <Input
                label="Product Name"
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="e.g. Ergonomic Office Chair"
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Supply Price (₹)"
                  type="number"
                  step="0.01"
                  required
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  placeholder="e.g. 6500"
                />

                <Input
                  label="Available Stock (Units)"
                  type="number"
                  min="0"
                  required
                  value={productForm.stockQuantity}
                  onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                  placeholder="e.g. 50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Description / Specifications
                </label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Material, warranty, specifications, etc."
                  className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProductModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {editingProduct ? 'Save Changes' : 'Add to Catalog'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
