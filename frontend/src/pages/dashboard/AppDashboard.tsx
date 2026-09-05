import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  ShoppingCart, 
  Wallet, 
  FileText,
  Plus,
  ArrowRight
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { mockDb } from '../../mock/db';
import { PurchaseOrderStatus, SalesOrderStatus } from '../../types';

export function AppDashboard() {
  const [budgetStats, setBudgetStats] = useState({
    achieved: 0,
    budget: 0,
    committed: 0
  });

  const [purchaseStats, setPurchaseStats] = useState({
    all: 0,
    confirmed: 0,
    draft: 0
  });

  const [salesStats, setSalesStats] = useState({
    all: 0,
    confirmed: 0,
    draft: 0
  });

  const [accountStats, setAccountStats] = useState({
    contacts: 0,
    products: 0,
    accounts: 0
  });

  const refreshStats = () => {
    // Budget Stats
    const budgets = mockDb.getBudgets();
    let committed = 0;
    let achieved = 0;
    
    budgets.forEach(b => {
      b.lines?.forEach(l => {
        committed += (l.committedAmount || 0);
        achieved += (l.achievedAmount || 0);
      });
    });

    setBudgetStats({
      achieved: Math.round(achieved),
      budget: budgets.length,
      committed: Math.round(committed)
    });

    // Purchase Stats
    const pos = mockDb.getPurchaseOrders();
    const confirmedCount = pos.filter(p => p.status === PurchaseOrderStatus.Confirmed).length;
    const draftCount = pos.filter(p => p.status === PurchaseOrderStatus.Draft).length;

    setPurchaseStats({
      all: pos.length,
      confirmed: confirmedCount,
      draft: draftCount
    });

    // Sales Stats
    const sos = mockDb.getSalesOrders();
    const confirmedSoCount = sos.filter(s => s.status === SalesOrderStatus.Confirmed).length;
    const draftSoCount = sos.filter(s => s.status === SalesOrderStatus.Draft).length;

    setSalesStats({
      all: sos.length,
      confirmed: confirmedSoCount,
      draft: draftSoCount
    });

    // Account Stats
    const contacts = mockDb.getContacts();
    const products = mockDb.getProducts();
    const accounts = mockDb.getAccounts();

    setAccountStats({
      contacts: contacts.length,
      products: products.length,
      accounts: accounts.length
    });
  };

  useEffect(() => {
    refreshStats();
    mockDb.syncWithBackend().then(() => {
      refreshStats();
    });
  }, []);

  const cards = [
    {
      title: 'Sales',
      icon: <ShoppingCart size={24} />,
      links: [
        { label: 'Sales Order', path: '/sales/orders' },
        { label: 'Customer Invoice', path: '/sales/invoices' },
        { label: 'Receipt', path: '/sales/receipt' }
      ],
      stats: [
        { label: 'All', value: salesStats.all },
        { label: 'Confirmed', value: salesStats.confirmed },
        { label: 'Draft', value: salesStats.draft }
      ],
      colorClass: 'bg-indigo-500',
      path: '/sales/orders',
      newPath: '/sales/orders'
    },
    {
      title: 'Purchase',
      icon: <ShoppingBag size={24} />,
      links: [
        { label: 'Purchase Order', path: '/purchase/orders' },
        { label: 'Vendor Bill', path: '/purchase/bills' },
        { label: 'Payment', path: '/purchase/payment' }
      ],
      stats: [
        { label: 'All', value: purchaseStats.all },
        { label: 'Confirmed', value: purchaseStats.confirmed },
        { label: 'Draft', value: purchaseStats.draft }
      ],
      colorClass: 'bg-emerald-500',
      path: '/purchase/orders',
      newPath: '/purchase/orders'
    },
    {
      title: 'Account',
      icon: <Wallet size={24} />,
      links: [
        { label: 'Contact', path: '/account/contact' }, 
        { label: 'Product', path: '/account/product' }, 
        { label: 'Analyticals', path: '/account/analyticals' }, 
        { label: 'Analytical Budget', path: '/account/analytical-budget' }, 
        { label: 'Chart of Accounts', path: '/account/chart-of-accounts' }, 
        { label: 'Journals', path: '/account/journals' }, 
        { label: 'Journal Entries', path: '/account/journal-entries' }
      ],
      stats: [
        { label: 'Contacts', value: accountStats.contacts },
        { label: 'Products', value: accountStats.products },
        { label: 'Accounts', value: accountStats.accounts }
      ],
      colorClass: 'bg-blue-500',
      path: '/account/contact',
      newPath: '/account/contact'
    },
    {
      title: 'Report',
      icon: <FileText size={24} />,
      links: [
        { label: 'Budget Report', path: '/report/budget' },
        { label: 'Profit & Loss', path: '/report/profit-and-loss' },
        { label: 'Balance Sheet', path: '/report/balance-sheet' }
      ],
      stats: [
        { label: 'Achieved', value: budgetStats.achieved },
        { label: 'Budget', value: budgetStats.budget },
        { label: 'Committed', value: budgetStats.committed }
      ],
      colorClass: 'bg-purple-500',
      path: '/report/profit-and-loss',
      newPath: '/report/budget'
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome to Urban Furniture Accounting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
            <div className={`p-5 flex items-center gap-3 border-b border-slate-100 ${card.colorClass}`}>
              <div className="p-2 bg-white/20 rounded-lg text-white">
                {card.icon}
              </div>
              <h3 className="text-xl font-semibold text-white">{card.title}</h3>
            </div>
            
            <div className="p-5 flex-grow">
              <ul className="space-y-2 mb-6">
                {card.links.map((linkObj, linkIdx) => (
                  <li key={linkIdx} className="flex items-center text-slate-600 before:content-[''] before:w-1.5 before:h-1.5 before:bg-indigo-400 before:rounded-full before:mr-2">
                    <Link to={linkObj.path} className="text-sm font-medium hover:text-indigo-600 cursor-pointer">{linkObj.label}</Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs mt-auto">
                {card.stats.map((stat, statIdx) => (
                  <React.Fragment key={statIdx}>
                    <div className="flex flex-col text-center flex-1 cursor-pointer hover:text-indigo-600 transition-colors">
                      <span className="text-slate-500 font-medium mb-1">{stat.label}</span>
                      <span className="font-bold text-slate-800 text-lg leading-none">{stat.value}</span>
                    </div>
                    {statIdx < card.stats.length - 1 && (
                      <div className="w-px h-8 bg-slate-200"></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <Link to={card.newPath} className="flex-1">
                <Button variant="primary" className="w-full gap-1" size="sm">
                  <Plus size={16} /> New
                </Button>
              </Link>
              <Link to={card.path} className="flex-1">
                <Button variant="outline" className="w-full gap-1" size="sm">
                  View <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
