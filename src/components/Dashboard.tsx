import React, { useMemo } from 'react';
import { useStore } from '../store';
import { 
  Users, Calendar, Clock, DollarSign, ArrowUpRight, AlertTriangle, CheckCircle2, TrendingUp, BookOpen 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

export default function Dashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { students, schedules, attendance, payments } = useStore();

  // 1. STATS CALCULATIONS
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'Active').length;
  
  // Today's classes
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = weekdays[new Date().getDay()];
  const todayClasses = useMemo(() => {
    return schedules.filter(sc => {
      const student = students.find(s => s.id === sc.studentId);
      return sc.weekday === todayName && student?.status === 'Active';
    });
  }, [schedules, students, todayName]);

  // Overall Attendance Summary (Current Month)
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const currentMonthPrefix = `${currentYear}-${new Date().toISOString().substring(5, 7)}`;
  
  const monthlyAttendance = useMemo(() => {
    return attendance.filter(at => at.date.startsWith(currentMonthPrefix));
  }, [attendance, currentMonthPrefix]);

  const totalTeachingHours = useMemo(() => {
    return Math.round(monthlyAttendance.reduce((acc, curr) => acc + curr.duration, 0) * 10) / 10;
  }, [monthlyAttendance]);

  // Financial Statistics
  const financialStats = useMemo(() => {
    let income = 0;
    let received = 0;
    let due = 0;

    payments.forEach(pay => {
      income += pay.payableAmount;
      received += pay.paidAmount;
      due += pay.dueAmount;
    });

    return { income, received, due };
  }, [payments]);

  // 2. CHART DATA ENGINES
  const earningsData = useMemo(() => {
    // Group payments by billing period (e.g. "May 2026", "June 2026")
    const months = ['May 2026', 'June 2026'];
    return months.map(m => {
      const filtered = payments.filter(p => p.billingPeriod === m);
      const total = filtered.reduce((sum, current) => sum + current.payableAmount, 0);
      const received = filtered.reduce((sum, current) => sum + current.paidAmount, 0);
      return {
        name: m,
        Earnings: total,
        Received: received,
      };
    });
  }, [payments]);

  const classDistribution = useMemo(() => {
    const counts: { [key: string]: number } = {};
    students.forEach(s => {
      counts[s.class] = (counts[s.class] || 0) + 1;
    });
    return Object.keys(counts).map(cl => ({ name: cl, value: counts[cl] }));
  }, [students]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Top Banner Alert / Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome Back, Tutor!</h2>
          <p className="text-indigo-200 text-sm mt-1">
            Tracking {activeStudents} active students and {todayClasses.length} sessions scheduled for today ({todayName}).
          </p>
        </div>
        <button 
          onClick={() => onNavigate('schedules')}
          className="px-4 py-2.5 bg-white text-indigo-950 font-medium text-xs tracking-wider uppercase rounded-xl shadow hover:bg-slate-50 transition flex items-center gap-1.5 self-start md:self-auto"
        >
          View Calendar <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Grid of Stats Cards - SLEEK INTERFACE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6" id="dashboard-stats-grid">
        {/* Total & Active Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md" id="stat-card-active-students">
          <div>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1 font-display">Active Students</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{activeStudents} <span className="text-xs text-slate-400 font-normal">/ {totalStudents}</span></h3>
            <div className="mt-3 flex items-center text-emerald-650 font-bold text-[10px]">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full inline-block">
                +3 this month
              </span>
            </div>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
            <Users size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Today's Schedule count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md" id="stat-card-today-sessions">
          <div>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1 font-display">Today's Sessions</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{todayClasses.length}</h3>
            <div className="mt-3 flex items-center text-indigo-600 font-bold text-[10px]">
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full inline-block">
                {todayName} list
              </span>
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm flex-shrink-0">
            <Calendar size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Monthly Attendance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md" id="stat-card-attendance-rate">
          <div>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1 font-display">Attendance Rate</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">98.4%</h3>
            <div className="mt-4 w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-650 h-full w-[98.4%] rounded-full"></div>
            </div>
          </div>
          <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center text-pink-600 shadow-sm flex-shrink-0">
            <Clock size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Financial Outstanding / Earned */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md" id="stat-card-outstanding-dues">
          <div>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1 font-display">Outstanding Dues</p>
            <h3 className="text-3xl font-black text-rose-600 tracking-tight">${financialStats.due}</h3>
            <p className="text-[10px] text-slate-400 mt-3 font-medium">
              Collected: <span className="text-emerald-700 font-bold">${financialStats.received}</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shadow-sm flex-shrink-0">
            <DollarSign size={22} className="stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Main Insights Panel: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive Earnings trend chart */}
        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Earning & Collection Metrics</h3>
                <p className="text-xs text-slate-400">Comparing expected payable vs real received transactions</p>
              </div>
              <TrendingUp className="text-indigo-600" size={20} />
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Earnings" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
                  <Area type="monotone" dataKey="Received" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mini Legend Row */}
          <div className="flex items-center gap-4 border-t border-slate-50 pt-3 mt-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>
              <span>Total Billable Amount</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
              <span>Real Paid Income</span>
            </div>
          </div>
        </div>

        {/* Student Class Distribution */}
        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Student Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">Proportionate enrollment segmented by class grades</p>

            <div className="h-48 w-full flex items-center justify-center">
              {classDistribution.length === 0 ? (
                <div className="text-center py-6 text-slate-300">
                  <Users size={32} className="mx-auto opacity-50 mb-1" />
                  <span className="text-xs">No student dataset</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {classDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {classDistribution.map((el, idx) => (
              <div key={el.name} className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span>{el.name}</span>
                </div>
                <span>{el.value} {el.value === 1 ? 'student' : 'students'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row showing Today's Schedule details vs Urgent Dues - SLEEK INTERFACE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-row-tables">
        
        {/* Today's Agenda list */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm" id="widget-today-schedule">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-805 text-base font-display">Today's Class Schedule</h3>
              <p className="text-xs text-slate-400">Class slots mapped for this 24-hour cycle ({todayName})</p>
            </div>
            <span className="px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              {todayClasses.length} Scheduled
            </span>
          </div>

          <div className="space-y-3 max-h-76 overflow-y-auto pr-1">
            {todayClasses.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl text-slate-400 space-y-2">
                <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
                <p className="text-sm font-semibold text-slate-800">Clear calendar today!</p>
                <p className="text-xs">No active tuition sessions assigned for today.</p>
              </div>
            ) : (
              todayClasses.map((cl, idx) => {
                const student = students.find(s => s.id === cl.studentId);
                // Alternating elegant left-border indicators
                const borderColors = [
                  'border-l-indigo-600 bg-slate-50', 
                  'border-l-emerald-500 bg-slate-50', 
                  'border-l-amber-500 bg-slate-50'
                ];
                const cardColorClass = borderColors[idx % borderColors.length];
                
                return (
                  <div key={cl.id} className={`p-4 rounded-xl border border-slate-205 border-l-4 hover:border-slate-300 transition flex items-center justify-between ${cardColorClass}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-bold text-sm text-indigo-700 shadow-sm">
                        {student?.name.charAt(0) || 'S'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{student?.name}</h4>
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1">
                          <BookOpen size={12} className="text-slate-400" />
                          <span>{cl.subject} <span className="text-slate-400">• {student?.class}</span></span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">📍 location: {cl.location}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-bold text-slate-800 block font-mono">{cl.startTime} - {cl.endTime}</span>
                      <button 
                        onClick={() => onNavigate('attendance')}
                        className="mt-2 text-[9px] font-bold text-indigo-650 hover:text-indigo-800 tracking-wider inline-block uppercase hover:underline"
                      >
                        LOG ATTENDANCE
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Outstanding Warning / Student Bill List */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm" id="widget-pending-payments">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-805 text-base font-display">Urgent Pending Payments</h3>
              <p className="text-xs text-slate-400">Students with outstanding invoice amounts</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
              <AlertTriangle size={15} />
            </div>
          </div>

          <div className="space-y-3 max-h-76 overflow-y-auto pr-1">
            {payments.filter(p => p.dueAmount > 0).length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl text-slate-400 space-y-1">
                <CheckCircle2 className="mx-auto text-emerald-500" size={30} />
                <p className="text-sm font-semibold text-slate-700 font-display">Perfect Billing Status!</p>
                <p className="text-xs">No pending tuitions require collection currently.</p>
              </div>
            ) : (
              payments.filter(p => p.dueAmount > 0).map(pay => {
                const student = students.find(st => st.id === pay.studentId);
                return (
                  <div key={pay.id} className="p-4 bg-rose-50/20 border border-rose-100 rounded-xl flex items-center justify-between transition hover:bg-rose-50/30">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{student?.name || 'Unknown Student'}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Billing Period: <span className="font-semibold text-slate-700">{pay.billingPeriod}</span>
                      </p>
                      <span className="text-[10px] font-bold tracking-wide text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full mt-2 inline-block border border-rose-100">
                        Pending: ${pay.dueAmount} <span className="text-slate-400 font-normal">/ expected: ${pay.payableAmount}</span>
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {pay.status}
                      </span>
                      <button 
                        onClick={() => onNavigate('payments')}
                        className="block mt-2.5 text-[9px] font-bold text-rose-600 hover:text-rose-800 transition tracking-wider uppercase hover:underline"
                      >
                        COLLECT BALANCE
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
