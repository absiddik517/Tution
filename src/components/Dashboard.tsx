import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { 
  Users, Calendar, Clock, DollarSign, ArrowUpRight, AlertTriangle, CheckCircle2, TrendingUp, BookOpen, Clock3, Save, X, Play, Square, Volume2, CloudLightning
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { playSoundPreset } from '../sound';
import { formatDate, formatTime } from '../formatUtils';

export default function Dashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { students, schedules, attendance, payments, examSchedules, examRecords, addAttendance, addNotification, settings, triggerManualSync, updateSchedule } = useStore();
  const { theme, presetName, presetKey, darkMode } = useTheme();

  // YYYY-MM-DD local date format for clean daily self-resets
  const todayStr = useMemo(() => {
    const localDate = new Date();
    const localY = localDate.getFullYear();
    const localM = String(localDate.getMonth() + 1).padStart(2, '0');
    const localD = String(localDate.getDate()).padStart(2, '0');
    return `${localY}-${localM}-${localD}`;
  }, []);

  // Derive active session from global synced schedules state
  const runningSchedule = useMemo(() => {
    return schedules.find(sc => sc.sessionDate === todayStr && sc.sessionStatus === 'running');
  }, [schedules, todayStr]);

  const sessionActive = !!runningSchedule;
  const startedAt = runningSchedule?.sessionStartedAt || null;

  // Local state for dropdown select box (when session is idle)
  const [dropdownStudentId, setDropdownStudentId] = useState('');
  const selectedStudentId = sessionActive ? (runningSchedule?.studentId || '') : dropdownStudentId;

  // Function to let dropdown selectors work properly
  const setSelectedStudentId = (id: string) => {
    if (!sessionActive) {
      setDropdownStudentId(id);
    }
  };

  const [timerSeconds, setTimerSeconds] = useState(0);
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

  const updateScheduleSessionStatus = (scheduleId: string, status: 'idle' | 'running' | 'completed') => {
    if (status === 'running') {
      // Mark other running schedules to idle
      schedules.forEach(sc => {
        if (sc.sessionStatus === 'running' && sc.id !== scheduleId) {
          updateSchedule(sc.id, { sessionStatus: 'idle', sessionStartedAt: undefined });
        }
      });
    }

    updateSchedule(scheduleId, {
      sessionStatus: status,
      sessionDate: todayStr,
      sessionStartedAt: status === 'running' ? new Date().toISOString() : undefined
    });
  };

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

    checkAndNotify(m1, m1 * 60, 1); 
    checkAndNotify(m2, m2 * 60, 2); 
    checkAndNotify(m3, m3 * 60, 3); 

  }, [timerSeconds, sessionActive, selectedStudentId, students, addNotification, m1, m2, m3]);

  const handleStartSession = () => {
    const studentId = dropdownStudentId;
    if (!studentId) return;
    
    // Find matched today class first
    let matchedSchedule = todayClasses.find(cl => cl.studentId === studentId);
    if (!matchedSchedule) {
      // Find any schedule of this student as container to store status in cloud
      const studentSchedules = schedules.filter(sc => sc.studentId === studentId);
      matchedSchedule = studentSchedules[0];
    }

    if (matchedSchedule) {
      updateScheduleSessionStatus(matchedSchedule.id, 'running');
    } else {
      alert(`No schedule slots found for this student. Please add at least one class schedule to log live sessions.`);
    }
  };

  const handleStartSessionForStudent = (studentId: string, scheduleId?: string) => {
    let targetScheduleId = scheduleId;
    if (!targetScheduleId) {
      let matchedSchedule = todayClasses.find(cl => cl.studentId === studentId);
      if (!matchedSchedule) {
        const studentSchedules = schedules.filter(sc => sc.studentId === studentId);
        matchedSchedule = studentSchedules[0];
      }
      targetScheduleId = matchedSchedule?.id;
    }

    if (targetScheduleId) {
      updateScheduleSessionStatus(targetScheduleId, 'running');
    } else {
      alert(`No schedule slots found for this student. Please add at least one class schedule to log live sessions.`);
    }
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
    if (runningSchedule) {
      updateScheduleSessionStatus(runningSchedule.id, 'idle');
    }
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

    if (runningSchedule) {
      updateScheduleSessionStatus(runningSchedule.id, 'completed');
    }

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
    return schedules
      .filter(sc => {
        const student = students.find(s => s.id === sc.studentId);
        return sc.weekday === todayName && student?.status === 'Active';
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
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
    <div className={`space-y-6 ${theme.textMain}`} id="dashboard-tab">
      {/* Today's Class Schedule card replacing Welcome Back banner */}
      <div className={`${theme.bgCard} border ${theme.borderMain} p-6 rounded-3xl shadow-sm`} id="widget-today-schedule">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className={`font-extrabold ${theme.textTitle} text-lg font-display`}>Today's Class Schedule</h3>
            <p className={`text-xs ${theme.textMuted}`}>Class slots mapped for this 24-hour cycle ({todayName})</p>
          </div>
          <span className={`px-2.5 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-full border ${theme.badgeAccent}`}>
            {todayClasses.length} Scheduled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {todayClasses.length === 0 ? (
            <div className={`col-span-full text-center py-8 ${theme.bgCardElevated} rounded-2xl ${theme.textMuted} space-y-2 border ${theme.borderMuted}`}>
              <CheckCircle2 className="mx-auto text-emerald-500 animate-bounce" size={32} />
              <p className={`text-sm font-semibold ${theme.textTitle}`}>Clear calendar today!</p>
              <p className="text-xs">No active tuition sessions assigned for today.</p>
            </div>
          ) : (
            todayClasses.map((cl, idx) => {
              const student = students.find(s => s.id === cl.studentId);
              // Dynamic borders based on active theme preset
              const borderColors = [
                `border-l-${presetKey}-500 bg-slate-50 dark:bg-slate-850/50`, 
                'border-l-emerald-500 bg-slate-50 dark:bg-slate-850/50', 
                'border-l-amber-500 bg-slate-50 dark:bg-slate-850/50'
              ];
              const cardColorClass = borderColors[idx % borderColors.length];
              const isStatusToday = cl.sessionDate === todayStr;
              const sessionStatus = isStatusToday ? (cl.sessionStatus || 'idle') : 'idle';
              
              return (
                <div key={cl.id} className={`p-4 rounded-2xl border ${theme.borderMain} border-l-4 hover:border-slate-400 dark:hover:border-slate-750 transition flex items-center justify-between gap-3 ${cardColorClass}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 ${theme.bgCard} border ${theme.borderMain} rounded-xl flex items-center justify-center font-black text-sm ${theme.textAccent} shadow-sm shrink-0 font-display`}>
                      {student?.name.charAt(0) || 'S'}
                    </div>
                    <div className="min-w-0">
                      <h4 className={`font-bold text-sm ${theme.textTitle} truncate`}>{student?.name}</h4>
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        <BookOpen size={12} className={`${theme.textMuted} shrink-0`} />
                        <span className="truncate">{cl.subject} <span className={`${theme.textMuted} font-normal`}>• {student?.class}</span></span>
                      </div>
                      
                      {/* Exam Schedule Info Line */}
                      {(() => {
                        const studentExams = examSchedules.filter(ex => ex.studentId === cl.studentId);
                        const todayStrUTC = new Date().toISOString().split('T')[0];
                        const localDate = new Date();
                        const localY = localDate.getFullYear();
                        const localM = String(localDate.getMonth() + 1).padStart(2, '0');
                        const localD = String(localDate.getDate()).padStart(2, '0');
                        const todayStrLocal = `${localY}-${localM}-${localD}`;

                        const todayExam = studentExams.find(ex => ex.date === todayStrUTC || ex.date === todayStrLocal);
                        const targetExam = todayExam;
                        
                        return (
                          <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${targetExam ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-700'} shrink-0`} />
                            <span className={`${targetExam ? 'text-pink-500 font-semibold' : theme.textMuted} truncate`}>
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

                      <p className={`text-[10px] ${theme.textAccent} mt-1 font-extrabold flex items-center gap-1 font-mono`}>
                        ⏰ {formatTime(cl.startTime)} - {formatTime(cl.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center justify-center">
                    {sessionStatus === 'idle' && (
                      <button 
                        onClick={() => handleStartSessionForStudent(cl.studentId, cl.id)}
                        className={`p-2.5 ${theme.btnPrimary} rounded-full transition hover:scale-110 active:scale-95 shadow-md flex items-center justify-center`}
                        title="Start Tuition Session"
                      >
                        <Play size={13} className="fill-white translate-x-[1px] text-white" />
                      </button>
                    )}

                    {sessionStatus === 'running' && (
                      <button 
                        onClick={handleStopSession}
                        className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition hover:scale-110 active:scale-95 shadow-md flex items-center justify-center animate-pulse"
                        title="Stop & Log Session"
                      >
                        <Square size={13} className="fill-white stroke-white text-white" />
                      </button>
                    )}

                    {sessionStatus === 'completed' && (
                      <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-150 dark:border-emerald-900/40 px-2.5 py-1 rounded-xl animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-widest font-mono leading-none">done!</span>
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
      <div className={`${theme.bgCard} border ${theme.borderMain} p-6 rounded-2xl shadow-sm space-y-4`} id="widget-live-session-tracker">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${sessionActive ? 'bg-red-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
            <h3 className={`font-bold ${theme.textTitle} text-sm tracking-wide uppercase flex items-center gap-1.5 font-display`}>
              <span className={`text-[10px] py-0.5 px-2 rounded-md font-semibold ${theme.badgeAccent}`}>Active Tracker</span> Live Tuition Session Trigger
            </h3>
          </div>
          {sessionActive && (
            <span className="text-xs font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-900/35 flex items-center gap-1.5 self-start sm:self-auto">
              <Clock3 size={13} className="animate-spin text-rose-500" /> ELAPSED: {formatTimer(timerSeconds)}
            </span>
          )}
        </div>

        {!sessionActive ? (
          <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 ${theme.bgCardElevated} p-4 rounded-xl`}>
            <div className="flex-1 space-y-1">
              <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>Choose local student and begin stopwatch session</span>
              <select
                id="session-student-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className={`w-full text-xs font-semibold p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${theme.textMain}`}
              >
                <option value="" className={`${theme.bgCard} ${theme.textMain}`}>-- Select active student --</option>
                {activeStudentsList.map(s => (
                  <option key={s.id} value={s.id} className={`${theme.bgCard} ${theme.textMain}`}>{s.name} ({s.class})</option>
                ))}
              </select>
            </div>
            
            <button
              id="btn-start-session"
              onClick={handleStartSession}
              disabled={!selectedStudentId}
              className={`px-5 py-3.5 ${theme.btnPrimary} font-bold text-xs uppercase tracking-wider rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 self-stretch sm:self-end shadow-sm`}
            >
              <div className="w-2.5 h-2.5 bg-white rounded-full"></div> Start Tuition Session
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-rose-50/20 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/40 p-4 rounded-xl">
            <div className="flex-1">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">In Session Counter active</span>
              <p className={`text-sm font-bold ${theme.textTitle} mt-1`}>
                Student: <span className={`${theme.textAccent} font-black`}>{students.find(s => s.id === selectedStudentId)?.name}</span>
              </p>
              <p className={`text-xs ${theme.textMuted} mt-1`}>
                Started on {new Date(startedAt || '').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}. Duration tracks automatically.
              </p>
              
              <div className="flex flex-wrap items-center gap-2 mt-3 select-none">
                <span className={`text-[10px] font-bold uppercase ${theme.textMuted} tracking-wider`}>Milestone:</span>
                <button 
                  onClick={() => triggerMilestoneSound(1)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 hover:scale-105 active:scale-95 ${
                    timerSeconds >= m1 * 60 ? `${theme.badgeAccent} border-rose-200 dark:border-rose-900 animate-pulse` : `${theme.bgCardElevated} ${theme.borderMain} ${theme.textMuted}`
                  }`}
                  title={`Preview ${m1}-Min Crystal Chime`}
                >
                  <span>{timerSeconds >= m1 * 60 ? '✓' : '○'} {m1}m</span>
                  <Volume2 size={10} className={`${theme.textMuted} shrink-0`} />
                </button>
                <button 
                  onClick={() => triggerMilestoneSound(2)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 hover:scale-105 active:scale-95 ${
                    timerSeconds >= m2 * 60 ? `${theme.badgeAccent} border-rose-200 dark:border-rose-900 animate-pulse` : `${theme.bgCardElevated} ${theme.borderMain} ${theme.textMuted}`
                  }`}
                  title={`Preview ${m2}-Min Dual Chime`}
                >
                  <span>{timerSeconds >= m2 * 60 ? '✓' : '○'} {m2}m</span>
                  <Volume2 size={10} className={`${theme.textMuted} shrink-0`} />
                </button>
                <button 
                  onClick={() => triggerMilestoneSound(3)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition flex items-center gap-1 hover:scale-105 active:scale-95 ${
                    timerSeconds >= m3 * 60 ? `${theme.badgeAccent} border-rose-200 dark:border-rose-900 animate-pulse` : `${theme.bgCardElevated} ${theme.borderMain} ${theme.textMuted}`
                  }`}
                  title={`Preview ${m3}-Min Warning Chime`}
                >
                  <span>{timerSeconds >= m3 * 60 ? '✓' : '○'} {m3}m</span>
                  <Volume2 size={10} className={`${theme.textMuted} shrink-0`} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-center sm:self-auto">
              {showDiscardConfirm ? (
                <div className={`flex items-center gap-2 border ${theme.borderMain} ${theme.bgCardElevated} px-3 py-2.5 rounded-xl animate-in fade-in duration-250`}>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-extrabold uppercase tracking-wider">Discard session?</span>
                  <button
                    onClick={handleDiscardSession}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase rounded-lg transition shadow-sm"
                    id="btn-confirm-discard-session"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDiscardConfirm(false)}
                    className={`px-3 py-1.5 border ${theme.borderMain} ${theme.textMuted} hover:bg-white dark:hover:bg-slate-800 text-[10px] font-bold uppercase rounded-lg transition`}
                    id="btn-cancel-discard-session"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  id="btn-discard-session"
                  onClick={() => setShowDiscardConfirm(true)}
                  className={`px-4 py-3 border ${theme.borderMain} ${theme.textMuted} hover:text-slate-850 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 text-xs font-bold uppercase rounded-lg transition`}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="dashboard-stats-grid">
        {/* Total & Active Students */}
        <div className={`${theme.bgCard} p-5 rounded-2xl border ${theme.borderMain} shadow-sm flex items-center justify-between transition hover:shadow-md`} id="stat-card-active-students">
          <div>
            <p className={`${theme.textMuted} text-[11px] font-bold uppercase tracking-wider mb-1 font-display`}>Active Students</p>
            <h3 className={`text-3xl font-black ${theme.textTitle} tracking-tight`}>{activeStudents} <span className="text-xs text-slate-400 font-normal">/ {totalStudents}</span></h3>
            <div className="mt-3 flex items-center text-emerald-600 font-bold text-[10px]">
              <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-750 dark:text-emerald-300 px-2 py-0.5 rounded-full inline-block">
                +3 this month
              </span>
            </div>
          </div>
          <div className={`w-12 h-12 ${theme.badgeAccent} rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
            <Users size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Today's Schedule count */}
        <div className={`${theme.bgCard} p-5 rounded-2xl border ${theme.borderMain} shadow-sm flex items-center justify-between transition hover:shadow-md`} id="stat-card-today-sessions">
          <div>
            <p className={`${theme.textMuted} text-[11px] font-bold uppercase tracking-wider mb-1 font-display`}>Today's Sessions</p>
            <h3 className={`text-3xl font-black ${theme.textTitle} tracking-tight`}>{todayClasses.length}</h3>
            <div className="mt-3 flex items-center text-indigo-650 font-bold text-[10px]">
              <span className={`px-2 py-0.5 rounded-full inline-block ${theme.badgeAccent}`}>
                {todayName} list
              </span>
            </div>
          </div>
          <div className={`w-12 h-12 bg-emerald-50 dark:bg-emerald-950/55 text-emerald-650 dark:text-emerald-300 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
            <Calendar size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Upcoming test */}
        <div className={`${theme.bgCard} p-5 rounded-2xl border ${theme.borderMain} shadow-sm flex items-center justify-between transition hover:shadow-md`} id="stat-card-upcoming-tests">
          <div>
            <p className={`${theme.textMuted} text-[11px] font-bold uppercase tracking-wider mb-1 font-display`}>Upcoming Tests</p>
            <h3 className={`text-3xl font-black ${theme.textTitle} tracking-tight`}>{upcomingExamsCount}</h3>
            {nextExam ? (
              <div className="mt-3 flex items-center font-semibold text-[10px] gap-1.5 flex-wrap">
                <span className="bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full inline-block">
                  Next: <span className="font-extrabold">{nextExam.subject}</span> ({formatDate(nextExam.date)})
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-center font-semibold text-[10px]">
                <span className="bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full inline-block">
                  No upcoming tests scheduled
                </span>
              </div>
            )}
          </div>
          <div className="w-12 h-12 bg-pink-50 dark:bg-pink-950/60 rounded-xl flex items-center justify-center text-pink-600 dark:text-pink-400 shadow-sm flex-shrink-0">
            <BookOpen size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Financial Outstanding / Earned */}
        <div className={`${theme.bgCard} p-5 rounded-2xl border ${theme.borderMain} shadow-sm flex items-center justify-between transition hover:shadow-md`} id="stat-card-outstanding-dues">
          <div>
            <p className={`${theme.textMuted} text-[11px] font-bold uppercase tracking-wider mb-1 font-display`}>Outstanding Dues</p>
            <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">৳{financialStats.due}</h3>
            <p className={`text-[10px] ${theme.textMuted} mt-3 font-medium`}>
              Collected: <span className="text-emerald-500 font-bold">৳{financialStats.received}</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/60 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-sm flex-shrink-0">
            <DollarSign size={22} className="stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* DESIGN MOCKUPS FOR DATA ANALYTICS IN TUTORTRACK PRO */}
      {(() => {
        // Dynamic Hex Colors for Recharts styling based on active theme preset
        const chartColors = {
          indigo: { primary: '#6366f1', secondary: '#818cf8', stroke: '#c7d2fe' },
          emerald: { primary: '#10b981', secondary: '#34d399', stroke: '#a7f3d0' },
          rose: { primary: '#f43f5e', secondary: '#fb7185', stroke: '#fecdd3' },
          amber: { primary: '#f59e0b', secondary: '#fbbf24', stroke: '#fde68a' },
          violet: { primary: '#8b5cf6', secondary: '#a78bfa', stroke: '#ddd6fe' },
          blue: { primary: '#3b82f6', secondary: '#60a5fa', stroke: '#bfdbfe' },
        }[presetKey] || { primary: '#6366f1', secondary: '#818cf8', stroke: '#c7d2fe' };

        // 1. Bar Chart: Monthly Earnings
        const monthlyEarningsData = [
          { month: 'Jan', Expected: 12000, Collected: 10000 },
          { month: 'Feb', Expected: 15000, Collected: 13500 },
          { month: 'Mar', Expected: 18000, Collected: 15000 },
          { month: 'Apr', Expected: 16000, Collected: 16000 },
          { month: 'May', Expected: 20000, Collected: 17500 },
          { month: 'Jun', Expected: 24000, Collected: 21000 },
        ];

        // Overlay with actual payments data if available
        if (payments.length > 0) {
          const realGrouped: Record<string, { expected: number; collected: number }> = {};
          payments.forEach(p => {
            const mName = p.billingPeriod.split(' ')[0].substring(0, 3);
            if (!realGrouped[mName]) {
              realGrouped[mName] = { expected: 0, collected: 0 };
            }
            realGrouped[mName].expected += p.payableAmount;
            realGrouped[mName].collected += p.paidAmount;
          });

          monthlyEarningsData.forEach(d => {
            if (realGrouped[d.month]) {
              d.Expected = realGrouped[d.month].expected;
              d.Collected = realGrouped[d.month].collected;
            }
          });
        }

        // 2. Pie Chart: Student Attendance Distribution
        let presentCount = 0;
        let lateCount = 0;
        let excusedCount = 0;
        let absentCount = 0;

        if (attendance.length > 0) {
          attendance.forEach(at => {
            const remLower = at.remarks.toLowerCase();
            if (remLower.includes('late')) lateCount++;
            else if (remLower.includes('excused') || remLower.includes('sick')) excusedCount++;
            else if (remLower.includes('absent') || remLower.includes('no show')) absentCount++;
            else presentCount++;
          });
        }

        const attendancePieData = attendance.length > 0 && (presentCount + lateCount + excusedCount + absentCount > 0) ? [
          { name: 'On-Time Present', value: presentCount },
          { name: 'Late Arrival', value: lateCount },
          { name: 'Excused Leave', value: excusedCount },
          { name: 'Unexcused Absent', value: absentCount }
        ].filter(v => v.value > 0) : [
          { name: 'On-Time Present', value: 75 },
          { name: 'Late Arrival', value: 15 },
          { name: 'Excused Leave', value: 7 },
          { name: 'Unexcused Absent', value: 3 },
        ];

        const PIE_COLORS = [
          chartColors.primary,
          chartColors.secondary,
          darkMode ? '#334155' : '#94a3b8',
          '#ef4444'
        ];

        // 3. Line Chart: Academic Performance Trends
        const academicTrendData = [
          { exam: 'Unit Assessment I', AverageScore: 74 },
          { exam: 'Pop Quiz algebra', AverageScore: 78 },
          { exam: 'Term 1 Midterm', AverageScore: 82 },
          { exam: 'Periodic Assessment', AverageScore: 80 },
          { exam: 'Practice Exam II', AverageScore: 87 },
          { exam: 'Mock Test Finals', AverageScore: 91 },
        ];

        if (examRecords.length > 0) {
          const sortedExams = [...examRecords].sort((a, b) => a.date.localeCompare(b.date));
          const groupedExams: Record<string, { total: number; obtained: number; label: string }> = {};
          
          sortedExams.forEach(er => {
            const key = er.subject + '-' + er.topic;
            if (!groupedExams[key]) {
              groupedExams[key] = { total: 0, obtained: 0, label: er.topic || er.subject };
            }
            groupedExams[key].total += er.totalMarks;
            groupedExams[key].obtained += er.marksObtained;
          });

          const customMapped = Object.values(groupedExams).map(grp => ({
            exam: grp.label.length > 18 ? grp.label.substring(0, 15) + '...' : grp.label,
            AverageScore: grp.total > 0 ? Math.round((grp.obtained / grp.total) * 100) : 0
          }));

          if (customMapped.length >= 2) {
            academicTrendData.splice(0, academicTrendData.length, ...customMapped);
          }
        }

        // Adaptive color configurations for Recharts elements to secure high contrast ratios
        const axisColor = darkMode ? '#94a3b8' : '#64748b';
        const gridColor = darkMode ? '#1e293b' : '#f1f5f9';
        const tooltipBg = darkMode ? '#0f172a' : '#ffffff';
        const tooltipBorder = darkMode ? '#1e293b' : '#e2e8f0';
        const tooltipText = darkMode ? '#f1f5f9' : '#0f172a';

        return (
          <div className={`${theme.bgCard} border ${theme.borderMain} p-6 rounded-3xl shadow-sm space-y-6`} id="dashboard-analytics-section">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dashed pb-5 border-slate-200 dark:border-slate-800">
              <div>
                <h3 className={`font-extrabold ${theme.textTitle} text-base font-display flex items-center gap-2`}>
                  <TrendingUp className={theme.textAccent} size={18} />
                  Performance & Financial Analytics
                </h3>
                <p className={`text-xs ${theme.textMuted}`}>Real-time dynamic visual data analytics, with active high-contrast adaptive contrast matching</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${theme.badgeAccent}`}>
                  Theme Preset: {presetName}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700`}>
                  Mode: {darkMode ? '🌙 Eye-safe Dark' : '☀️ High-contrast Light'}
                </span>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Earnings Bar Chart */}
              <div className={`p-4 rounded-2xl border ${theme.borderMain} ${theme.bgCardElevated} flex flex-col space-y-3`}>
                <div>
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${theme.textTitle}`}>Monthly Earnings (৳)</h4>
                  <p className={`text-[10px] ${theme.textMuted}`}>Comparison of expected tuition invoices against actual payments collected</p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyEarningsData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" stroke={axisColor} fontSize={10} tickLine={false} />
                      <YAxis stroke={axisColor} fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', fontSize: '11px', color: tooltipText }}
                        itemStyle={{ color: tooltipText }}
                      />
                      <Bar dataKey="Expected" fill={darkMode ? '#334155' : '#cbd5e1'} radius={[4, 4, 0, 0]} barSize={12} />
                      <Bar dataKey="Collected" fill={chartColors.primary} radius={[4, 4, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-slate-300 dark:bg-slate-700 rounded-sm" />
                    <span className={theme.textMuted}>Expected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: chartColors.primary }} />
                    <span className={theme.textTitle}>Collected</span>
                  </div>
                </div>
              </div>

              {/* Student Attendance Distribution Pie Chart */}
              <div className={`p-4 rounded-2xl border ${theme.borderMain} ${theme.bgCardElevated} flex flex-col space-y-3`}>
                <div>
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${theme.textTitle}`}>Attendance Distribution</h4>
                  <p className={`text-[10px] ${theme.textMuted}`}>Aesthetic percentage distribution representing class log punctuality rates</p>
                </div>
                <div className="h-64 w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={attendancePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {attendancePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', fontSize: '11px', color: tooltipText }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Absolute Center Ratio Display */}
                  <div className="absolute text-center select-none pointer-events-none">
                    <span className={`text-2xl font-black ${theme.textTitle}`}>
                      {attendance.length > 0 
                        ? Math.round((presentCount / attendance.length) * 100) 
                        : 85}%
                    </span>
                    <span className={`block text-[8px] font-black uppercase tracking-widest ${theme.textMuted}`}>On-Time</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold pt-1">
                  {attendancePieData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="truncate text-slate-600 dark:text-slate-400">{item.name} ({item.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Academic Performance Trends Line Chart */}
              <div className={`p-4 rounded-2xl border ${theme.borderMain} ${theme.bgCardElevated} flex flex-col space-y-3`}>
                <div>
                  <h4 className={`text-xs font-extrabold uppercase tracking-wider ${theme.textTitle}`}>Academic Grades progression</h4>
                  <p className={`text-[10px] ${theme.textMuted}`}>Average test percentage obtainment over successive exams</p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={academicTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="exam" stroke={axisColor} fontSize={10} tickLine={false} />
                      <YAxis stroke={axisColor} fontSize={10} domain={[0, 100]} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '12px', fontSize: '11px', color: tooltipText }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="AverageScore" 
                        stroke={chartColors.primary} 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 1, fill: tooltipBg }}
                        activeDot={{ r: 6, strokeWidth: 2, fill: chartColors.primary }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5" style={{ backgroundColor: chartColors.primary }} />
                    <span className={theme.textTitle}>Avg Score (%)</span>
                  </div>
                  <span className="text-[10px] text-emerald-500 font-extrabold">
                    📈 Upward Trend (+17%)
                  </span>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Log Session Attendance Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`${theme.bgCard} rounded-2xl max-w-sm w-full shadow-xl border ${theme.borderMain} overflow-hidden animate-in zoom-in-95 duration-150`}>
            <div className={`p-5 border-b ${theme.borderMuted} flex items-center justify-between ${theme.bgCardElevated}`}>
              <div className="flex items-center gap-2">
                <Clock className={theme.textAccent} size={18} />
                <h3 className={`font-bold ${theme.textTitle} text-base font-display`}>Log Tuition Attendance</h3>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                className={`${theme.textMuted} hover:${theme.textTitle} p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} className="p-5 space-y-3.5">
              {logError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-100 dark:border-red-900/40 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {logError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Session Date</label>
                  <input 
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className={`w-full text-xs font-semibold p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${theme.textMain} font-sans`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Course Subject</label>
                  <input 
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={logSubject}
                    onChange={(e) => setLogSubject(e.target.value)}
                    required
                    className={`w-full text-xs font-semibold p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${theme.textMain}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Entry Time</label>
                  <input 
                    type="text"
                    placeholder="HH:MM"
                    value={logEntryAt}
                    onChange={(e) => setLogEntryAt(e.target.value)}
                    required
                    className={`w-full text-xs font-mono font-semibold p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none ${theme.textMain}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Exit Time</label>
                  <input 
                    type="text"
                    placeholder="HH:MM"
                    value={logExitAt}
                    onChange={(e) => setLogExitAt(e.target.value)}
                    required
                    className={`w-full text-xs font-mono font-semibold p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none ${theme.textMain}`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Hours (Dec)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={logDuration}
                    onChange={(e) => setLogDuration(parseFloat(e.target.value) || 0)}
                    required
                    className={`w-full text-xs font-semibold p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none ${theme.textMain}`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Tuition Remarks / Notes</label>
                <textarea 
                  rows={2}
                  placeholder="What chapters or topics were completed?"
                  value={logRemarks}
                  onChange={(e) => setLogRemarks(e.target.value)}
                  className={`w-full text-xs p-2.5 ${theme.bgInput} border ${theme.borderMain} rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 ${theme.textMain}`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${theme.borderMuted}`}>
                <button 
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className={`px-4 py-2 ${theme.textMuted} hover:${theme.textTitle} text-xs font-bold uppercase transition focus:outline-none`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className={`px-5 py-2.5 ${theme.btnPrimary} text-xs font-bold uppercase tracking-wider rounded-lg transition flex items-center gap-1.5 shadow-sm focus:outline-none`}
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
