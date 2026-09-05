import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { 
  Store, 
  Search, 
  Package, 
  Send, 
  CheckCircle, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Layers, 
  DollarSign, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  Filter, 
  RefreshCw,
  ShoppingBag,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { calculateGST } from '../../utils/gstUtils';
import { Link, useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

interface SourcingItem {
  id: string;
  name: string;
  categoryId?: string;
  price: number;
  stockQuantity: number;
  description?: string;
  image?: string;
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorCity?: string;
}

export function VendorSourcingHub() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 250);
  const [items, setItems] = useState<SourcingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Request order modal state
  const [selectedItem, setSelectedItem] = useState<SourcingItem | null>(null);
  const [requestQty, setRequestQty] = useState<number>(5);
  const [paymentTerms, setPaymentTerms] = useState<string>('15 Days');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string; poNumber?: string } | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchSourcingData = async (query: string = debouncedQuery) => {
    setLoading(true);
    try {
      const data = await fetchWithCache<SourcingItem[]>(`/api/vendor-portal/sourcing?query=${encodeURIComponent(query)}`);
      setItems(data);
    } catch (err) {
      console.error('[SourcingHub] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSourcingData(debouncedQuery);
  }, [debouncedQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSourcingData(debouncedQuery);
  };

  const handleOpenRequestModal = (item: SourcingItem) => {
    setSelectedItem(item);
    setRequestQty(Math.min(10, item.stockQuantity > 0 ? item.stockQuantity : 1));
  };

  const handleSendPurchaseRequest = async () => {
    if (!selectedItem) return;
    if (requestQty <= 0) {
      alert('Please enter a valid quantity of 1 or more.');
      return;
    }

    setSubmittingReq(true);
    try {
      const res = await fetch('/api/vendor-portal/request-order', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          vendorId: selectedItem.vendorId,
          productName: selectedItem.name,
          qty: requestQty,
          unitPrice: selectedItem.price,
          paymentTerms: paymentTerms,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({
          type: 'success',
          text: `Purchase Request for ${requestQty}x "${selectedItem.name}" dispatched to ${selectedItem.vendorName}!`,
          poNumber: data.order?.number,
        });
        setSelectedItem(null);
      } else {
        setToastMessage({
          type: 'error',
          text: data.message || 'Failed to send purchase request to vendor.',
        });
      }
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: 'Network error occurred while communicating with vendor server.',
      });
    } finally {
      setSubmittingReq(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'ALL') return items;
    return items.filter(i => (i.description || '').toLowerCase().includes(selectedCategory.toLowerCase()) || i.name.toLowerCase().includes(selectedCategory.toLowerCase()));
  }, [items, selectedCategory]);

  return (
    <MasterLayout
      title="Vendor Sourcing & Marketplace"
      viewMode="list"
      hideNewButton
      hideSearch
    >
      <div className="max-w-7xl mx-auto space-y-6">



        {/* Toast Alert */}
        {toastMessage && (
          <div className={`p-4 rounded-xl border flex items-center justify-between animate-fade-in ${
            toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-3">
              {toastMessage.type === 'success' ? <CheckCheck size={20} className="text-emerald-600" /> : <AlertCircle size={20} className="text-rose-600" />}
              <div>
                <p className="font-bold text-sm">{toastMessage.text}</p>
                {toastMessage.poNumber && (
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Order Ref: <strong>{toastMessage.poNumber}</strong> — Track it anytime in{' '}
                    <Link to="/purchase/orders" className="underline font-bold hover:text-emerald-900">Purchase Orders</Link>.
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
              <CheckCircle size={16} />
            </button>
          </div>
        )}

        {/* Search & Sourcing Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder='Search needed products e.g. "chair", "wood", "table", "timber", "leather"...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white transition-colors"
              />
            </div>
            <Button type="submit" variant="primary" className="gap-2 px-6 py-3 h-auto text-sm font-bold shrink-0">
              <Search size={16} /> Search Sourcing Catalog
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setSearchQuery(''); fetchSourcingData(''); }}
              className="gap-2 py-3 h-auto shrink-0 text-slate-600"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Reset
            </Button>
          </form>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
              <Filter size={13} /> Filter:
            </span>
            {[
              { id: 'ALL', label: 'All Products' },
              { id: 'chair', label: '🪑 Chairs & Seating' },
              { id: 'table', label: '🪵 Tables & Desks' },
              { id: 'wood', label: '🌲 Timber & Raw Wood' },
              { id: 'hardware', label: '🔩 Hardware & Fittings' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            Available Supplier Offerings
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {filteredItems.length} Products Found
            </span>
          </h3>
          <Link to="/purchase/orders" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <ShoppingBag size={15} /> View All Purchase Orders <ArrowRight size={14} />
          </Link>
        </div>

        {/* Sourcing Items Grid */}
        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
            <RefreshCw size={32} className="animate-spin text-indigo-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Searching verified vendor suppliers in database...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
            <Store size={48} className="text-slate-300 mx-auto mb-3" />
            <h4 className="text-lg font-bold text-slate-700 mb-1">No matching supplier products found</h4>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
              Try searching with another keyword (e.g. "chair", "table", "wood") or ask new vendors to register and list their items in the Vendor Portal.
            </p>
            <Button variant="secondary" onClick={() => { setSearchQuery(''); fetchSourcingData(''); }}>
              Show All Sourcing Catalog
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <div 
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-6 space-y-4">
                  {/* Top Bar: Stock & Supplier Badge */}
                  <div className="flex justify-between items-start">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                      <Store size={12} /> {item.vendorName}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      item.stockQuantity > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      item.stockQuantity > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      <Package size={12} /> {item.stockQuantity} In Stock
                    </span>
                  </div>

                  {/* Product Title & Description */}
                  <div>
                    <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Vendor Contact Info */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800">{item.vendorName}</span>
                    </div>
                    {item.vendorEmail && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span>{item.vendorEmail}</span>
                      </div>
                    )}
                    {item.vendorPhone && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{item.vendorPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Footer: Price & Send Request */}
                <div className="p-6 pt-0 mt-auto">
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Supply Unit Price</div>
                      <div className="text-xl font-black text-slate-900">
                        Rs. {item.price.toLocaleString()}
                      </div>
                    </div>
                    <Button 
                      variant="primary" 
                      onClick={() => handleOpenRequestModal(item)}
                      className="gap-2 font-bold text-xs px-4 py-2.5 shadow-xs"
                      disabled={item.stockQuantity <= 0}
                    >
                      <Send size={14} /> Make Request (Req)
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Make Purchase Request (Req) */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in">
              <div className="p-6 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-200">Send Sourcing Request</div>
                  <h3 className="text-xl font-black mt-0.5">Order Request for {selectedItem.name}</h3>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-white/80 hover:text-white p-1">
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Vendor Summary */}
                <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 flex justify-between items-center text-sm">
                  <div>
                    <div className="text-xs text-indigo-600 font-bold uppercase">Target Vendor</div>
                    <div className="font-black text-indigo-950 text-base">{selectedItem.vendorName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Available Stock: <strong>{selectedItem.stockQuantity} units</strong></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Unit Price</div>
                    <div className="font-black text-slate-900 text-lg">Rs. {selectedItem.price.toLocaleString()}</div>
                  </div>
                </div>

                {/* Desired Qty */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Requested Order Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={selectedItem.stockQuantity || 1000}
                      value={requestQty}
                      onChange={(e) => setRequestQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full h-11 px-3 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Units</span>
                  </div>
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Proposed Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full h-11 px-3 border border-slate-300 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Immediate Payment">Immediate Settlement (Cash / Hand-to-Hand)</option>
                    <option value="15 Days">Net 15 Days</option>
                    <option value="30 Days">Net 30 Days</option>
                    <option value="End of Following Month">End of Following Month</option>
                  </select>
                </div>

                {/* Total Cost Estimate with GST */}
                {(() => {
                  const rawSubtotal = selectedItem.price * requestQty;
                  const { cgst, sgst, totalWithGst } = calculateGST(rawSubtotal);
                  return (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Untaxed Sourcing Value:</span>
                        <span className="font-semibold text-slate-800">Rs. {rawSubtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-indigo-700">
                        <span>Input GST (CGST 9% + SGST 9%):</span>
                        <span className="font-bold">+ Rs. {(cgst + sgst).toLocaleString()}</span>
                      </div>
                      <div className="pt-2 border-t border-indigo-200 flex justify-between items-center">
                        <div>
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Purchase Value</span>
                          <p className="text-[11px] text-slate-500">Auto-billed on vendor acceptance (Incl. 18% GST)</p>
                        </div>
                        <div className="text-2xl font-black text-indigo-700">
                          Rs. {totalWithGst.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Actions */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setSelectedItem(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSendPurchaseRequest}
                  disabled={submittingReq || requestQty <= 0}
                  className="gap-2 font-bold px-6 shadow-xs"
                >
                  <Send size={16} /> {submittingReq ? 'Sending Request...' : 'Dispatch Request (Req)'}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MasterLayout>
  );
}
