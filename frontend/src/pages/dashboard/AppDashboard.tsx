import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight,
  ShoppingBag
} from 'lucide-react';
import { fetchWithCache } from '../../utils/clientCache';
import { mockDb } from '../../mock/db';
import { SalesOrderStatus, CustomerInvoiceStatus, VendorBillStatus } from '../../types';

interface DashboardStats {
  customerStats: {
    total: number;
    new: number;
    returning: number;
    inactive: number;
  };
  vendorStats: {
    total: number;
  };
  salesStats: {
    all: number;
    confirmed: number;
    draft: number;
  };
  purchaseStats: {
    all: number;
    confirmed: number;
    draft: number;
  };
  budgetStats: {
    budget: number;
    onTrack: number;
    over: number;
    committed: number;
    achieved: number;
  };
  financialStats: {
    monthlyRevenue: number;
    netProfit: number | null;
    paidInvoicesCount: number;
    totalInvoicesCount: number;
    paidInvoicesPercent: number;
    paymentsMadeCount: number;
    totalBillsCount: number;
    paymentsMadePercent: number;
  };
  recentTransactions: Array<{
    id: string;
    number: string;
    date: string;
    amount: number;
    status: string;
    type: 'invoice' | 'bill';
  }>;
  salesDynamics: Array<{
    month: string;
    val1: number;
  }>;
  revenueTrend: Array<{
    label: string;
    dateRange: string;
    revenue: number;
  }>;
}

const defaultStats: DashboardStats = {
  customerStats: { total: 0, new: 0, returning: 0, inactive: 0 },
  vendorStats: { total: 0 },
  salesStats: { all: 0, confirmed: 0, draft: 0 },
  purchaseStats: { all: 0, confirmed: 0, draft: 0 },
  budgetStats: { budget: 0, onTrack: 0, over: 0, committed: 0, achieved: 0 },
  financialStats: {
    monthlyRevenue: 0,
    netProfit: 0,
    paidInvoicesCount: 0,
    totalInvoicesCount: 0,
    paidInvoicesPercent: 0,
    paymentsMadeCount: 0,
    totalBillsCount: 0,
    paymentsMadePercent: 0,
  },
  recentTransactions: [],
  salesDynamics: [],
  revenueTrend: []
};

