import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  ShoppingCart, 
  FileText, 
  Receipt, 
  ShoppingBag, 
  CreditCard, 
  Users, 
  Package, 
  BookOpen, 
  Layers, 
  PieChart, 
  Target,
  TrendingUp,
  Scale,
  Store
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface TabItem {
  label: string;
  to: string;
  icon?: React.ReactNode;
}

export function ModuleTabs() {
  const location = useLocation();
  const path = location.pathname;

  let tabs: TabItem[] = [];

  if (path.startsWith('/sales')) {
    tabs = [
      { label: 'Sales Orders', to: '/sales/orders', icon: <ShoppingCart size={17} /> },
      { label: 'Customer Invoices', to: '/sales/invoices', icon: <FileText size={17} /> },
      { label: 'Invoice Payments', to: '/sales/receipt', icon: <Receipt size={17} /> },
    ];
  } else if (path.startsWith('/purchase')) {
    tabs = [
      { label: 'Vendor Sourcing Hub', to: '/purchase/sourcing', icon: <Store size={17} /> },
      { label: 'Purchase Orders', to: '/purchase/orders', icon: <ShoppingBag size={17} /> },
      { label: 'Vendor Bills', to: '/purchase/bills', icon: <FileText size={17} /> },
      { label: 'Vendor Payments', to: '/purchase/payment', icon: <CreditCard size={17} /> },
    ];
  } else if (path.startsWith('/account')) {
    tabs = [
      { label: 'Contacts', to: '/account/contact', icon: <Users size={17} /> },
      { label: 'Products', to: '/account/product', icon: <Package size={17} /> },
      { label: 'Chart of Accounts', to: '/account/chart-of-accounts', icon: <BookOpen size={17} /> },
      { label: 'Journals', to: '/account/journals', icon: <Layers size={17} /> },
      { label: 'Journal Entries', to: '/account/journal-entries', icon: <FileText size={17} /> },
      { label: 'Analytic Accounts', to: '/account/analyticals', icon: <PieChart size={17} /> },
      { label: 'Analytical Budget', to: '/account/analytical-budget', icon: <Target size={17} /> },
    ];
  } else if (path.startsWith('/report')) {
    tabs = [
      { label: 'Profit & Loss', to: '/report/profit-and-loss', icon: <TrendingUp size={17} /> },
      { label: 'Balance Sheet', to: '/report/balance-sheet', icon: <Scale size={17} /> },
    ];
  }

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-6 px-1 overflow-x-auto overflow-y-hidden no-scrollbar">
      {tabs.map((tab) => {
        const isActive = path === tab.to || path.startsWith(tab.to + '/');
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={cn(
              "flex items-center gap-2 py-2.5 px-4 text-[14px] font-medium transition-colors relative whitespace-nowrap",
              isActive
                ? "text-blue-700 font-bold"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-md"
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-blue-700 rounded-t-full" />
            )}
          </NavLink>
        );
      })}
    </div>
  );
}
