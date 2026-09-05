import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type Payment, PaymentType, PaymentVia, 
  type Contact, type VendorBill, VendorBillStatus, ContactType 
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Banknote, CheckCircle, CreditCard, DollarSign, Printer, ArrowLeft, Plus, FileText } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

const DEFAULT_PAYMENT: Partial<Payment> = {
  type: PaymentType.Send,
  partnerId: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  via: PaymentVia.Bank,
  note: '',
  billId: ''
};

export function PaymentMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [bills, setBills] = useState<VendorBill[]>([]);
  
  const [editingPayment, setEditingPayment] = useState<Partial<Payment> | null>(null);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const payData = await fetchWithCache<Payment[]>(`/api/payments?type=Send&search=${encodeURIComponent(query)}`);
      setPayments(payData);
    } catch {
      const all = mockDb.getPayments().filter(p => p.type === PaymentType.Send);
      setPayments(all);
    }

    try {
      const vData = await fetchWithCache<Contact[]>('/api/contacts?type=Vendor');
      setVendors(vData);
    } catch {
      setVendors(mockDb.getContacts().filter(c => c.type === ContactType.Vendor));
    }

    try {
      const bData = await fetchWithCache<VendorBill[]>('/api/vendor-bills');
      setBills(bData);
    } catch {
      setBills(mockDb.getVendorBills());
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredPayments = payments;

  const handleNew = () => {
    setEditingPayment({ ...DEFAULT_PAYMENT });
    setViewingPayment(null);
    setViewMode('form');
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment({ ...payment });
    setViewingPayment(payment);
    setViewMode('form');
  };

  const handleSave = () => {
    if (!editingPayment || !editingPayment.partnerId || !editingPayment.amount || editingPayment.amount <= 0) return;

    if (editingPayment.id) {
      const list = mockDb.getPayments();
      const idx = list.findIndex(p => p.id === editingPayment.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...editingPayment } as Payment;
        mockDb.savePayments(list);
      }
    } else {
      mockDb.addPayment({
        type: PaymentType.Send,
        partnerId: editingPayment.partnerId,
        amount: Number(editingPayment.amount),
        date: editingPayment.date || new Date().toISOString().split('T')[0],
        via: editingPayment.via || PaymentVia.Bank,
        note: editingPayment.note || 'Vendor Payment',
        billId: editingPayment.billId || undefined
      });
    }

    loadData();
    setViewMode('list');
    setEditingPayment(null);
    setViewingPayment(null);
  };

  const columns: Column<Payment>[] = [
    {
      key: 'id',
      header: 'PAYMENT NO.',
      render: (p) => (
        <span className="font-semibold text-blue-600 flex items-center gap-1.5">
          <Banknote size={15} />
          PAY/{new Date(p.date).getFullYear()}/{p.id.slice(0, 5).toUpperCase()}
        </span>
      )
    },
    {
      key: 'date',
      header: 'DATE',
      render: (p) => <span className="text-slate-600">{p.date}</span>
    },
    {
      key: 'partnerId',
      header: 'VENDOR',
      render: (p) => {
        const ven = vendors.find(v => v.id === p.partnerId);
        return <span className="font-medium text-slate-800">{(p as any).partnerName || ven?.name || 'Vendor'}</span>;
      }
    },
    {
      key: 'billId',
      header: 'BILL REF',
      render: (p) => {
        const bill = bills.find(b => b.id === p.billId);
        return bill ? (
          <span className="text-slate-700 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {bill.number}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">Direct Payment</span>
        );
      }
    },
    {
      key: 'via',
      header: 'METHOD',
      render: (p) => (
        p.via === PaymentVia.Cash ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <DollarSign size={12} /> Cash
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard size={12} /> Bank Transfer
          </span>
        )
      )
    },
    {
      key: 'amount',
      header: 'AMOUNT',
      render: (p) => (
        <span className="font-bold text-slate-900">
          Rs. {p.amount.toLocaleString()}
        </span>
      )
    },
    {
      key: 'status',
      header: 'STATUS',
      render: () => (
        <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
          PAID
        </span>
      )
    }
  ];

  const vendorBills = useMemo(() => {
    if (!editingPayment?.partnerId) return [];
    return bills.filter(
      b => b.vendorId === editingPayment.partnerId && b.status !== VendorBillStatus.Draft
    );
  }, [bills, editingPayment?.partnerId]);

  return (
    <MasterLayout
      title="Vendor Payments"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView
          data={filteredPayments}
          columns={columns}
          onRowClick={handleEdit}
          keyExtractor={(p) => p.id}
        />
      )}

      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {filteredPayments.map(p => {
            const ven = vendors.find(v => v.id === p.partnerId);
            const bill = bills.find(b => b.id === p.billId);
            
            return (
              <div
                key={p.id}
                onClick={() => handleEdit(p)}
                className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-indigo-600 text-sm flex items-center gap-1">
                      <Banknote size={14} /> PAY/{new Date(p.date).getFullYear()}/{p.id.slice(0, 5).toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      <CheckCircle size={10} /> Paid
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">{(p as any).partnerName || ven?.name || 'Vendor'}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Date: {p.date}</p>
                  {bill && (
                    <p className="text-xs text-slate-700 font-mono mt-2 bg-slate-100 px-2 py-1 rounded inline-block">
                      Bill: {bill.number}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">{p.via}</span>
                  <span className="text-base font-bold text-red-600">
                    Rs. {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'form' && editingPayment && (
        <MasterFormView
          isFormValid={Boolean(editingPayment.partnerId && editingPayment.amount && editingPayment.amount > 0)}
          onSave={handleSave}
          onNew={handleNew}
          renderActions={() => (
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => setViewMode('list')}>
                <ArrowLeft size={16} className="mr-1" /> Back to Payments
              </Button>
              <Button type="button" variant="primary" onClick={handleSave}>
                {editingPayment.id ? 'Update Payment' : 'Confirm Payment'}
              </Button>
              {viewingPayment && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5"
                >
                  <Printer size={16} /> Print Voucher
                </Button>
              )}
            </div>
          )}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Banknote className="text-indigo-600" />
                    PAYMENT VOUCHER
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Urban Furniture Accounting System</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Payment Number</span>
                  <span className="text-lg font-mono font-bold text-indigo-700">
                    {editingPayment.id
                      ? `PAY/${new Date(editingPayment.date || Date.now()).getFullYear()}/${editingPayment.id.slice(0, 5).toUpperCase()}`
                      : 'NEW-PAYMENT'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SearchableSelect
                    label="Vendor"
                    required
                    placeholder="Search vendor by name or email..."
                    value={editingPayment.partnerId || ''}
                    asyncSearchUrl="/api/contacts?type=Vendor"
                    options={vendors.map(v => ({
                      id: v.id,
                      name: v.name,
                      subtitle: v.email || v.phone,
                    }))}
                    onChange={(val) => {
                      setEditingPayment({
                        ...editingPayment,
                        partnerId: val,
                        billId: ''
                      });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Bill Reference (Optional)
                  </label>
                  <select
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingPayment.billId || ''}
                    onChange={(e) => {
                      const selectedBill = vendorBills.find(b => b.id === e.target.value);
                      const due = selectedBill 
                        ? selectedBill.lines.reduce((s: number, l: any) => s + l.qty * l.unitPrice, 0) - selectedBill.amountPaid 
                        : (editingPayment.amount || 0);
                      setEditingPayment({
                        ...editingPayment,
                        billId: e.target.value,
                        amount: (due && due > 0) ? due : (editingPayment.amount || 0)
                      });
                    }}
                  >
                    <option value="">Direct Payment (No Bill)</option>
                    {vendorBills.map(bill => {
                      const total = bill.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
                      const due = total - bill.amountPaid;
                      return (
                        <option key={bill.id} value={bill.id}>
                          {bill.number} — Due: Rs. {due.toLocaleString()} (Total: Rs. {total.toLocaleString()})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <Input
                    label="Payment Date"
                    type="date"
                    required
                    value={editingPayment.date || ''}
                    onChange={(e) => setEditingPayment({ ...editingPayment, date: e.target.value })}
                  />
                </div>

                <div>
                  <Input
                    label="Amount (Rs.)"
                    type="number"
                    required
                    min={1}
                    value={editingPayment.amount || ''}
                    onChange={(e) => setEditingPayment({ ...editingPayment, amount: Number(e.target.value) })}
                    placeholder="Enter payment amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Via / Mode
                  </label>
                  <select
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingPayment.via || PaymentVia.Bank}
                    onChange={(e) => setEditingPayment({ ...editingPayment, via: e.target.value as PaymentVia })}
                  >
                    <option value={PaymentVia.Bank}>Bank Account / Transfer</option>
                    <option value={PaymentVia.Cash}>Cash</option>
                  </select>
                </div>

                <div>
                  <Input
                    label="Transaction Reference / Memo"
                    type="text"
                    value={editingPayment.note || ''}
                    onChange={(e) => setEditingPayment({ ...editingPayment, note: e.target.value })}
                    placeholder="e.g. Cheque #, UTR Ref, Payment Note"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-4 rounded-lg">
                <span className="text-sm font-medium text-slate-600">Total Payment Amount:</span>
                <span className="text-2xl font-extrabold text-red-600">
                  Rs. {Number(editingPayment.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
