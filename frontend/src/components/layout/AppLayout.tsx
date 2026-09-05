import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  FileText,
  UserPlus
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Role } from '../../types';

export function AppLayout() {
  const { currentUser, role, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  ];

  if (role === Role.Administrator) {
    navItems.push({ to: '/users/new', icon: <UserPlus size={20} />, label: 'Create User' });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <div className="md:hidden bg-indigo-600 text-white p-4 flex justify-between items-center shadow-md z-20">
        <div className="font-bold text-xl">Urban Furniture</div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-slate-300 w-64 flex-shrink-0 flex-col transition-transform duration-300 ease-in-out z-10",
        "fixed md:relative inset-y-0 left-0 transform",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center px-6 font-bold text-white text-xl border-b border-slate-800 hidden md:flex">
          Urban Furniture
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-md transition-colors",
                isActive 
                  ? "bg-indigo-600 text-white font-medium shadow-sm" 
                  : "hover:bg-slate-800 hover:text-white"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-0">
          <div className="text-xl font-semibold text-slate-800">Accounting System</div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-900">{currentUser?.name}</div>
              <div className="text-xs text-slate-500">{role}</div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
