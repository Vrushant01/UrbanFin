import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, FileText, CheckCircle, CreditCard, X, Send, Bell, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { mockDb } from '../../mock/db';
import { type CustomerInvoice, CustomerInvoiceStatus, PaymentType, PaymentVia } from '../../types';
import { fetchWithCache, clientCache } from '../../utils/clientCache';
import { calculateGST } from '../../utils/gstUtils';

export function CustomerPortal() {
  const { currentUser, logout } = useAuth();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  
  // Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<CustomerInvoice | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const [isProcessing, setIsProcessing] = useState(false);

  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  const reloadInvoices = async () => {
    try {
      const data = await fetchWithCache<CustomerInvoice[]>('/api/portal/invoices');
      if (Array.isArray(data)) {
        setInvoices(data);
        return;
      }
    } catch (e) {
      // fallback to mockDb
    }

    // Local fallback resolution
    const contacts = mockDb.getContacts();
    const allInvoices = mockDb.getCustomerInvoices();

    // If Admin/Accountant, show all non-draft customer invoices
    if (currentUser?.role === 'Administrator' || currentUser?.role === 'Accountant' || currentUser?.role === 'MasterAdmin') {
      setInvoices(allInvoices.filter((inv) => inv.status !== CustomerInvoiceStatus.Draft));
      return;
    }

    // Resolve contact for current customer
    let contactId = currentUser?.contactId;
    if (!contactId && currentUser) {
      if (currentUser.loginId === 'johnuser' || currentUser.email === 'john@example.com') {
        contactId = 'c2';
      } else {
        const matchedContact = contacts.find(
          (c) =>
            (currentUser.email && c.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.name && c.name.toLowerCase() === currentUser.name.toLowerCase())
        );
        contactId = matchedContact?.id;
      }
    }

    if (!contactId) {
      setInvoices([]);
      return;
    }

    const userInvoices = allInvoices.filter(
      (inv) => inv.customerId === contactId && inv.status !== CustomerInvoiceStatus.Draft
    );

    setInvoices(userInvoices);
  };

  useEffect(() => {
    reloadInvoices();
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

  const calculateDueAmount = (inv: CustomerInvoice): number => {
    const rawLineTotal = (inv.lines || []).reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
      0
    );
    const subtotal = rawLineTotal > 0 ? rawLineTotal : (Number((inv as any).total) || 0);
    const { totalWithGst } = calculateGST(subtotal);
    const paid = Number(inv.amountPaid) || 0;
    return (inv as any).amountDue !== undefined
      ? Number((inv as any).amountDue)
      : Math.max(0, totalWithGst - paid);
  };

  const handlePayNowClick = async (inv: CustomerInvoice) => {
    const amountDue = calculateDueAmount(inv);
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

      if (orderRes.ok) {
        const orderData = await orderRes.json();

        if (orderData?.orderId && isScriptLoaded && (window as any).Razorpay) {
          const options: any = {
            key: orderData.keyId || 'rzp_test_TDo2AY2cIWWoA0',
            amount: orderData.amount,
            currency: orderData.currency || 'INR',
            order_id: orderData.orderId,
            name: 'Urban Furniture',
            description: `Payment for Invoice ${inv.number}`,
            prefill: {
              name: currentUser?.name || 'Customer',
              email: currentUser?.email || 'customer@example.com',
              contact: '9876543210',
            },
            theme: {
              color: '#4f46e5',
            },
            handler: async function (response: any) {
              console.log(
                `[Razorpay Frontend] Payment Succeeded in Widget -> Payment ID: ${response.razorpay_payment_id} | Order ID: ${response.razorpay_order_id}`
              );

              try {
                const verRes = await fetch('/api/payments/verify', {
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

                if (!verRes.ok) {
                  const errorText = await verRes.text();
                  console.error(
                    `[Razorpay Verify Warning] Backend verification responded with status ${verRes.status}: ${errorText}`
                  );
                } else {
                  const verData = await verRes.json();
                  console.log('[Razorpay Backend] Payment Verified Successfully:', verData);
                }

                mockDb.addPayment({
                  type: PaymentType.Receive,
                  partnerId: inv.customerId,
                  amount: amountDue,
                  date: new Date().toISOString().split('T')[0],
                  via: PaymentVia.Bank,
                  note: `Razorpay Payment ID: ${response.razorpay_payment_id}`,
                  invoiceId: inv.id,
                  razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                });

                await mockDb.syncWithBackend();
                await reloadInvoices();

                setPayingInvoice(inv);
                setPaymentSuccess(true);
                setIsProcessing(false);
                setTimeout(() => {
                  setPayingInvoice(null);
                  setPaymentSuccess(false);
                }, 2500);
              } catch (verErr) {
                console.error(
                  `[Razorpay Verify Critical Error] Payment succeeded in Razorpay with ID: ${response.razorpay_payment_id} but verification request failed:`,
                  verErr
                );
                // Store in localStorage so payment record is never lost
                try {
                  const pending = JSON.parse(localStorage.getItem('urbanfin_pending_payments') || '[]');
                  pending.push({
                    paymentId: response.razorpay_payment_id,
                    orderId: response.razorpay_order_id,
                    invoiceId: inv.id,
                    amount: amountDue,
                    timestamp: new Date().toISOString(),
                  });
                  localStorage.setItem('urbanfin_pending_payments', JSON.stringify(pending));
                } catch (_) {}

                mockDb.addPayment({
                  type: PaymentType.Receive,
                  partnerId: inv.customerId,
                  amount: amountDue,
                  date: new Date().toISOString().split('T')[0],
                  via: PaymentVia.Bank,
                  note: `Razorpay Payment ID: ${response.razorpay_payment_id}`,
                  invoiceId: inv.id,
                  razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                  razorpayPaymentId: response.razorpay_payment_id,
                });

                await mockDb.syncWithBackend();
                await reloadInvoices();
                setIsProcessing(false);
                setPayingInvoice(inv);
              }
            },
            modal: {
              ondismiss: function () {
                setIsProcessing(false);
              },
            },
          };

          try {
            console.log(
              `[Razorpay Frontend] Opening Checkout -> Order ID: ${options.order_id} | Amount (Paise): ${options.amount} | Key: ${options.key}`
            );
            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (resp: any) {
              const desc = resp?.error?.description || 'Checkout modal closed or payment failed';
              console.warn('[Razorpay Frontend] Payment failed:', desc);

              // Record failed attempt for audit & debugging
              try {
                const failed = JSON.parse(localStorage.getItem('urbanfin_failed_payments') || '[]');
                failed.push({
                  orderId: options.order_id,
                  amount: options.amount,
                  error: desc,
                  invoiceId: inv.id,
                  timestamp: new Date().toISOString(),
                });
                localStorage.setItem('urbanfin_failed_payments', JSON.stringify(failed));
              } catch (_) {}

              if (
                desc.toLowerCase().includes('amount exceeds maximum') ||
                desc.toLowerCase().includes('exceeds maximum amount')
              ) {
                setPaymentNotice(
                  `Razorpay Test-Account Limit: Single test transactions are capped by Razorpay (amounts > ₹15,000 exceed unactivated test account tier limits). In live mode with activated KYC, full amounts are processed. You can complete this payment using the Integrated Portal Payment below, or test with an amount under ₹15,000.`
                );
              } else {
                setPaymentNotice(`Payment Notice: ${desc}. You can complete payment below.`);
              }

              setIsProcessing(false);
              setPayingInvoice(inv);
            });
            rzp.open();
            return;
          } catch (initErr) {
            console.warn('Razorpay initialization fallback:', initErr);
          }
        }
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

    const amountDue = calculateDueAmount(payingInvoice);
    const token = localStorage.getItem('urbanfin_jwt_token');
    const mockPaymentId = `pay_${Date.now()}`;
    const mockOrderId = `order_${Date.now()}`;

    try {
      if (token) {
        await fetch(`/api/portal/invoices/${payingInvoice.id}/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentMethod: paymentMethod === 'card' ? 'bank' : 'cash',
          }),
        });
      } else {
        await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            razorpay_order_id: mockOrderId,
            razorpay_payment_id: mockPaymentId,
            razorpay_signature: 'mock_test_signature',
            invoiceId: payingInvoice.id,
            amount: amountDue,
            partnerId: payingInvoice.customerId,
            type: PaymentType.Receive,
          }),
        });
      }
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
      invoiceId: payingInvoice.id,
      razorpayOrderId: mockOrderId,
      razorpayPaymentId: mockPaymentId,
    });

    clientCache.invalidate('GET:/api/portal/invoices');
    clientCache.invalidate('GET:/api/customer-invoices');
    clientCache.invalidate('GET:/api/payments');
    clientCache.invalidate('GET:/api/sales-orders');
    clientCache.invalidate('GET:/api/dashboard/summary');

    await mockDb.syncWithBackend();

    setPaymentSuccess(true);
    
    setTimeout(async () => {
      await reloadInvoices();
      setPayingInvoice(null);
      setPaymentSuccess(false);
    }, 2000);
  };

  const pendingRequests = invoices.filter(
    (inv) => inv.paymentRequested && inv.status !== CustomerInvoiceStatus.Paid
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col antialiased">
      <header className="bg-white text-slate-800 h-16 border-b border-slate-200 px-6 md:px-8 flex justify-between items-center z-10 sticky top-0 shadow-sm">
        <div className="font-bold text-xl text-slate-900 tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-700 to-blue-900 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-sm">
            UF
          </div>
          Urban Furnitures
        </div>
        <div className="flex items-center gap-5">
          <span className="text-sm font-bold text-slate-700">{currentUser?.name}</span>
          <button 
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer focus:outline-none"
            title="Logout"
          >
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Payment Request Banner */}
        {pendingRequests.length > 0 && (
          <div className="bg-white border border-amber-200 p-5 rounded-xl shadow-sm mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-slate-900 flex items-center gap-2">
                  Payment Request from Accounting
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md">
                    Action Required
                  </span>
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  You have <span className="font-bold text-slate-700">{pendingRequests.length} invoice(s)</span> with an active payment request. Please pay below to settle your account.
                </p>
              </div>
            </div>
            <button
              onClick={() => handlePayNowClick(pendingRequests[0])}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs shadow-sm transition-all whitespace-nowrap flex items-center gap-1.5 active:translate-y-[1px]"
            >
              <CreditCard size={14} /> Pay Invoice ({pendingRequests[0].number})
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <FileText size={16} />
              </div>
              <h1 className="text-lg font-bold text-slate-900">My Invoices</h1>
            </div>
            <span className="text-[13px] text-slate-500 font-medium">
              Showing only your invoices ({invoices.length})
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Invoice</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Invoice Date</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Due Date</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Amount Due</th>
                  <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto space-y-2">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-700">No invoices for your account</p>
                        <p className="text-xs text-slate-400">
                          When accounting issues an invoice for your orders, it will appear here.
                        </p>
                      </div>
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
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap text-[14px]">
                          <span>{inv.number}</span>
                          {inv.paymentRequested && !isPaid && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Send size={10} /> Payment Requested
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[14px] text-slate-600 font-medium">{inv.invoiceDate}</td>
                      <td className="px-6 py-4 text-[14px] text-slate-600 font-medium">{inv.dueDate}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 text-[15px]">
                        Rs. {due.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                            <CheckCircle size={13} /> PAID
                          </span>
                        ) : (
                          <Button 
                            variant="primary" 
                            size="sm" 
                            disabled={isProcessing}
                            onClick={() => handlePayNowClick(inv)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13px] px-4 py-2 rounded-lg shadow-sm disabled:opacity-50 transition-all active:translate-y-[1px] w-full max-w-[120px] mx-auto flex items-center justify-center gap-2"
                          >
                            <CreditCard size={14} />
                            {isProcessing && payingInvoice?.id === inv.id ? 'Processing...' : 'Pay Bill'}
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative transition-all">
            
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
                  {paymentNotice && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-xs text-amber-900 flex items-start gap-2.5">
                      <span className="text-base flex-shrink-0">⚠️</span>
                      <div className="space-y-1">
                        <p className="font-semibold text-amber-950">Payment Notice</p>
                        <p className="text-amber-800 leading-relaxed">{paymentNotice}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 space-y-2">
                    {(() => {
                      const rawLineTotal = (payingInvoice.lines || []).reduce(
                        (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
                        0
                      );
                      const subtotal = rawLineTotal > 0 ? rawLineTotal : (Number((payingInvoice as any).total) || 0);
                      const { cgst, sgst, totalGst } = calculateGST(subtotal);
                      const due = calculateDueAmount(payingInvoice);
                      return (
                        <>
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>Untaxed Subtotal:</span>
                            <span className="font-semibold text-slate-800">Rs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs text-blue-700">
                            <span>GST (18% - CGST 9% + SGST 9%):</span>
                            <span className="font-bold">+ Rs. {totalGst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="pt-2 border-t border-blue-200 text-center">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Total Amount Due (Incl. 18% GST)</p>
                            <p className="text-3xl font-black text-blue-700">
                              Rs. {due.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <p className="text-center text-[11px] text-blue-500">Invoice Ref: {payingInvoice.number}</p>
                        </>
                      );
                    })()}
                  </div>

                  <div className="space-y-4 mb-8">
                    <label className="block text-sm font-medium text-slate-700">Select Payment Method</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-all
                          ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        <CreditCard size={18} /> Card
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 font-medium transition-all
                          ${paymentMethod === 'bank' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
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
