import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type Payment, PaymentType, PaymentVia, 
  type Contact, type CustomerInvoice, CustomerInvoiceStatus, ContactType 
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Receipt, CheckCircle, CreditCard, Banknote, Printer, ArrowLeft, Plus } from 'lucide-react';

const DEFAULT_PAYMENT: Partial<Payment> = {
  type: PaymentType.Receive,
  partnerId: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  via: PaymentVia.Bank,
  note: '',
  invoiceId: ''
};

export function ReceiptMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  
  const [editingPayment, setEditingPayment] = useState<Partial<Payment> | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);

  const loadData = () => {
    const allPayments = mockDb.getPayments();
    // Filter payments of type Receive (Receipts)
    const receipts = allPayments.filter(p => p.type === PaymentType.Receive);
    setPayments(receipts);
    setCustomers(mockDb.getContacts().filter(c => c.type === ContactType.Customer));
    setInvoices(mockDb.getCustomerInvoices());
  };

  useEffect(() => {
    loadData();
    mockDb.syncWithBackend().then(loadData);
  }, [viewMode]);

  const filteredPayments = useMemo(() => {
    if (!searchTerm) return payments;
    const lower = searchTerm.toLowerCase();
    return payments.filter(p => {
      const customerName = customers.find(c => c.id === p.partnerId)?.name.toLowerCase() || '';
      const invoiceNo = invoices.find(i => i.id === p.invoiceId)?.number.toLowerCase() || '';
      const note = (p.note || '').toLowerCase();
      const rzpId = (p.razorpayPaymentId || '').toLowerCase();
      return (
        p.id.toLowerCase().includes(lower) ||
        customerName.includes(lower) ||
        invoiceNo.includes(lower) ||
        note.includes(lower) ||
        rzpId.includes(lower) ||
        p.via.toLowerCase().includes(lower)
      );
    });
  }, [payments, searchTerm, customers, invoices]);

  const handleNew = () => {
    setEditingPayment({ ...DEFAULT_PAYMENT });
    setViewingReceipt(null);
    setViewMode('form');
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment({ ...payment });
    setViewingReceipt(payment);
    setViewMode('form');
  };

  const handleSave = () => {
    if (!editingPayment || !editingPayment.partnerId || !editingPayment.amount || editingPayment.amount <= 0) return;

    if (editingPayment.id) {
      // Update existing payment
      const list = mockDb.getPayments();
      const idx = list.findIndex(p => p.id === editingPayment.id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...editingPayment } as Payment;
        mockDb.savePayments(list);
      }
    } else {
      // Add new receipt
      mockDb.addPayment({
        type: PaymentType.Receive,
        partnerId: editingPayment.partnerId,
        amount: Number(editingPayment.amount),
        date: editingPayment.date || new Date().toISOString().split('T')[0],
        via: editingPayment.via || PaymentVia.Bank,
        note: editingPayment.note || 'Customer Receipt',
        invoiceId: editingPayment.invoiceId || undefined
      });
    }

    loadData();
    setViewMode('list');
    setEditingPayment(null);
    setViewingReceipt(null);
  };

  const columns: Column<Payment>[] = [
    {
      key: 'id',
      header: 'Receipt #',
      render: (p) => (
        <span className="font-semibold text-indigo-600 flex items-center gap-1.5">
          <Receipt size={15} />
          REC/{new Date(p.date).getFullYear()}/{p.id.slice(0, 5).toUpperCase()}
        </span>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: (p) => <span className="text-slate-600">{p.date}</span>
    },
    {
      key: 'partnerId',
      header: 'Customer',
      render: (p) => {
        const cust = customers.find(c => c.id === p.partnerId);
        return <span className="font-medium text-slate-800">{cust?.name || p.partnerId}</span>;
      }
    },
    {
      key: 'invoiceId',
      header: 'Invoice Reference',
      render: (p) => {
        const inv = invoices.find(i => i.id === p.invoiceId);
        return inv ? (
          <span className="text-slate-700 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {inv.number}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">Direct Receipt</span>
        );
      }
    },
    {
      key: 'via',
      header: 'Method',
      render: (p) => {
        const isRazorpay = Boolean(p.razorpayPaymentId || p.note?.includes('Razorpay'));
        if (isRazorpay) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              <CreditCard size={12} /> Razorpay
            </span>
          );
        }
        return p.via === PaymentVia.Cash ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Banknote size={12} /> Cash
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <CreditCard size={12} /> Bank Transfer
          </span>
        );
      }
    },
    {
      key: 'amount',
      header: 'Amount Received',
      render: (p) => (
        <span className="font-bold text-emerald-700">
          Rs. {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
          <CheckCircle size={12} /> Received
        </span>
      )
    }
  ];

  // Helper for invoice selection
  const customerInvoices = useMemo(() => {
    if (!editingPayment?.partnerId) return [];
    return invoices.filter(
      i => i.customerId === editingPayment.partnerId && i.status !== CustomerInvoiceStatus.Draft
    );
  }, [invoices, editingPayment?.partnerId]);

  return (
    <MasterLayout
      title="Sales Receipts"
      totalCount={filteredPayments.length}
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
            const cust = customers.find(c => c.id === p.partnerId);
            const inv = invoices.find(i => i.id === p.invoiceId);
            const isRazorpay = Boolean(p.razorpayPaymentId || p.note?.includes('Razorpay'));
            
            return (
              <div
                key={p.id}
                onClick={() => handleEdit(p)}
                className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-indigo-600 text-sm flex items-center gap-1">
                      <Receipt size={14} /> REC/{new Date(p.date).getFullYear()}/{p.id.slice(0, 5).toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle size={10} /> Received
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">{cust?.name || p.partnerId}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Date: {p.date}</p>
                  {inv && (
                    <p className="text-xs text-indigo-600 font-mono mt-2 bg-indigo-50 px-2 py-1 rounded inline-block">
                      Invoice: {inv.number}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">
                    {isRazorpay ? 'Razorpay' : p.via}
                  </span>
                  <span className="text-base font-bold text-emerald-700">
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
                <ArrowLeft size={16} className="mr-1" /> Back to Receipts
              </Button>
              <Button type="button" variant="primary" onClick={handleSave}>
                {editingPayment.id ? 'Update Receipt' : 'Confirm Receipt'}
              </Button>
              {viewingReceipt && (
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
            {/* Printable Voucher Banner */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Receipt className="text-indigo-600" />
                    PAYMENT RECEIPT
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Urban Furniture Accounting System</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Receipt Number</span>
                  <span className="text-lg font-mono font-bold text-indigo-700">
                    {editingPayment.id
                      ? `REC/${new Date(editingPayment.date || Date.now()).getFullYear()}/${editingPayment.id.slice(0, 5).toUpperCase()}`
                      : 'NEW-RECEIPT'}
                  </span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingPayment.partnerId || ''}
                    onChange={(e) => {
                      setEditingPayment({
                        ...editingPayment,
                        partnerId: e.target.value,
                        invoiceId: '' // reset invoice selection
                      });
                    }}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.email || 'No email'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Invoice Reference (Optional)
                  </label>
                  <select
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingPayment.invoiceId || ''}
                    onChange={(e) => {
                      const selectedInv = customerInvoices.find(i => i.id === e.target.value);
                      const due = selectedInv 
                        ? selectedInv.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) - selectedInv.amountPaid 
                        : editingPayment.amount;
                      setEditingPayment({
                        ...editingPayment,
                        invoiceId: e.target.value,
                        amount: due > 0 ? due : editingPayment.amount
                      });
                    }}
                  >
                    <option value="">Direct Receipt (No Invoice)</option>
                    {customerInvoices.map(inv => {
                      const total = inv.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0);
                      const due = total - inv.amountPaid;
                      return (
                        <option key={inv.id} value={inv.id}>
                          {inv.number} — Due: Rs. {due.toLocaleString()} (Total: Rs. {total.toLocaleString()})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <Input
                    label="Receipt Date"
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
                    placeholder="Enter received amount"
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
                    placeholder="e.g. Cheque #, UTR / UPI Ref, Bank Note"
                  />
                </div>
              </div>

              {/* Razorpay details if available */}
              {editingPayment.razorpayPaymentId && (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                    Verified Razorpay Transaction
                  </span>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-700">
                    <div>Payment ID: <span className="font-bold text-indigo-700">{editingPayment.razorpayPaymentId}</span></div>
                    {editingPayment.razorpayOrderId && (
                      <div>Order ID: <span className="text-slate-600">{editingPayment.razorpayOrderId}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Total Display */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-4 rounded-lg">
                <span className="text-sm font-medium text-slate-600">Total Receipt Amount:</span>
                <span className="text-2xl font-extrabold text-emerald-600">
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