export function AppDashboard() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; title: string; items: {label: string; value: string; color?: string}[]; x: number; y: number }>({ 
    visible: false, title: '', items: [], x: 0, y: 0 
  });

  const handleMouseMove = (e: React.MouseEvent, title: string, items: {label: string; value: string; color?: string}[]) => {
    // Determine if tooltip should render to the left or right of cursor based on screen position
    const isRightHalf = e.clientX > window.innerWidth / 2;
    const xOffset = isRightHalf ? -10 : 10;
    
    setTooltip({ 
      visible: true, 
      title, 
      items, 
      x: e.clientX + xOffset, 
      y: e.clientY - 20 
    });
  };
  
  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const loadLiveData = async () => {
    try {
      setError(null);
      const data = await fetchWithCache<DashboardStats>('/api/dashboard/summary', undefined, 0); // Disable cache to get fresh data on mount
      if (data && data.customerStats) {
        setStats(data);
      } else {
        throw new Error('Invalid dashboard data structure');
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(() => {
      loadLiveData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Format INR currency
  const formatINR = (val: number) => {
    return '₹' + Math.round(val || 0).toLocaleString('en-IN');
  };

  const formatIndianAbbreviated = (val: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return '₹' + (val / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + 'Cr';
    if (val >= 100000) return '₹' + (val / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + 'L';
    if (val >= 1000) return '₹' + (val / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 }) + 'K';
    return formatINR(val);
  };

  // Customer Donut Segment Calculations
  const custTotal = stats.customerStats.total || (stats.customerStats.new + stats.customerStats.returning + stats.customerStats.inactive) || 1;
  const newPct = Math.round((stats.customerStats.new / custTotal) * 100);
  const returningPct = Math.round((stats.customerStats.returning / custTotal) * 100);
  const inactivePct = Math.max(0, 100 - newPct - returningPct);

  // Budgets Ring Calculation
  const totalBudgets = stats.budgetStats.budget || (stats.budgetStats.onTrack + stats.budgetStats.over) || 1;
  const onTrackPct = totalBudgets > 0 ? Math.round((stats.budgetStats.onTrack / totalBudgets) * 100) : 100;
  const overPct = Math.max(0, 100 - onTrackPct);

  if (error) {
    return (
      <div className="flex-1 p-6 md:p-8 flex flex-col items-center justify-center min-h-[500px]">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Unable to load dashboard data.</h2>
        <p className="text-sm text-slate-500 mb-6">{error}</p>
        <button onClick={loadLiveData} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 relative">
      {tooltip.visible && (
        <div 
          style={{ 
            top: tooltip.y, 
            left: tooltip.x,
            transform: tooltip.x > window.innerWidth / 2 ? 'translate(-100%, 0)' : 'translate(0, 0)'
          }} 
          className="fixed z-50 bg-white border border-slate-200/80 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] rounded-xl p-3.5 pointer-events-none min-w-[150px]"
        >
          <div className="text-[13px] font-bold text-slate-900 mb-2.5 pb-2 border-b border-slate-100">{tooltip.title}</div>
          <div className="space-y-1.5">
            {tooltip.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-6 text-[12px]">
                <span className="text-slate-500 font-medium flex items-center gap-2">
                  {item.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>}
                  {item.label}
                </span>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------- ROW 1: TOP 4 METRIC CARDS ----------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Total Sales Orders */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Orders</p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.salesStats.all}</h2>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-4">
            <span>↗</span>
            <span>+12.5% from last month</span>
          </div>
        </div>

        {/* 2. Confirmed Orders */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed Orders</p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-2">{stats.salesStats.confirmed}</h2>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-4">
            <span>↗</span>
            <span>+4.2% from last month</span>
          </div>
        </div>

        {/* 3. Customers (Dynamic Real Donut Chart) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-between hover:shadow-sm transition-shadow">
          {/* Donut graphic (Circumference = 100 with r=15.9155) */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
              {/* Background circle */}
              <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#F1F5F9" strokeWidth="4" />
              
              {/* Segment 1: Yellow (New Customers) */}
              {newPct > 0 && (
                <circle 
                  cx="18" cy="18" r="15.9155" fill="transparent" 
                  stroke="#EAB308" strokeWidth="4" 
                  strokeDasharray={`${newPct} ${100 - newPct}`} 
                  strokeDashoffset="0" 
                />
              )}

              {/* Segment 2: Blue (Returning Customers) */}
              {returningPct > 0 && (
                <circle 
                  cx="18" cy="18" r="15.9155" fill="transparent" 
                  stroke="#3B82F6" strokeWidth="4" 
                  strokeDasharray={`${returningPct} ${100 - returningPct}`} 
                  strokeDashoffset={`${-newPct}`} 
                />
              )}

              {/* Segment 3: Slate (Inactive Customers) */}
              {inactivePct > 0 && (
                <circle 
                  cx="18" cy="18" r="15.9155" fill="transparent" 
                  stroke="#94A3B8" strokeWidth="4" 
                  strokeDasharray={`${inactivePct} ${100 - inactivePct}`} 
                  strokeDashoffset={`${-(newPct + returningPct)}`} 
                />
              )}
            </svg>
          </div>

          {/* Dynamic Real Legend */}
          <div className="space-y-1.5 pl-3 min-w-[110px]">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Customers</h4>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></span>
              <span className="text-slate-500">New</span>
              <span className="font-bold text-slate-800 ml-auto">{stats.customerStats.new}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
              <span className="text-slate-500">Returning</span>
              <span className="font-bold text-slate-800 ml-auto">{stats.customerStats.returning}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></span>
              <span className="text-slate-500">Inactive</span>
              <span className="font-bold text-slate-800 ml-auto">{stats.customerStats.inactive}</span>
            </div>
          </div>
        </div>

        {/* 4. Budgets (Dynamic Real Donut Ring Chart) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-between hover:shadow-sm transition-shadow">
          {/* Donut graphic */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 transform -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#F1F5F9" strokeWidth="4" />
              {onTrackPct > 0 && (
                <circle 
                  cx="18" cy="18" r="15.9155" fill="transparent" 
                  stroke="#F59E0B" strokeWidth="4" 
                  strokeDasharray={`${onTrackPct} ${100 - onTrackPct}`} 
                  strokeDashoffset="0" 
                />
              )}
              {overPct > 0 && (
                <circle 
                  cx="18" cy="18" r="15.9155" fill="transparent" 
                  stroke="#3B82F6" strokeWidth="4" 
                  strokeDasharray={`${overPct} ${100 - overPct}`} 
                  strokeDashoffset={`${-onTrackPct}`} 
                />
              )}
            </svg>
          </div>
          {/* Legend */}
          <div className="space-y-1.5 pl-3 min-w-[105px]">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1">Budgets</h4>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
              <span className="text-slate-500">On Track</span>
              <span className="font-bold text-slate-800 ml-auto">{stats.budgetStats.onTrack}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
              <span className="text-slate-500">Over</span>
              <span className="font-bold text-slate-800 ml-auto">{stats.budgetStats.over}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- ROW 2: FINANCIAL KPI CARDS ----------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Monthly Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Revenue</p>
              <h2 className="text-2xl font-black text-slate-900 mt-2">{formatINR(stats.financialStats.monthlyRevenue)}</h2>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-4">
            <span>↗</span>
            <span>+8.1% vs last month</span>
          </div>
        </div>

        {/* 2. Net Profit */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-sm transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Profit</p>
              <h2 className="text-2xl font-black text-slate-900 mt-2">{formatINR(stats.financialStats.netProfit)}</h2>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-4">
            <span>↗</span>
            <span>+12% vs last month</span>
          </div>
        </div>

        {/* 3. Paid Invoices (Dynamic Radial Progress) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-between hover:shadow-sm transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid Invoices</p>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.financialStats.paidInvoicesCount}</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Total received this month</p>
          </div>
          {/* Radial ring */}
          <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-14 h-14 transform -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#EFF6FF" strokeWidth="3.5" />
              <circle 
                cx="18" cy="18" r="15.9155" fill="transparent" 
                stroke="#2563EB" strokeWidth="3.5" 
                strokeDasharray={`${stats.financialStats.paidInvoicesPercent} ${Math.max(0, 100 - stats.financialStats.paidInvoicesPercent)}`} 
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-xs font-bold text-blue-600">{stats.financialStats.paidInvoicesPercent}%</span>
          </div>
        </div>

        {/* 4. Payments Made (Dynamic Radial Progress) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex items-center justify-between hover:shadow-sm transition-shadow">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payments Made</p>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.financialStats.paymentsMadeCount}</h2>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Vendor bills cleared</p>
          </div>
          {/* Radial ring */}
          <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-14 h-14 transform -rotate-90">
              <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="#ECFDF5" strokeWidth="3.5" />
              <circle 
                cx="18" cy="18" r="15.9155" fill="transparent" 
                stroke="#10B981" strokeWidth="3.5" 
                strokeDasharray={`${stats.financialStats.paymentsMadePercent} ${Math.max(0, 100 - stats.financialStats.paymentsMadePercent)}`} 
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-xs font-bold text-emerald-600">{stats.financialStats.paymentsMadePercent}%</span>
          </div>
        </div>
      </div>

      {/* ----------------- ROW 3: SALES DYNAMICS & RECENT TRANSACTIONS ----------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sales Dynamics Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Sales Dynamics</h3>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#1E3A8A]"></span>
                <span>Actual Revenue</span>
              </div>
            </div>
          </div>

          {/* Single Bar SVG Chart */}
          <div className="h-64 w-full relative flex flex-col justify-between">
            {/* Grid lines */}
            <div className="absolute inset-x-0 inset-y-4 flex flex-col justify-between pointer-events-none text-[11px] text-slate-400">
              {[1, 0.75, 0.5, 0.25, 0].map(multiplier => {
                const realMax = Math.max(0, ...stats.salesDynamics.map(d => d.val1));
                const maxVal = realMax === 0 ? 100 : realMax;
                return (
                  <div key={multiplier} className={`border-b ${multiplier === 0 ? 'border-slate-200' : 'border-dashed border-slate-200/80'} w-full flex items-center justify-between`}>
                    <span>{formatIndianAbbreviated(maxVal * multiplier)}</span>
                  </div>
                );
              })}
            </div>

            {/* Bars container */}
            <div className="relative h-full flex items-end justify-between pl-16 pr-2 pt-4 pb-6 z-10">
              {stats.salesDynamics.every(d => d.val1 === 0) && (
                <div className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-slate-400 z-20">
                  No sales data available for this period.
                </div>
              )}
              {stats.salesDynamics.map((item, idx) => {
                const realMax = Math.max(0, ...stats.salesDynamics.map(d => d.val1));
                const maxVal = realMax === 0 ? 100 : realMax;
                const h1 = (item.val1 / maxVal) * 100;

                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 group">
                    <div className="flex items-end gap-1 h-44 w-full justify-center">
                      <div 
                        style={{ height: `${h1}%`, minHeight: item.val1 > 0 ? '4px' : '0' }} 
                        className="w-5 sm:w-7 bg-[#1E3A8A] rounded-t-md transition-all duration-300 hover:brightness-125 cursor-pointer opacity-90 hover:opacity-100"
                        onMouseEnter={(e) => handleMouseMove(e, item.month, [{label: 'Actual', value: formatINR(item.val1), color: '#1E3A8A'}])}
                        onMouseLeave={handleMouseLeave}
                      />
                    </div>
                    {/* Month label */}
                    <span className="text-[11px] font-medium text-slate-500 mt-1 group-hover:text-slate-800 transition-colors">{item.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Recent Transactions */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
            <Link to="/sales/invoices" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              View All
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1 flex flex-col justify-between">
            {(stats.recentTransactions || []).map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    tx.type === 'invoice' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {tx.type === 'invoice' ? <ArrowUpRight size={17} /> : <ShoppingBag size={17} />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{tx.number}</div>
                    <div className="text-[11px] text-slate-400">{tx.date}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-extrabold text-slate-900">{formatINR(tx.amount)}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                    tx.status === 'PAID' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : tx.status === 'CONFIRMED'
                      ? 'bg-blue-100 text-blue-700'
                      : tx.status === 'PARTIALLY PAID'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ----------------- ROW 4: REVENUE TREND CURVE ----------------- */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Revenue Trend</h3>
          <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md">Last 6 Weeks</span>
        </div>

        {/* Smooth Area Wave Chart with SVG */}
        <div className="relative w-full h-56 pt-2">
          {/* Y-Axis guide lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[11px] text-slate-400 pr-4">
            {[1, 0.75, 0.5, 0.25, 0].map(multiplier => {
              const realMax = Math.max(0, ...stats.revenueTrend.map(d => d.revenue));
              const maxRevVal = realMax === 0 ? 100 : realMax;
              return (
                <div key={multiplier} className={`border-b ${multiplier === 0 ? 'border-slate-200' : 'border-dashed border-slate-200/80'} flex items-center`}>
                  {formatIndianAbbreviated(maxRevVal * multiplier)}
                </div>
              );
            })}
          </div>

          <svg viewBox="0 0 600 180" preserveAspectRatio="none" className="w-full h-44 overflow-visible pl-16">
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Generate SVG Path dynamically */}
            {(() => {
              const realMax = Math.max(0, ...stats.revenueTrend.map(d => d.revenue));
              const maxRevVal = realMax === 0 ? 100 : realMax;
              const points = stats.revenueTrend.map((d, i) => {
                const x = i * 120; // 600 / 5 = 120
                const y = 140 - ((d.revenue / maxRevVal) * 120); // range 20 to 140
                return { x, y, data: d };
              });
              
              if (points.length === 0) return null;
              
              // Build smooth curve path
              let dPath = `M ${points[0].x} ${points[0].y}`;
              for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const cpX = (prev.x + curr.x) / 2;
                dPath += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
              }
              
              const areaPath = `${dPath} L 600 160 L 0 160 Z`;

              return (
                <>
                  <path d={areaPath} fill="url(#revenueGradient)" />
                  <path d={dPath} fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
                  
                  {/* Invisible hover targets & dots */}
                  {points.map((p, i) => (
                    <g key={i} className="group cursor-pointer">
                      {/* Vertical guide line on hover */}
                      <line x1={p.x} y1="0" x2={p.x} y2="160" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 4" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <circle cx={p.x} cy={p.y} r="6" fill="#fff" stroke="#2563EB" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-sm" />
                      <circle 
                        cx={p.x} cy={p.y} r="20" fill="transparent" 
                        onMouseEnter={(e) => handleMouseMove(e, p.data.label, [
                          {label: 'Date', value: p.data.dateRange},
                          {label: 'Revenue', value: formatINR(p.data.revenue), color: '#3B82F6'}
                        ])}
                        onMouseLeave={handleMouseLeave}
                      />
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>

          {/* X Axis Labels */}
          <div className="flex justify-between text-xs font-medium text-slate-500 pl-16 pr-0 mt-2">
            {stats.revenueTrend.map((d, i) => (
              <span key={i} className="text-center w-12 -ml-6" style={{ marginLeft: i === 0 ? '0' : i === 5 ? '-48px' : '-24px' }}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
