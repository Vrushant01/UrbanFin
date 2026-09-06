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
    <div className="h-screen w-full bg-[#F8FAFC] flex flex-col md:flex-row antialiased text-slate-800 relative overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Global Top Fetch / DB Sync Loading Bar */}
      <div className="print:hidden">
        <GlobalLoadingBar />
      </div>

      {/* Mobile Topbar */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center z-30 shrink-0 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 to-blue-900 text-white font-extrabold text-sm flex items-center justify-center shadow-sm">
            UF
          </div>
          <span className="font-bold text-slate-900 text-lg">UrbanFin ERP</span>
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
        "bg-white border-r border-slate-200/90 w-64 flex-shrink-0 flex-col transition-transform duration-300 ease-in-out z-20 shadow-sm print:hidden",
        "fixed md:relative inset-y-0 left-0 transform h-full",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Brand Logo Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100 hidden md:flex mb-2 mt-2 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-700 to-blue-900 text-white font-black text-sm flex items-center justify-center shadow-sm">
            UF
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 text-base leading-tight">UrbanFin ERP</span>
          </div>
        </div>
        
        {/* Menu Section */}
        <div className="flex-1 py-4 px-4 overflow-y-auto h-[calc(100%-5rem)]">
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
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[14px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50",
                    isActive 
                      ? "bg-blue-50 text-blue-700 font-bold" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <span className={isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-500"}>
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
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 z-10 sticky top-0 print:hidden">
          {/* Page Title & Badges */}
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              {getPageTitle()}
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium text-slate-500">
              <Calendar size={12} className="text-slate-400" />
              <span>FY 2026</span>
            </div>
            {/* Live Database Sync Indicator */}
            <DatabaseStatusIndicator />
          </div>
          
          {/* Header Right (User Avatar, Logout) */}
          <div className="flex items-center space-x-5">
            {/* User Info */}
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-[13px] font-bold text-slate-900 leading-none flex items-center justify-end gap-1 mb-1">
                  {currentUser?.name || 'Admin User'}
                  {role === Role.MasterAdmin && <span className="text-blue-600 font-black text-xs">◆</span>}
                </div>
                <div className="text-[11px] font-medium text-slate-500 leading-none">
                  {role === Role.MasterAdmin ? (
                    <span className="text-blue-600 font-bold">Master Admin</span>
                  ) : role === Role.SubAdmin ? (
                    <span className="text-slate-700 font-bold">Sub-Admin</span>
                  ) : (
                    role || 'Administrator'
                  )}
                </div>
              </div>
              <div className={`w-8 h-8 rounded-md font-bold text-xs flex items-center justify-center text-white ${
                role === Role.MasterAdmin ? 'bg-blue-700' : role === Role.SubAdmin ? 'bg-slate-700' : 'bg-slate-500'
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
        <main className="flex-1 p-6 md:p-8 bg-[#F8FAFC] overflow-y-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
          <div className="max-w-7xl mx-auto print:max-w-none print:w-full print:mx-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
