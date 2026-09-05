import React, { useState } from 'react';
import { type VendorBill, type Contact, type Payment, PaymentType, PaymentVia } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { X, Receipt } from 'lucide-react';

interface BillPaymentModalProps {
  bill: VendorBill;
  vendor: Contact | undefined;
  amountDue: number;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
}

export function BillPaymentModal({ bill, vendor, amountDue, onClose, onSuccess }: BillPaymentModalProps) {
  const [amount, setAmount] = useState<number>(amountDue);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [via, setVia] = useState<PaymentVia>(PaymentVia.Bank);
  const [note, setNote] = useState<string>('');

  const handleConfirm = () => {
    if (amount <= 0) return;

    const newPayment: Omit<Payment, 'id'> = {
      type: PaymentType.Send,
      partnerId: bill.vendorId,
      amount: amount,
      date: date,
      via: via,
      note: note,
      billId: bill.id
    };

    const saved = mockDb.addPayment(newPayment);
    onSuccess(saved);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-indigo-700">
            <Receipt size={20} />
            <h3 className="font-bold text-lg">Register Payment</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-0.5">Amount Due</p>
              <p className="text-xl font-bold text-indigo-700">Rs. {amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500 mb-0.5">Vendor</p>
              <p className="font-semibold text-slate-800">{vendor?.name || 'Unknown'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount</label>
            <input 
              type="number"
              className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg font-semibold"
              value={amount || ''}
              max={amountDue}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
              <input 
                type="date"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Via</label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={via}
                onChange={e => setVia(e.target.value as PaymentVia)}
              >
                <option value={PaymentVia.Bank}>Bank</option>
                <option value={PaymentVia.Cash}>Cash</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Memo / Note</label>
            <textarea
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm min-h-[80px] resize-none"
              placeholder="e.g. Check #1002"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={amount <= 0 || amount > amountDue}>
            Confirm Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
