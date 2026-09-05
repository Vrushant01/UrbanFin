import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, FileText, CheckCircle, CreditCard, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { mockDb } from '../../mock/db';
import { type CustomerInvoice, CustomerInvoiceStatus, PaymentType, PaymentVia } from '../../types';

export function CustomerPortal() {
  const { currentUser, logout } = useAuth();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  
  // Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<CustomerInvoice | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchPortalInvoices = async () => {
      const token = localStorage.getItem('urbanfin_jwt_token');
      if (token) {
        try {
          const res = await fetch('/api/portal/invoices', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setInvoices(data);
              return;
            }
          }
        } catch (e) {
          // fallback to mockDb
        }
      }
      const contactId = currentUser?.contactId || 'c2';
      const allInvoices = mockDb.getCustomerInvoices();
      const userInvoices = allInvoices.filter(inv => inv.customerId === contactId && inv.status !== CustomerInvoiceStatus.Draft);
      setInvoices(userInvoices);
    };

    fetchPortalInvoices();
  }, [currentUser]);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayNowClick = async (inv: CustomerInvoice) => {
    const amountDue = inv.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0) - inv.amountPaid;
    if (amountDue <= 0) return;

    setIsProcessing(true);
    const isScriptLoaded = await loadRazorpayScript();

    try {
      const token = localStorage.getItem('urbanfin_jwt_token');
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: amountDue,
          currency: 'INR',
          invoiceId: inv.id,
          receipt: inv.number,
        }),
      });

      if (!orderRes.ok) {
        throw new Error('Order creation endpoint returned ' + orderRes.status);
      }

      const orderData = await orderRes.json();

      if (isScriptLoaded && (window as any).Razorpay) {
        const options: any = {
          key: orderData.keyId || 'rzp_test_TDo2AY2cIWWoA0',
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Urban Furniture',
          description: `Payment for Invoice ${inv.number}`,
          prefill: {
            name: currentUser?.name || 'Customer Raj',
            email: currentUser?.email || 'raj@example.com',
            contact: '9876543210',
          },
          theme: {
            color: '#4f46e5',
          },
          handler: async function (response: any) {
            try {
              await fetch('/api/payments/verify', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || orderData.orderId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature || 'mock_test_signature',
                  invoiceId: inv.id,
                  amount: amountDue,
                  partnerId: inv.customerId,
                  type: PaymentType.Receive,
                }),
              });

              mockDb.addPayment({
                type: PaymentType.Receive,
                partnerId: inv.customerId,
                amount: amountDue,
                date: new Date().toISOString().split('T')[0],
                via: PaymentVia.Bank,
                note: `Razorpay Payment ID: ${response.razorpay_payment_id}`,
                invoiceId: inv.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
              });

              await mockDb.syncWithBackend();

              const allInvoices = mockDb.getCustomerInvoices();
              const contactId = currentUser?.contactId || 'c2';
              setInvoices(allInvoices.filter(i => i.customerId === contactId && i.status !== CustomerInvoiceStatus.Draft));

              setPayingInvoice(inv);
              setPaymentSuccess(true);
              setIsProcessing(false);
              setTimeout(() => {
                setPayingInvoice(null);
                setPaymentSuccess(false);
              }, 2500);
            } catch (verErr) {
              console.error('Signature verification error:', verErr);
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            },
          },
        };

        if (orderData.orderId) {
          options.order_id = orderData.orderId;
        }

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          console.warn('Razorpay checkout notice:', resp?.error?.description || 'Checkout modal closed');
          setIsProcessing(false);
          setPayingInvoice(inv);
        });
        rzp.open();
        return;
      }
    } catch (err) {
      console.warn('Razorpay order creation fallback to modal:', err);
    }

    setIsProcessing(false);
    setPayingInvoice(inv);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    const amountDue = payingInvoice.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0) - payingInvoice.amountPaid;
    const token = localStorage.getItem('urbanfin_jwt_token');

    try {
      await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          razorpay_order_id: `manual_portal_${Date.now()}`,
          razorpay_payment_id: `pay_${Date.now()}`,
          razorpay_signature: 'mock_test_signature',
          invoiceId: payingInvoice.id,
          amount: amountDue,
          partnerId: payingInvoice.customerId,
          type: PaymentType.Receive,
        }),
      });
    } catch (e) {
      console.warn('Backend payment record fallback', e);
    }
    
    mockDb.addPayment({
      type: PaymentType.Receive,
      partnerId: payingInvoice.customerId,
      amount: amountDue,
      date: new Date().toISOString().split('T')[0],
      via: PaymentVia.Bank,
      note: 'Online Portal Payment',
      invoiceId: payingInvoice.id
    });

    await mockDb.syncWithBackend();

    setPaymentSuccess(true);
    
    setTimeout(() => {
      const allInvoices = mockDb.getCustomerInvoices();
      const contactId = currentUser?.contactId || 'c2';
      setInvoices(allInvoices.filter(inv => inv.customerId === contactId && inv.status !== CustomerInvoiceStatus.Draft));
      setPayingInvoice(null);
      setPaymentSuccess(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex justify-between items-center">
        <div className="font-bold text-xl flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-indigo-600 rounded-sm"></div>
          </div>
          Urban Furnitures
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{currentUser?.name}</span>
          <button 
            onClick={logout}
            className="p-2 hover:bg-indigo-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <FileText className="text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-800">My Invoices</h1>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-4 pl-6">Invoice</th>
                  <th className="p-4">Invoice Date</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4 text-right">Amount Due</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No invoices found.
                    </td>
                  </tr>
                ) : null}
                
                {invoices.map(inv => {
                  const lineTotal = (inv.lines || []).reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
                  const total = lineTotal > 0 ? lineTotal : (Number((inv as any).total) || 0);
                  const paid = Number(inv.amountPaid) || 0;
                  const due = (inv as any).amountDue !== undefined ? Number((inv as any).amountDue) : Math.max(0, total - paid);
                  const isPaid = inv.status === CustomerInvoiceStatus.Paid || (total > 0 && due <= 0);
                  
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 pl-6 font-semibold text-slate-800">{inv.number}</td>
                      <td className="p-4 text-slate-600">{inv.invoiceDate}</td>
                      <td className="p-4 text-slate-600">{inv.dueDate}</td>
                      <td className="p-4 text-right font-bold text-slate-700">
                        Rs. {due.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="p-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <CheckCircle size={14} /> PAID
                          </span>
                        ) : (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            disabled={isProcessing}
                            onClick={() => handlePayNowClick(inv)}
                            className="bg-indigo-600 hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                          >
                            {isProcessing && payingInvoice?.id === inv.id ? 'Processing...' : 'Pay Now'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Lightweight Portal Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transition-all">
            
            {paymentSuccess ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Payment Successful!</h3>
                <p className="text-slate-500">Thank you for your payment.</p>
              </div>
            ) : (
              <>
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-lg text-slate-800">Secure Payment</h3>
                  <button onClick={() => setPayingInvoice(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handlePay} className="p-6">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 text-center">
                    <p className="text-sm font-medium text-indigo-600/80 mb-1">Total Amount Due</p>
                    <p className="text-3xl font-bold text-indigo-700">
                      Rs. {(
                        payingInvoice.lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0) - payingInvoice.amountPaid
                      ).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </p>
                    <p className="text-xs text-indigo-500 mt-2">Invoice: {payingInvoice.number}</p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <label className="block text-sm font-medium text-slate-700">Select Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-all
                          ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <CreditCard size={18} /> Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-all
                          ${paymentMethod === 'bank' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <CheckCircle size={18} /> Net Banking
                      </button>
                    </div>
                  </div>
                  
                  {paymentMethod === 'card' && (
                    <div className="space-y-3 mb-6">
                      <input type="text" placeholder="Card Number" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="MM/YY" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                        <input type="text" placeholder="CVC" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm" required />
                      </div>
                    </div>
                  )}

                  <Button type="submit" variant="primary" className="w-full py-3 text-base">
                    Pay Now
                  </Button>
                </form>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
