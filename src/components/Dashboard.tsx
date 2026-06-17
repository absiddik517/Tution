import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store';
import { 
  Users, Calendar, Clock, DollarSign, ArrowUpRight, AlertTriangle, CheckCircle2, TrendingUp, BookOpen, Clock3, Save, X, Play, Square, Volume2, CloudLightning
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { playSoundPreset } from '../sound';
import { formatDate, formatTime } from '../formatUtils';

export default function Dashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { students, schedules, attendance, payments, examSchedules, addAttendance, addNotification, settings, triggerManualSync } = useStore();

  // 1. LIVE SESSION TIMER STATE
  const [sessionActive, setSessionActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeAlert, setActiveAlert] = useState<{ title: string; body: string } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Auto-clear active toast alert after 10 seconds
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  // Schedule session states of today: { [scheduleId: string]: 'idle' | 'running' | 'completed' }
  const [scheduleSessions, setScheduleSessions] = useState<Record<string, 'idle' | 'running' | 'completed'>>(() => {
    try {
      const saved = localStorage.getItem('tt_schedule_sessions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateScheduleSessionStatus = (scheduleId: string, status: 'idle' | 'running' | 'completed') => {
    setScheduleSessions(prev => {
      const updated = { ...prev };
      if (status === 'running') {
        // change any other running session back to idle
        Object.keys(updated).forEach(key => {
          if (updated[key] === 'running') {
            updated[key] = 'idle';
          }
        });
      }
      updated[scheduleId] = status;
      localStorage.setItem('tt_schedule_sessions', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const activeScheduleId = localStorage.getItem('tt_session_schedule_id');
    const runningStart = localStorage.getItem('tt_session_started_at');
    if (activeScheduleId && runningStart) {
      setScheduleSessions(prev => {
        if (prev[activeScheduleId] !== 'running') {
          const updated = { ...prev, [activeScheduleId]: 'running' as const };
          localStorage.setItem('tt_schedule_sessions', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [sessionActive]);

  // Attendance Log Form Fields
  const [logDate, setLogDate] = useState('');
  const [logEntryAt, setLogEntryAt] = useState('');
  const [logExitAt, setLogExitAt] = useState('');
  const [logDuration, setLogDuration] = useState(1.0);
  const [logRemarks, setLogRemarks] = useState('');
  const [logSubject, setLogSubject] = useState('');
  const [logError, setLogError] = useState('');

  const m1 = settings.landmarkFirstAlert ?? 40;
  const m2 = settings.landmarkSecondAlert ?? 60;
  const m3 = settings.landmarkThirdAlert ?? 80;

  const triggerMilestoneSound = (alertIndex: 1 | 2 | 3) => {
    let preset = 'crystal';
    if (alertIndex === 1) preset = settings.landmarkFirstSound || 'crystal';
    if (alertIndex === 2) preset = settings.landmarkSecondSound || 'double';
    if (alertIndex === 3) preset = settings.landmarkThirdSound || 'triple';
    playSoundPreset(preset);
  };

  const activeStudentsList = useMemo(() => students.filter(s => s.status === 'Active'), [students]);

  // Load from local storage
  useEffect(() => {
    const runningStart = localStorage.getItem('tt_session_started_at');
    const runningStudent = localStorage.getItem('tt_session_student_id');
    if (runningStart && runningStudent) {
      setSessionActive(true);
      setSelectedStudentId(runningStudent);
      setStartedAt(runningStart);
      const elapsed = Math.floor((Date.now() - new Date(runningStart).getTime()) / 1000);
      setTimerSeconds(elapsed > 0 ? elapsed : 0);
    }
  }, []);

  // Timer Tick
  useEffect(() => {
    let interval: any = null;
    if (sessionActive && startedAt) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        setTimerSeconds(elapsed > 0 ? elapsed : 0);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [sessionActive, startedAt]);

  // Live session landmarks notification effect (customized in settings, defaults 40 min, 60 min, 80 min)
  useEffect(() => {
    if (!sessionActive || !selectedStudentId) {
      localStorage.removeItem('tt_session_notified_landmarks');
      return;
    }

    const studentName = students.find(s => s.id === selectedStudentId)?.name || 'Student';

    // Read current notified landmarks
    let notified: string[] = [];
    try {
      const saved = localStorage.getItem('tt_session_notified_landmarks');
      if (saved) notified = JSON.parse(saved);
    } catch {}

    const checkAndNotify = (minutes: number, secondsLimit: number, alertIndex: 1 | 2 | 3) => {
      const key = minutes.toString();
      if (timerSeconds >= secondsLimit && !notified.includes(key)) {
        const title = `🚨 ${minutes}-Min Live Session Milestone`;
        const body = `Active tuition session with ${studentName} has crossed ${minutes} minutes of lesson duration.`;
        
        addNotification(title, body, 'system');
        setActiveAlert({ title, body });
        triggerMilestoneSound(alertIndex);
        
        notified.push(key);
        localStorage.setItem('tt_session_notified_landmarks', JSON.stringify(notified));
      }
    };

    const m1 = settings.landmarkFirstAlert ?? 40;
    const m2 = settings.landmarkSecondAlert ?? 60;
    const m3 = settings.landmarkThirdAlert ?? 80;

    checkAndNotify(m1, m1 * 60, 1); 
    checkAndNotify(m2, m2 * 60, 2); 
    checkAndNotify(m3, m3 * 60, 3); 

  }, [timerSeconds, sessionActive, selectedStudentId, students, addNotification, settings]);

  const handleStartSession = () => {
    if (!selectedStudentId) return;
    const nowISO = new Date().toISOString();
    localStorage.setItem('tt_session_started_at', nowISO);
    localStorage.setItem('tt_session_student_id', selectedStudentId);
    
    // Attempt to match with today's scheduled class for this student
    const matchedTodayClass = todayClasses.find(cl => cl.studentId === selectedStudentId);
    if (matchedTodayClass) {
      localStorage.setItem('tt_session_schedule_id', matchedTodayClass.id);
      updateScheduleSessionStatus(matchedTodayClass.id, 'running');
    }
    
    setStartedAt(nowISO);
    setTimerSeconds(0);
    setSessionActive(true);
  };

  const handleStartSessionForStudent = (studentId: string, scheduleId?: string) => {
    const nowISO = new Date().toISOString();
    localStorage.setItem('tt_session_started_at', nowISO);
    localStorage.setItem('tt_session_student_id', studentId);
    if (scheduleId) {
      localStorage.setItem('tt_session_schedule_id', scheduleId);
      updateScheduleSessionStatus(scheduleId, 'running');
    }
    setSelectedStudentId(studentId);
    setStartedAt(nowISO);
    setTimerSeconds(0);
    setSessionActive(true);
  };

  const handleStopSession = () => {
    if (!startedAt) return;
    const now = new Date();
    const startTimeDate = new Date(startedAt);

    // Populate log form fields
    setLogDate(startTimeDate.toISOString().substring(0, 10));
    
    // Format times
    const pad = (num: number) => num.toString().padStart(2, '0');
    setLogEntryAt(`${pad(startTimeDate.getHours())}:${pad(startTimeDate.getMinutes())}`);
    setLogExitAt(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    
    // Duration in hours
    const durationHours = Math.max(0.1, Math.round((timerSeconds / 3600) * 100) / 100);
    setLogDuration(durationHours);

    // Get default subject
    const selectedStudent = students.find(s => s.id === selectedStudentId);
    setLogSubject(selectedStudent?.subjects[0] || 'Mathematics');
    setLogRemarks(`Live Tuition Session (elapsed: ${formatDurationText(timerSeconds)}).`);
    setLogError('');
    
    setShowLogModal(true);
  };

  const handleDiscardSession = () => {
    const activeScheduleId = localStorage.getItem('tt_session_schedule_id');
    if (activeScheduleId) {
      updateScheduleSessionStatus(activeScheduleId, 'idle');
      localStorage.removeItem('tt_session_schedule_id');
    }
    localStorage.removeItem('tt_session_started_at');
    localStorage.removeItem('tt_session_student_id');
    setSessionActive(false);
    setStartedAt(null);
    setSelectedStudentId('');
    setShowDiscardConfirm(false);
  };

  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logSubject.trim()) {
      setLogError('Course Subject is required');
      return;
    }
    if (logDuration <= 0) {
      setLogError('Duration must be greater than zero');
      return;
    }

    addAttendance({
      studentId: selectedStudentId,
      date: logDate,
      entryAt: logEntryAt,
      exitAt: logExitAt,
      duration: logDuration,
      remarks: `${logSubject}: ${logRemarks}`
    });

    const activeScheduleId = localStorage.getItem('tt_session_schedule_id');
    if (activeScheduleId) {
      updateScheduleSessionStatus(activeScheduleId, 'completed');
      localStorage.removeItem('tt_session_schedule_id');
    }

    // Clear session timer elements
    localStorage.removeItem('tt_session_started_at');
    localStorage.removeItem('tt_session_student_id');
    setSessionActive(false);
    setStartedAt(null);
    setSelectedStudentId('');
    setShowLogModal(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDurationText = (totalSeconds: number) => {
    const mins = Math.ceil(totalSeconds / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  // 2. STATS CALCULATIONS
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

  // Upcoming Exams data
  const upcomingExamsCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return examSchedules.filter(ex => ex.date >= todayStr).length;
  }, [examSchedules]);

  const nextExam = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomings = examSchedules
      .filter(ex => ex.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcomings[0] || null;
  }, [examSchedules]);

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

  const pendingStudents = useMemo(() => students.filter(s => s.syncStatus === 'pending').length, [students]);
  const pendingSchedules = useMemo(() => schedules.filter(s => s.syncStatus === 'pending').length, [schedules]);
  const pendingAttendance = useMemo(() => attendance.filter(s => s.syncStatus === 'pending').length, [attendance]);
  const pendingPayments = useMemo(() => payments.filter(s => s.syncStatus === 'pending').length, [payments]);
  const totalPendingSyncs = pendingStudents + pendingSchedules + pendingAttendance + pendingPayments;

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Today's Class Schedule card replacing Welcome Back banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm" id="widget-today-schedule">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg font-display">Today's Class Schedule</h3>
            <p className="text-xs text-slate-400">Class slots mapped for this 24-hour cycle ({todayName})</p>
          </div>
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-wider font-extrabold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-150">
            {todayClasses.length} Scheduled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {todayClasses.length === 0 ? (
            <div className="col-span-full text-center py-8 bg-slate-50 rounded-2xl text-slate-400 space-y-2 border border-slate-100">
              <CheckCircle2 className="mx-auto text-emerald-500" size={32} />
              <p className="text-sm font-semibold text-slate-800">Clear calendar today!</p>
              <p className="text-xs">No active tuition sessions assigned for today.</p>
            </div>
          ) : (
            todayClasses.map((cl, idx) => {
              const student = students.find(s => s.id === cl.studentId);
              // Alternating left-border indicators
              const borderColors = [
                'border-l-indigo-600 bg-slate-50', 
                'border-l-emerald-500 bg-slate-50', 
                'border-l-amber-500 bg-slate-50'
              ];
              const cardColorClass = borderColors[idx % borderColors.length];
              const sessionStatus = scheduleSessions[cl.id] || 'idle';
              
              return (
                <div key={cl.id} className={`p-4 rounded-2xl border border-slate-200 border-l-4 hover:border-slate-300 transition flex items-center justify-between gap-3 ${cardColorClass}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-sm text-indigo-700 shadow-sm shrink-0 font-display">
                      {student?.name.charAt(0) || 'S'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 truncate">{student?.name}</h4>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                        <BookOpen size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{cl.subject} <span className="text-slate-400 font-normal">• {student?.class}</span></span>
                      </div>
                      
                      {/* Exam Schedule Info Line */}
                      {(() => {
                        const studentExams = examSchedules.filter(ex => ex.studentId === cl.studentId);
                        const todayStr = new Date().toISOString().split('T')[0];
                        const todayExam = studentExams.find(ex => ex.date === todayStr);
                        const nextUpcomingExam = studentExams
                          .filter(ex => ex.date >= todayStr)
                          .sort((a, b) => a.date.localeCompare(b.date))[0];
                        const targetExam = todayExam || nextUpcomingExam;
                        
                        return (
                          <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${targetExam ? 'bg-pink-500' : 'bg-slate-300'} shrink-0`} />
                            <span className={`${targetExam ? 'text-pink-750 font-semibold' : 'text-slate-400'} truncate`}>
                              {targetExam ? (
                                <>
                                  Exam: <span className="font-extrabold">{targetExam.topic}</span>
                                </>
                              ) : (
                                'No exams scheduled'
                              )}
                            </span>
                          </div>
                        );
                      })()}

                      <p className="text-[10px] text-indigo-700 mt-1 font-extrabold flex items-center gap-1 font-mono">
                        ⏰ {formatTime(cl.startTime)} - {formatTime(cl.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-center">
                    {sessionStatus === 'idle' && (
                      <button 
                        onClick={() => handleStartSessionForStudent(cl.studentId, cl.id)}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition hover:scale-110 active:scale-95 shadow-md flex items-center justify-center"
                        title="Start Tuition Session"
                      >
                        <Play size={13} className="fill-white translate-x-[1px]" />
                      </button>
                    )}

                    {sessionStatus === 'running' && (
                      <button 
                        onClick={handleStopSession}
                        className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition hover:scale-110 active:scale-95 shadow-md flex items-center justify-center animate-pulse"
                        title="Stop & Log Session"
                      >
                        <Square size={13} className="fill-white stroke-white" />
                      </button>
                    )}

                    {sessionStatus === 'completed' && (
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-xl animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest font-mono leading-none">done!</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dynamic Session tracking widget */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4" id="widget-live-session-tracker">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${sessionActive ? 'bg-red-500 animate-pulse' : 'bg-slate-350'}`}></div>
            <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase flex items-center gap-1.5 font-display">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 py-0.5 px-2 rounded-md font-semibold">Active Tracker</span> Live Tuition Session Trigger
            </h3>
          </div>
          {sessionActive && (
            <span className="text-xs font-mono font-bold bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 flex items-center gap-1.5 self-start sm:self-auto">
              <Clock3 size={13} className="animate-spin text-rose-500" /> ELAPSED: {formatTimer(timerSeconds)}
            </span>
          )}
        </div>

        {!sessionActive ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Choose local student and begin stopwatch session</span>
              <select
                id="session-student-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Select active student --</option>
                {activeStudentsList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
                ))}
              </select>
            </div>
            
            <button
              id="btn-start-session"
              onClick={handleStartSession}
              disabled={!selectedStudentId}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 self-stretch sm:self-end shadow-sm"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div> Start Tuition Session
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-rose-50/30 border border-rose-100 p-4 rounded-xl">
            <div className="flex-1">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">In Session Counter active</span>
              <p className="text-sm font-bold text-slate-800 mt-1">
                Student: <span className="text-indigo-650 font-black">{students.find(s => s.id === selectedStudentId)?.name}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Started on {new Date(startedAt || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Duration tracks automatically.
              </p>
              
              <div className="flex flex-wrap items-center gap-2 mt-3 select-none">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Milestone:</span>
                <button 
                  onClick={() => triggerMilestoneSound(1)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 hover:border-indigo-400 hover:scale-105 active:scale-95 ${
                    timerSeconds >= m1 * 60 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}
                  title={`Preview ${m1}-Min Crystal Chime`}
                >
                  <span>{timerSeconds >= m1 * 60 ? '✓' : '○'} {m1}m</span>
                  <Volume2 size={10} className="text-slate-400 shrink-0" />
                </button>
                <button 
                  onClick={() => triggerMilestoneSound(2)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 hover:border-indigo-400 hover:scale-105 active:scale-95 ${
                    timerSeconds >= m2 * 60 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}
                  title={`Preview ${m2}-Min Dual Chime`}
                >
                  <span>{timerSeconds >= m2 * 60 ? '✓' : '○'} {m2}m</span>
                  <Volume2 size={10} className="text-slate-400 shrink-0" />
                </button>
                <button 
                  onClick={() => triggerMilestoneSound(3)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 hover:border-indigo-400 hover:scale-105 active:scale-95 ${
                    timerSeconds >= m3 * 60 ? 'bg-indigo-50 border-indigo-200 text-indigo-700 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}
                  title={`Preview ${m3}-Min Warning Chime`}
                >
                  <span>{timerSeconds >= m3 * 60 ? '✓' : '○'} {m3}m</span>
                  <Volume2 size={10} className="text-slate-400 shrink-0" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-center sm:self-auto">
              {showDiscardConfirm ? (
                <div className="flex items-center gap-2 border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 rounded-xl animate-in fade-in duration-250">
                  <span className="text-[10px] text-rose-600 font-extrabold uppercase tracking-wider">Discard session?</span>
                  <button
                    onClick={handleDiscardSession}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase rounded-lg transition shadow-sm"
                    id="btn-confirm-discard-session"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDiscardConfirm(false)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-white text-[10px] font-bold uppercase rounded-lg transition"
                    id="btn-cancel-discard-session"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  id="btn-discard-session"
                  onClick={() => setShowDiscardConfirm(true)}
                  className="px-4 py-3 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white text-xs font-bold uppercase rounded-lg transition"
                >
                  Discard
                </button>
              )}
              <button
                id="btn-stop-session"
                onClick={handleStopSession}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow flex items-center gap-2"
              >
                <div className="w-2 h-2 bg-white rounded-sm"></div> Stop & Log Attendance
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid of Stats Cards - SLEEK INTERFACE */}
      <div className="grid grid-cols-1 gap-6" id="dashboard-stats-grid">
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
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-650 shadow-sm flex-shrink-0">
            <Calendar size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Upcoming test */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md" id="stat-card-upcoming-tests">
          <div>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1 font-display">Upcoming Tests</p>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{upcomingExamsCount}</h3>
            {nextExam ? (
              <div className="mt-3 flex items-center text-pink-650 font-semibold text-[10px] gap-1.5 flex-wrap">
                <span className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full inline-block">
                  Next: <span className="font-extrabold">{nextExam.subject}</span> ({formatDate(nextExam.date)})
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-center text-pink-650 font-semibold text-[10px]">
                <span className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full inline-block">
                  No upcoming tests scheduled
                </span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 bg-pink-50 rounded-xl flex items-center justify-center text-pink-600 shadow-sm flex-shrink-0">
            <BookOpen size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Financial Outstanding / Earned */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md" id="stat-card-outstanding-dues">
          <div>
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1 font-display">Outstanding Dues</p>
            <h3 className="text-3xl font-black text-rose-600 tracking-tight">৳{financialStats.due}</h3>
            <p className="text-[10px] text-slate-400 mt-3 font-medium">
              Collected: <span className="text-emerald-700 font-bold">৳{financialStats.received}</span>
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

      {/* Outstanding Warning / Student Bill List - Beautiful Wide Layout */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm" id="widget-pending-payments">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base font-display">Urgent Pending Payments</h3>
            <p className="text-xs text-slate-400">Students with outstanding invoice amounts requiring resolution</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
            <AlertTriangle size={15} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {payments.filter(p => p.dueAmount > 0).length === 0 ? (
            <div className="col-span-full text-center py-10 bg-slate-50 rounded-2xl text-slate-400 space-y-1 border border-slate-100">
              <CheckCircle2 className="mx-auto text-emerald-500" size={30} />
              <p className="text-sm font-semibold text-slate-700 font-display">Perfect Billing Status!</p>
              <p className="text-xs">No pending tuitions require collection currently.</p>
            </div>
          ) : (
            payments.filter(p => p.dueAmount > 0).map(pay => {
              const student = students.find(st => st.id === pay.studentId);
              return (
                <div key={pay.id} className="p-4 bg-rose-50/25 border border-rose-100 rounded-2xl flex items-center justify-between transition hover:bg-rose-50/30 gap-4">
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-905 text-sm text-slate-900 truncate">{student?.name || 'Unknown Student'}</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Billing Period: <span className="font-semibold text-slate-700">{pay.billingPeriod}</span>
                    </p>
                    <span className="text-[10px] font-bold tracking-wide text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full mt-2 inline-block border border-rose-100 font-mono">
                      Pending: ৳{pay.dueAmount} <span className="text-slate-405 font-normal text-slate-400">/ expected: ৳{pay.payableAmount}</span>
                    </span>
                  </div>

                  <div className="text-right flex flex-col items-end shrink-0 select-none">
                    <span className="inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {pay.status}
                    </span>
                    <button 
                      onClick={() => onNavigate('payments')}
                      className="block mt-2.5 text-[9px] font-bold text-rose-600 hover:text-rose-850 transition tracking-wider uppercase hover:underline"
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

      {/* Log Session Attendance Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-slate-800">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Clock className="text-indigo-600" size={18} />
                <h3 className="font-bold text-slate-900 text-base font-display">Log Tuition Attendance</h3>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="p-5 space-y-3.5">
              {logError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-100 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {logError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Session Date</label>
                  <input 
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Course Subject</label>
                  <input 
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={logSubject}
                    onChange={(e) => setLogSubject(e.target.value)}
                    required
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Entry Time</label>
                  <input 
                    type="text"
                    placeholder="HH:MM"
                    value={logEntryAt}
                    onChange={(e) => setLogEntryAt(e.target.value)}
                    required
                    className="w-full text-xs font-mono font-semibold p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none text-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Exit Time</label>
                  <input 
                    type="text"
                    placeholder="HH:MM"
                    value={logExitAt}
                    onChange={(e) => setLogExitAt(e.target.value)}
                    required
                    className="w-full text-xs font-mono font-semibold p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none text-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hours (Dec)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={logDuration}
                    onChange={(e) => setLogDuration(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tuition Remarks / Notes</label>
                <textarea 
                  rows={2}
                  placeholder="What chapters or topics were completed?"
                  value={logRemarks}
                  onChange={(e) => setLogRemarks(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-250 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold uppercase transition focus:outline-none"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1.5 shadow-sm focus:outline-none"
                >
                  <Save size={13} /> Log Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-in custom Toast container for live session landmarks */}
      {activeAlert && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 border border-slate-800 text-white p-4.5 rounded-2xl shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75 bg-rose-500"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-400">Class Alert Triggered</p>
            </div>
            <button 
              onClick={() => setActiveAlert(null)}
              className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
              title="Close notification"
            >
              <X size={13} />
            </button>
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-100">{activeAlert.title}</h4>
            <p className="text-xs text-slate-400 mt-1">{activeAlert.body}</p>
          </div>
        </div>
      )}

    </div>
  );
}
