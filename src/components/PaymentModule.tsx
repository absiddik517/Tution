import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Payment } from '../types';
import { 
  DollarSign, Landmark, Plus, ClipboardCheck, ArrowUpRight, CheckSquare, RefreshCw, X, Receipt, Sparkles, TrendingUp
} from 'lucide-react';

export default function PaymentModule() {
  const { 
    payments, students, attendance, addPayment, updatePayment, deletePayment, generateAutoPayments 
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);

  // Auto Generate Inputs
  const [selectedStudentForAuto, setSelectedStudentForAuto] = useState('');
  const [selectedMonthForAuto, setSelectedMonthForAuto] = useState('June 2026');
  const [expectedDaysForAuto, setExpectedDaysForAuto] = useState(8);

  // Manual Custom Payment inputs
  const [formStudentId, setFormStudentId] = useState('');
  const [formBillingPeriod, setFormBillingPeriod] = useState('June 2026');
  const [formAttendedDays, setFormAttendedDays] = useState(8);
  const [formExpectedDays, setFormExpectedDays] = useState(8);
  const [formPayableAmount, setFormPayableAmount] = useState(400);
  const [formPaidAmount, setFormPaidAmount] = useState(0);
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formError, setFormError] = useState('');

  // Financial Metrics
  const metrics = useMemo(() => {
    let earned = 0;
    let received = 0;
    let dues = 0;
    
    payments.forEach(p => {
      earned += p.payableAmount;
      received += p.paidAmount;
      dues += p.dueAmount;
    });

    return { earned, received, dues };
  }, [payments]);

  // Manage manual payment submit
  const handleManualSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      setFormError('Please select a student for billing.');
      return;
    }
    if (formPayableAmount <= 0) {
      setFormError('Payable billing amount must be greater than zero.');
      return;
    }
    if (formPaidAmount < 0) {
      setFormError('Paid amount cannot be negative.');
      return;
    }

    const dueAmount = formPayableAmount - formPaidAmount;
    let status: Payment['status'] = 'Due';
    if (formPaidAmount >= formPayableAmount) status = 'Paid';
    else if (formPaidAmount > 0) status = 'Partial';

    addPayment({
      studentId: formStudentId,
      billingPeriod: formBillingPeriod,
      attendedDays: formAttendedDays,
      expectedDays: formExpectedDays,
      payableAmount: formPayableAmount,
      paidAmount: formPaidAmount,
      dueAmount,
      paymentDate: formPaidAmount > 0 ? (formPaymentDate || new Date().toISOString().substring(0, 10)) : '',
      status
    });

    setShowAddModal(false);
  };

  const handleAutoSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForAuto) {
      alert('Please choose a student to auto compute invoice results.');
      return;
    }

    generateAutoPayments(selectedStudentForAuto, selectedMonthForAuto, expectedDaysForAuto);
    setShowAutoModal(false);
  };

  const handleOneClickReceiveAll = (id: string) => {
    const p = payments.find(pay => pay.id === id);
    if (!p) return;
    updatePayment(id, {
      paidAmount: p.payableAmount,
      paymentDate: new Date().toISOString().substring(0, 10),
    });
  };

  // active clients
  const activeStudents = useMemo(() => students.filter(s => s.status === 'Active'), [students]);

  return (
    <div className="space-y-6">
      
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payments & Invoicing</h2>
          <p className="text-xs text-slate-400">Generate tuition bills automatically from attendance, log custom paid receipts, and clear dues</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Automatic Invoice generator */}
          <button 
            onClick={() => {
              const active = students.filter(s => s.status === 'Active');
              setSelectedStudentForAuto(active[0]?.id || '');
              setSelectedMonthForAuto('June 2026');
              setExpectedDaysForAuto(8);
              setShowAutoModal(true);
            }}
            disabled={activeStudents.length === 0}
            className="px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 font-semibold text-xs tracking-wider uppercase rounded-xl shadow-none hover:bg-indigo-100/70 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Auto-Generate from Attendance
          </button>

          <button 
            onClick={() => {
              const active = students.filter(s => s.status === 'Active');
              setFormStudentId(active[0]?.id || '');
              setFormBillingPeriod('June 2026');
              setFormAttendedDays(8);
              setFormExpectedDays(8);
              setFormPayableAmount(active[0]?.monthlySalary || 400);
              setFormPaidAmount(0);
              setFormPaymentDate('');
              setFormError('');
              setShowAddModal(true);
            }}
            disabled={activeStudents.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus size={15} /> Custom Bill
          </button>
        </div>
      </div>

      {/* Aggregate metrics box */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm space-y-1 block">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Accumulated earnings</span>
          <span className="text-3xl font-extrabold tracking-tight block">৳{metrics.earned}</span>
          <span className="text-xs text-slate-400 block mt-1 pt-1.5 border-t border-slate-800">Expected invoice revenue</span>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-1 block">
          <span className="text-[10px] text-emerald-600 uppercase tracking-widest font-bold">Received amount</span>
          <span className="text-3xl font-extrabold text-slate-800 tracking-tight block">৳{metrics.received}</span>
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1 font-semibold">
            Collection efficiency: {metrics.earned > 0 ? Math.round((metrics.received / metrics.earned) * 100) : 0}%
          </span>
        </div>

        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-1 block">
          <span className="text-[10px] text-rose-500 uppercase tracking-widest font-bold">Outstanding due</span>
          <span className="text-3xl font-extrabold text-rose-600 tracking-tight block">৳{metrics.dues}</span>
          <span className="text-xs text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full inline-block mt-1 font-semibold">
            Unpaid assets pending
          </span>
        </div>
      </div>

      {/* List layout segments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* All generated bills */}
        <div className="lg:col-span-2 bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Active Invoices ({payments.length})</h3>

          <div className="space-y-3 max-h-120 overflow-y-auto pr-1">
            {payments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Receipt size={42} className="mx-auto text-slate-300 stroke-[1.2]" />
                <p className="text-sm font-semibold">No Invoices Registered</p>
                <p className="text-xs">Configure custom bills or automatically analyze attendance to issue invoices.</p>
              </div>
            ) : (
              payments.map(pay => {
                const student = students.find(s => s.id === pay.studentId);
                return (
                  <div key={pay.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-200 transition">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                        {student?.name.charAt(0) || '?'}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-800">{student?.name || 'Unknown Student'}</h4>
                          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.2 rounded">
                            {pay.billingPeriod}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-medium">
                          <span>Attended: <b className="text-slate-700">{pay.attendedDays} days</b> (Expected: {pay.expectedDays})</span>
                          <span>Billable: <b className="text-slate-800">৳{pay.payableAmount}</b></span>
                          {pay.paymentDate && <span className="text-[11px] text-slate-400">Paid on: {pay.paymentDate}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto pt-2.5 sm:pt-0 border-t sm:border-0 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Status indicator */}
                      <div>
                        <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-md uppercase ${
                          pay.status === 'Paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : pay.status === 'Partial'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {pay.status}
                        </span>
                        {pay.dueAmount > 0 && (
                          <span className="text-[10px] font-bold text-red-500 block text-right mt-1">
                            Due: ৳{pay.dueAmount}
                          </span>
                        )}
                      </div>

                      {/* Collect/Edit controls */}
                      <div className="flex gap-1">
                        {pay.dueAmount > 0 && (
                          <button
                            onClick={() => handleOneClickReceiveAll(pay.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] tracking-wide rounded-lg shadow-sm transition uppercase"
                            title="Log fully collected payments"
                          >
                            Collect All
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Delete this billing invoice record?')) {
                              deletePayment(pay.id);
                            }
                          }}
                          className="p-2 border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition"
                          title="Delete invoice record"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Outstanding dues overview on right side */}
        <div className="bg-red-50/40 border border-rose-100 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
            <TrendingUp size={16} />
            <h3>Outstanding Dues Index</h3>
          </div>

          <div className="space-y-3">
            {payments.filter(p => p.dueAmount > 0).length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                🎉 Excellent status! No tutors have pending payments currently.
              </div>
            ) : (
              payments.filter(p => p.dueAmount > 0).map(p => {
                const student = students.find(s => s.id === p.studentId);
                return (
                  <div key={p.id} className="p-3 bg-white border border-rose-150 rounded-2xl space-y-2 flex flex-col justify-between shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 leading-tight">{student?.name}</h4>
                        <span className="text-[10px] text-slate-400">{p.billingPeriod}</span>
                      </div>
                      <span className="text-xs font-black text-rose-600">৳{p.dueAmount}</span>
                    </div>

                    <button
                      onClick={() => handleOneClickReceiveAll(p.id)}
                      className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold tracking-wider rounded-lg transition uppercase"
                    >
                      Process Payment
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* AUTO GENERATE DIALOG MODAL */}
      {showAutoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Auto-Generate Invoice</h3>
                <p className="text-xs text-slate-400 mt-0.5">Automate payable calculation based on attendance counts</p>
              </div>
              <button 
                onClick={() => setShowAutoModal(false)}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAutoSub} className="p-6 space-y-4">
              
              {/* Student choose */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Student Client</label>
                <select
                  value={selectedStudentForAuto}
                  onChange={(e) => setSelectedStudentForAuto(e.target.value)}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                >
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class}) - Salary Rate: ৳{s.monthlySalary}/{s.paymentCycle}</option>
                  ))}
                </select>
              </div>

              {/* Month Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Billing Period Month</label>
                <select
                  value={selectedMonthForAuto}
                  onChange={(e) => setSelectedMonthForAuto(e.target.value)}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                >
                  <option value="May 2026">May 2026</option>
                  <option value="June 2026">June 2026</option>
                  <option value="July 2026">July 2026</option>
                </select>
              </div>

              {/* Expected sessions count */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Expected Sessions Day Count</label>
                <input 
                  type="number" 
                  value={expectedDaysForAuto}
                  onChange={(e) => setExpectedDaysForAuto(Number(e.target.value))}
                  placeholder="8"
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 leading-normal block">
                  * For Custom cycles: Payable Amount = (Monthly Salary / Expected Days) × Attended Days. Monthly rate cycles will calculate flatly.
                </span>
              </div>

              {/* Form CTAs */}
              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAutoModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow hover:bg-indigo-700 transition"
                >
                  Compile Invoice
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MANUALLY CUSTOM BILL MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Add Custom Billing Record</h3>
                <p className="text-xs text-slate-400 mt-0.5">Submit custom manual billing fields directly</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleManualSub} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-xs text-red-600 font-bold">
                  ⚠️ {formError}
                </div>
              )}

              {/* Student choose */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Student Client</label>
                <select
                  value={formStudentId}
                  onChange={(e) => {
                    setFormStudentId(e.target.value);
                    const studentObj = students.find(s => s.id === e.target.value);
                    if (studentObj) setFormPayableAmount(studentObj.monthlySalary);
                  }}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                >
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Billing period month */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Billing period period</label>
                  <input 
                    type="text" 
                    value={formBillingPeriod}
                    onChange={(e) => setFormBillingPeriod(e.target.value)}
                    placeholder="e.g. June 2026"
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>

                {/* Expected sessions count */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Expected Sessions Day Count</label>
                  <input 
                    type="number" 
                    value={formExpectedDays}
                    onChange={(e) => setFormExpectedDays(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Attended sessions count */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Attended Sessions Day Count</label>
                  <input 
                    type="number" 
                    value={formAttendedDays}
                    onChange={(e) => setFormAttendedDays(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>

                {/* Payable flat amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Custom Payable ৳ Amount</label>
                  <input 
                    type="number" 
                    value={formPayableAmount}
                    onChange={(e) => setFormPayableAmount(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Paid Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Currently Paid ৳ Amount</label>
                  <input 
                    type="number" 
                    value={formPaidAmount}
                    onChange={(e) => setFormPaidAmount(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>

                {/* Payment log Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Receipt Log Date</label>
                  <input 
                    type="date" 
                    value={formPaymentDate}
                    onChange={(e) => setFormPaymentDate(e.target.value)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Form CTAs */}
              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow hover:bg-indigo-700 transition"
                >
                  Issue Custom Bill
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
