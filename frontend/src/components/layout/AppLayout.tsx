import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  ShoppingCart, 
  ShoppingBag, 
  Wallet, 
  FileText,
  UserPlus,
  Calendar,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Role } from '../../types';
import { GlobalLoadingBar, DatabaseStatusIndicator } from '../ui/GlobalLoadingBar';

export function AppLayout() {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { 
      to: '/', 
      basePath: '/', 
      icon: <LayoutDashboard size={19} />, 
      label: 'Dashboard',
      exact: true
    },
    { 
      to: '/sales/orders', 
      basePath: '/sales', 
      icon: <ShoppingCart size={19} />, 
      label: 'Sales' 
    },
    { 
      to: '/purchase/orders', 
      basePath: '/purchase', 
      icon: <ShoppingBag size={19} />, 
      label: 'Purchase' 
    },
    { 
      to: '/account/contact', 
      basePath: '/account', 
      icon: <Wallet size={19} />, 
      label: 'Account' 
    },
    { 
      to: '/report/profit-and-loss', 
      basePath: '/report', 
      icon: <FileText size={19} />, 
      label: 'Report' 
    },
  ];

  if (role === Role.MasterAdmin || role === Role.Administrator || role === Role.SubAdmin) {
    navItems.push({ 
      to: '/admin/users', 
      basePath: '/admin/users', 
      icon: <UserPlus size={19} />, 
      label: 'User Management' 
    });
  }

  // Determine current page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '') return 'Dashboard';
    if (path.startsWith('/sales')) return 'Sales Management';
    if (path.startsWith('/purchase')) return 'Purchase Management';
    if (path.startsWith('/account')) return 'Account Master';
    if (path.startsWith('/report')) return 'Financial Reports';
    if (path.startsWith('/admin/users') || path.startsWith('/users')) return 'User Administration';
    return 'UrbanFin ERP';
  };

  const userInitial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row antialiased text-slate-800 relative">
      {/* Global Top Fetch / DB Sync Loading Bar */}
      <GlobalLoadingBar />

      {/* Mobile Topbar */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-xs z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
            UF
          </div>
          <span className="font-bold text-slate-900 text-lg">Urban Furniture</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200/90 w-64 flex-shrink-0 flex-col transition-transform duration-300 ease-in-out z-20 shadow-2xs",
        "fixed md:relative inset-y-0 left-0 transform",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand Logo Header */}
        <div className="h-20 flex items-center px-6 gap-3 border-b border-slate-100 hidden md:flex">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
            UF
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 text-base leading-tight">Urban Furniture</span>
          </div>
        </div>
        
        {/* Menu Section */}
        <div className="flex-1 py-4 px-4 overflow-y-auto">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-3">
            MAIN MENU
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = item.exact 
                ? location.pathname === item.basePath
                : location.pathname.startsWith(item.basePath);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all",
                    isActive 
                      ? "bg-slate-100/90 text-slate-900 font-bold shadow-2xs border border-slate-200/60" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/80"
                  )}
                >
                  <span className={isActive ? "text-blue-600" : "text-slate-400"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="h-20 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 md:px-8 shadow-2xs z-10">
          {/* Page Title & Badges */}
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              {getPageTitle()}
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-600 shadow-2xs">
              <Calendar size={13} className="text-slate-400" />
              <span>Financial Year 2026</span>
            </div>
            {/* Live Database Sync Indicator */}
            <DatabaseStatusIndicator />
          </div>
          
          {/* Header Right (User Avatar, Logout) */}
          <div className="flex items-center space-x-4">

            {/* User Info */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-900 leading-tight flex items-center justify-end gap-1">
                  {currentUser?.name || 'Admin User'}
                  {role === Role.MasterAdmin && <span className="text-amber-500 font-black text-xs">👑</span>}
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  {role === Role.MasterAdmin ? (
                    <span className="text-amber-700 font-bold">Master Admin</span>
                  ) : role === Role.SubAdmin ? (
                    <span className="text-indigo-600 font-bold">Sub-Admin</span>
                  ) : (
                    role || 'Administrator'
                  )}
                </div>
              </div>
              <div className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shadow-xs text-white ${
                role === Role.MasterAdmin ? 'bg-amber-500' : role === Role.SubAdmin ? 'bg-indigo-600' : 'bg-purple-600'
              }`}>
                {userInitial}
              </div>
            </div>

            {/* Logout button */}
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 md:p-8 bg-[#F8FAFC] overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
