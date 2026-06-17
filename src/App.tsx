import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from './store';
import { 
  Users, Calendar, Clock, DollarSign, CloudLightning, ShieldCheck, ShieldAlert, KeyRound, Bell, Settings, LogOut, CheckCircle, Unlock, Smartphone, Monitor, ChevronRight, Menu, X, NotebookText, HelpCircle, LogIn, RotateCcw, Cloud, GraduationCap,
  Mail, UserPlus, Sparkles, Lock, ArrowLeft
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentModule from './components/StudentModule';
import ScheduleModule from './components/ScheduleModule';
import AttendanceModule from './components/AttendanceModule';
import PaymentModule from './components/PaymentModule';
import ExamsModule from './components/ExamsModule';
import SettingsModule from './components/SettingsModule';
import { initializeFirebase, signInWithGoogle, logOutFromFirebase, signInWithEmail, signUpWithEmail, signInAnonymouslyFromFirebase } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const { 
    settings, notifications, students, schedules, attendance, payments, examSchedules, examRecords,
    markNotificationRead, clearNotifications, triggerManualSync, undoLocalChange,
    currentUser, setCurrentUser
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'schedules' | 'attendance' | 'payments' | 'exams' | 'settings'>('dashboard');
  const [devicePreviewMode, setDevicePreviewMode] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pinEntry, setPinEntry] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [showSyncCenter, setShowSyncCenter] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Auth synchronization states
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [proceedAsOffline, setProceedAsOffline] = useState<boolean>(() => {
    return localStorage.getItem('tutortrack_guest_sandbox') === 'true';
  });

  // Local auth form credentials and states
  const [authMode, setAuthMode] = useState<'options' | 'email'>('options');
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authFormError, setAuthFormError] = useState<string>('');

  // Alarm clock ticking tracking state
  const [currentTimeState, setCurrentTimeState] = useState<string>('');

  // Setup reactive auth state listener
  useEffect(() => {
    const instances = initializeFirebase(settings.firebaseConfig);
    if (instances && instances.auth) {
      const unsubscribe = onAuthStateChanged(instances.auth, (user) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
      });
      return unsubscribe;
    } else {
      setIsAuthLoading(false);
    }
  }, [settings.firebaseConfig, setCurrentUser]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeState(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync automatically when the internet connection is restored
  useEffect(() => {
    const handleOnline = () => {
      triggerManualSync().catch(err => console.error("On-line auto sync failed:", err));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [triggerManualSync]);

  // Categorize unsynced changes action-wise (Create, Update, Delete)
  const unsyncedChanges = useMemo(() => {
    const list: Array<{
      id: string;
      collectionName: 'students' | 'schedules' | 'attendance' | 'payments' | 'examSchedules' | 'examRecords';
      type: 'create' | 'update' | 'delete';
      label: string;
      sublabel: string;
    }> = [];

    // 1. DELETED records (tracked in settings.deletedRecords)
    const deletes = settings.deletedRecords || [];
    deletes.forEach(del => {
      let label = `${del.collectionName.slice(0, -1).toUpperCase()} Deleted`;
      let sublabel = `ID: ${del.id}`;

      if (del.snapshot) {
        if (del.collectionName === 'students') {
          label = `Student: ${del.snapshot.name}`;
          sublabel = `Deleted Class ${del.snapshot.class}`;
        } else if (del.collectionName === 'schedules') {
          label = `Class Slot: ${del.snapshot.subject}`;
          sublabel = `Deleted ${del.snapshot.weekday} at ${del.snapshot.startTime}`;
        } else if (del.collectionName === 'attendance') {
          label = `Attendance Log: ${del.snapshot.date}`;
          sublabel = `Deleted ${del.snapshot.duration} hr slot`;
        } else if (del.collectionName === 'payments') {
          label = `Invoice: ${del.snapshot.billingPeriod}`;
          sublabel = `Deleted payment ledger item`;
        } else if (del.collectionName === 'examSchedules') {
          label = `Exam Schedule: ${del.snapshot.subject}`;
          sublabel = `Deleted exam on ${del.snapshot.date}`;
        } else if (del.collectionName === 'examRecords') {
          label = `Grade Record: ${del.snapshot.subject}`;
          sublabel = `Deleted grading logs`;
        }
      }

      list.push({
        id: del.id,
        collectionName: del.collectionName,
        type: 'delete',
        label,
        sublabel
      });
    });

    // 2. STUDENTS Pending (Created or Updated)
    students.forEach((s) => {
      if (s.syncStatus === 'pending') {
        const isCreated = s.createdAt === s.updatedAt || !s.previousState;
        list.push({
          id: s.id,
          collectionName: 'students',
          type: isCreated ? 'create' : 'update',
          label: `Student: ${s.name}`,
          sublabel: isCreated ? `New student registration` : `Updated student profile`
        });
      }
    });

    // 3. SCHEDULES Pending
    schedules.forEach((sc) => {
      if (sc.syncStatus === 'pending') {
        const isCreated = sc.createdAt === sc.updatedAt || !sc.previousState;
        const stud = students.find(s => s.id === sc.studentId);
        list.push({
          id: sc.id,
          collectionName: 'schedules',
          type: isCreated ? 'create' : 'update',
          label: `Class Details: ${sc.subject} (${stud ? stud.name : 'Active student'})`,
          sublabel: isCreated ? `New slot: ${sc.weekday}s` : `Rescheduled class time`
        });
      }
    });

    // 4. ATTENDANCE Pending
    attendance.forEach((at) => {
      if (at.syncStatus === 'pending') {
        const isCreated = at.createdAt === at.updatedAt || !at.previousState;
        const stud = students.find(s => s.id === at.studentId);
        list.push({
          id: at.id,
          collectionName: 'attendance',
          type: isCreated ? 'create' : 'update',
          label: `Attendance Log: ${stud ? stud.name : 'Active student'}`,
          sublabel: isCreated ? `Logged ${at.duration} hr slot on ${at.date}` : `Updated entry/exit timing`
        });
      }
    });

    // 5. PAYMENTS Pending
    payments.forEach((p) => {
      if (p.syncStatus === 'pending') {
        const isCreated = p.createdAt === p.updatedAt || !p.previousState;
        const stud = students.find(s => s.id === p.studentId);
        list.push({
          id: p.id,
          collectionName: 'payments',
          type: isCreated ? 'create' : 'update',
          label: `Invoice Period: ${p.billingPeriod} (${stud ? stud.name : 'Active student'})`,
          sublabel: isCreated ? `Generated default billing cycle` : `Adjusted payment values`
        });
      }
    });

    // 6. EXAM SCHEDULES Pending
    examSchedules.forEach((ex) => {
      if (ex.syncStatus === 'pending') {
        const isCreated = ex.createdAt === ex.updatedAt || !ex.previousState;
        const stud = students.find(s => s.id === ex.studentId);
        list.push({
          id: ex.id,
          collectionName: 'examSchedules',
          type: isCreated ? 'create' : 'update',
          label: `Exam Scheduled: ${ex.subject} (${stud ? stud.name : 'Pupil'})`,
          sublabel: isCreated ? `New upcoming slot on ${ex.date}` : `Updated exam schedule details`
        });
      }
    });

    // 7. EXAM RECORDS Pending
    examRecords.forEach((er) => {
      if (er.syncStatus === 'pending') {
        const isCreated = er.createdAt === er.updatedAt || !er.previousState;
        const stud = students.find(s => s.id === er.studentId);
        list.push({
          id: er.id,
          collectionName: 'examRecords',
          type: isCreated ? 'create' : 'update',
          label: `Exam Result Log: ${er.subject} (${stud ? stud.name : 'Pupil'})`,
          sublabel: isCreated ? `Recorded score of ${er.marksObtained}/${er.totalMarks}` : `Corrected result score`
        });
      }
    });

    return list;
  }, [students, schedules, attendance, payments, examSchedules, examRecords, settings.deletedRecords]);

  const totalPendingSyncs = unsyncedChanges.length;

  // Lock code on starts if PIN Lock is globally enabled in setup
  useEffect(() => {
    if (settings.pinLockEnabled && settings.pinCode) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [settings.pinLockEnabled]);

  // Handle Security Verification unlock triggers
  const handleNumpadPress = (num: string) => {
    if (pinEntry.length < 4) {
      const newEntry = pinEntry + num;
      setPinEntry(newEntry);
      setPinError('');

      // Auto-submit on 4th digit
      if (newEntry.length === 4) {
        if (newEntry === settings.pinCode) {
          setIsLocked(false);
          setPinEntry('');
        } else {
          setPinError('Incorrect security credentials pin. Try again.');
          setPinEntry('');
        }
      }
    }
  };

  const handleClearPinEntry = () => {
    setPinEntry('');
    setPinError('');
  };

  // Notification center helper
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Helper title mapping
  const currentTabTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'Dashboard & Reports';
      case 'students': return 'Student Directory';
      case 'schedules': return 'Tuition Planner';
      case 'attendance': return 'Attendance Log Register';
      case 'payments': return 'Payments & Receipts';
      case 'exams': return 'Exams & Progress Reports';
      case 'settings': return 'System Preferences';
      default: return 'TutorTrack';
    }
  };

  // Nav item list container
  const navItems = [
    { id: 'dashboard', label: 'Tutor Dashboard', icon: NotebookText },
    { id: 'students', label: 'Student Directory', icon: Users, badge: students.length },
    { id: 'schedules', label: 'Weekly Planner', icon: Calendar, badge: schedules.length },
    { id: 'attendance', label: 'Attendance Logs', icon: Clock },
    { id: 'payments', label: 'Payments Register', icon: DollarSign },
    { id: 'exams', label: 'Exams & Reports', icon: GraduationCap, badge: examSchedules.length },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  // Screen switching module
  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={(tab: any) => setActiveTab(tab)} />;
      case 'students': return <StudentModule />;
      case 'schedules': return <ScheduleModule />;
      case 'attendance': return <AttendanceModule />;
      case 'payments': return <PaymentModule />;
      case 'exams': return <ExamsModule />;
      case 'settings': return <SettingsModule />;
      default: return <Dashboard onNavigate={(tab: any) => setActiveTab(tab)} />;
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Initializing Secure Auth Layer...</p>
        </div>
      </div>
    );
  }

  if (!currentUser && !proceedAsOffline) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans text-slate-800">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-[32px] p-6 space-y-6 shadow-xl relative overflow-hidden">
          
          {/* Header branding block */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-100 text-white font-black text-xl font-display">
              TT
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black font-display tracking-tight text-slate-900">TutorTrack Secure Login</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">Access your personalized pupil database, weekly schedules, and financial registers from any device.</p>
            </div>
          </div>

          {authFormError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-[11px] font-bold leading-normal space-y-1">
              <p className="flex items-center gap-1.5"><ShieldAlert size={14} className="shrink-0" /> Error Details</p>
              <p className="font-normal text-slate-600">{authFormError}</p>
            </div>
          )}

          {authMode === 'options' ? (
            <div className="space-y-3.5">
              {/* Google Sign In Option */}
              <button
                onClick={async () => {
                  try {
                    setAuthFormError('');
                    await signInWithGoogle(settings.firebaseConfig);
                  } catch (err: any) {
                    const msg = err?.message || String(err);
                    setAuthFormError(`Google Sign-In failed/blocked. Since third-party cookies or popups are often restricted in sandbox sandboxes, try using the "Email/Password" or "Instant Cloud" buttons instead. Code: ${msg}`);
                  }
                }}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition active:scale-98"
              >
                <LogIn size={14} />
                Sign In securely with Google
              </button>

              {/* Email authentication trigger */}
              <button
                onClick={() => {
                  setAuthFormError('');
                  setAuthMode('email');
                }}
                className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                <Mail size={14} className="text-slate-500" />
                Sign In or Register with Email
              </button>

              {/* Instant Guest backend login */}
              <button
                onClick={async () => {
                  try {
                    setAuthFormError('');
                    await signInAnonymouslyFromFirebase(settings.firebaseConfig);
                  } catch (err: any) {
                    setAuthFormError(`Anonymous authentication layer failed: ${err?.message || String(err)}. Make sure Anonymous Sign-in is enabled in your Firebase console settings.`);
                  }
                }}
                className="w-full py-3 px-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                <Sparkles size={14} className="text-indigo-500" />
                Instant Cloud Sync Access (Anonymous)
              </button>

              <div className="relative py-1 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <span className="relative bg-white px-3 text-[9px] uppercase font-bold tracking-widest text-slate-400">or offline alternative</span>
              </div>

              {/* Local fallback options */}
              <button
                onClick={() => {
                  localStorage.setItem('tutortrack_guest_sandbox', 'true');
                  setProceedAsOffline(true);
                }}
                className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98"
              >
                Enter Temporary Offline Sandbox
              </button>
            </div>
          ) : (
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthFormError('');
                if (!emailInput || !passwordInput) {
                  setAuthFormError('Email and Password inputs are required.');
                  return;
                }
                if (passwordInput.length < 6) {
                  setAuthFormError('Security safeguard: Password must be at least 6 characters.');
                  return;
                }
                try {
                  if (isSignUp) {
                    await signUpWithEmail(emailInput, passwordInput, settings.firebaseConfig);
                  } else {
                    await signInWithEmail(emailInput, passwordInput, settings.firebaseConfig);
                  }
                } catch (err: any) {
                  let errorText = err?.message || String(err);
                  if (errorText.includes('auth/invalid-credential') || errorText.includes('auth/user-not-found') || errorText.includes('auth/wrong-password')) {
                    errorText = 'Incorrect credentials. Please verify your details or toggle registration mode if this is your first time.';
                  } else if (errorText.includes('auth/email-already-in-use')) {
                    errorText = 'Email address is already registered. Switch to Sign In mode to access this database.';
                  }
                  setAuthFormError(errorText);
                }
              }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthFormError('');
                    setAuthMode('options');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthFormError('');
                    setIsSignUp(!isSignUp);
                  }}
                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 underline transition"
                >
                  {isSignUp ? 'Switch to Sign In' : 'Create new account'}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="teacher@tutortrack.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                    <Mail size={13} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Password</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                    <Lock size={13} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-indigo-100"
              >
                {isSignUp ? <UserPlus size={14} /> : <LogIn size={14} />}
                {isSignUp ? 'Create Secure Account' : 'Sign In Securely'}
              </button>
            </form>
          )}

          <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-[9.5px] text-slate-500 leading-normal space-y-1">
            <p className="font-extrabold uppercase text-slate-705 text-slate-700 tracking-wide">🔐 Security Information</p>
            <p>Cloud synchronization utilizes isolated customer sandbox namespaces. Pure guest sandbox is retained in standard safe browser storage parameters on your local terminal.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-sans text-white">
        <div className="w-full max-w-sm bg-slate-800/80 border border-slate-700/65 rounded-[32px] p-6 text-center space-y-6 shadow-2xl backdrop-blur-md">
          
          <div className="space-y-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <KeyRound size={28} />
            </div>
            <h2 className="text-xl font-black font-display tracking-tight text-white mt-3">TutorTrack Secure</h2>
            <p className="text-xs text-slate-400">Tuition database locked. Enter your 4-digit security PIN to proceed.</p>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-3.5 py-2">
            {[0, 1, 2, 3].map((dotIndex) => (
              <div 
                key={dotIndex} 
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pinEntry.length > dotIndex 
                    ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-indigo-500/50 shadow-md' 
                    : 'bg-slate-700 border-slate-600'
                }`}
              />
            ))}
          </div>

          {pinError && (
            <p className="text-xs font-bold text-red-400 bg-red-500/10 py-1.5 px-3 rounded-lg border border-red-500/20">
              ⚠️ {pinError}
            </p>
          )}

          {/* Simulated Numpad */}
          <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumpadPress(num)}
                className="w-16 h-16 bg-slate-700 hover:bg-slate-600 text-lg font-bold rounded-2xl flex items-center justify-center transition active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearPinEntry}
              className="w-16 h-16 bg-transparent text-slate-400 hover:text-white text-xs font-bold rounded-2xl flex items-center justify-center"
            >
              CLEAR
            </button>
            <button
              type="button"
              onClick={() => handleNumpadPress('0')}
              className="w-16 h-16 bg-slate-700 hover:bg-slate-600 text-lg font-bold rounded-2xl flex items-center justify-center transition active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                // Pin lock bypass safety hint
                alert(`Pin Lock Bypass Hint: Your active pin code configured is: ${settings.pinCode || 'None setup yet'}`);
              }}
              className="w-16 h-16 bg-transparent text-indigo-400 hover:text-indigo-300 text-[10px] font-bold rounded-2xl flex flex-col items-center justify-center leading-none"
            >
              <HelpCircle size={14} className="mb-1" /> BYPASS
            </button>
          </div>

          <div className="text-[10px] text-slate-500">
            * TutorTrack database remain safely isolated & encrypted locally.
          </div>
        </div>
      </div>
    );
  }

  // STANDARD APPLICATION WORKSPACE FRAMEWORK
  const ApplicationMainContent = () => (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION - SLEEK INTERFACE */}
      <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-30 shadow-none h-16 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 lg:hidden"
            id="mobile-nav-toggle-btn"
          >
            <Menu size={20} />
          </button>
          
          <div>
            <h1 className="text-base font-bold text-slate-805 tracking-tight leading-none flex items-center gap-1.5 font-display" id="tab-title-header">
              {currentTabTitle()}
            </h1>
            <p className="text-[9px] text-slate-400 font-mono tracking-wider mt-1 uppercase" id="current-hour-clock">
              Hour: {currentTimeState || '14:58:32 PM'}
            </p>
          </div>
        </div>

        {/* Diagnostic System Widgets */}
        <div className="flex items-center gap-5">
          {/* Profile block matching the design HTML */}
          <div className="flex items-center gap-3 hidden sm:flex" id="tutor-profile-widget">
            {currentUser ? (
              <>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">{currentUser.displayName || currentUser.email || 'Dr. Sarah Mitchell'}</p>
                  <p className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-tighter">● CLOUD SYNC ACTIVE</p>
                </div>
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="avatar" 
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border border-slate-200 shadow-sm object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-100 border border-slate-200 shadow-sm flex items-center justify-center text-[10px] font-extrabold text-indigo-700">
                    {currentUser.displayName ? currentUser.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'SM'}
                  </div>
                )}
                <button
                  onClick={async () => {
                    try {
                      await logOutFromFirebase(settings.firebaseConfig);
                    } catch (e: any) {
                      alert(e?.message || 'Error logging out');
                    }
                  }}
                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 rounded-lg border transition-all"
                  title="Sign Out from Cloud"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">Guest Tutor</p>
                  <p className="text-[9px] text-amber-600 font-extrabold uppercase tracking-tighter">● OFFLINE LOCAL MODE</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center text-[10px] font-extrabold text-slate-500 animate-pulse">
                  GT
                </div>
                <button
                  onClick={async () => {
                    try {
                      await signInWithGoogle(settings.firebaseConfig);
                    } catch (e: any) {
                      alert(`Login closed: ${e?.message || String(e)}`);
                    }
                  }}
                  className="p-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all"
                  title="Sign In with Google"
                >
                  Sign In
                </button>
              </>
            )}
          </div>

          <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>

          {/* Emulator Frame Toggler */}
          <button
            onClick={() => setDevicePreviewMode(!devicePreviewMode)}
            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition shadow-none flex items-center gap-1.5"
            title="Toggle compact mobile mockup emulator"
            id="viewport-toggle-btn"
          >
            {devicePreviewMode ? <Monitor size={14} /> : <Smartphone size={14} />}
            <span className="text-[9px] uppercase font-bold tracking-wider hidden lg:inline">
              {devicePreviewMode ? 'Desk Mode' : 'Mobile Preview'}
            </span>
          </button>

                    {/* Notification Button */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotificationCenter(!showNotificationCenter);
                setShowSyncCenter(false);
              }}
              className="p-1.5 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50 transition shadow-none"
              id="notifications-indicator-bell"
            >
              <Bell size={14} />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadCount}
                </div>
              )}
            </button>
 
            {/* Notification drop-down panel dropdown list */}
            {showNotificationCenter && (
              <div className="absolute right-0 mt-3 bg-white border border-slate-200 w-80 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-400 pb-2">
                  <span className="text-xs font-extrabold text-slate-805 uppercase tracking-wider">Alert Center ({unreadCount})</span>
                  <div className="flex gap-2">
                    <button onClick={clearNotifications} className="text-[9px] font-bold text-rose-600 hover:underline">Clear logs</button>
                    <button onClick={() => setShowNotificationCenter(false)} className="text-[9px] font-bold text-slate-600 hover:underline">Close</button>
                  </div>
                </div>
 
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No new tutor notifications recorded.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                          n.read ? 'bg-slate-50 border-slate-100 opacity-70' : 'bg-indigo-50/50 border-indigo-100'
                        }`}
                      >
                        <div className="flex justify-between font-bold text-slate-800 text-[11px]">
                          <span>{n.title}</span>
                          <span className="text-[9px] font-medium text-slate-400">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sync Button */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowSyncCenter(!showSyncCenter);
                setShowNotificationCenter(false);
              }}
              className={`p-1.5 border rounded-xl hover:bg-slate-50 transition shadow-none relative ${
                showSyncCenter ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              id="firebase-sync-trigger-btn"
              title="Local Pending Database Syncs"
            >
              <CloudLightning size={14} className={settings.isSyncing ? "animate-bounce" : ""} />
              {totalPendingSyncs > 0 && (
                <div className="absolute -top-1 -right-1 bg-amber-600 text-white font-extrabold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                  {totalPendingSyncs}
                </div>
              )}
            </button>

            {/* Sync dropdown panel containing action wise pending changes & manual triggers */}
            {showSyncCenter && (
              <div 
                className="absolute right-0 mt-3 bg-white border border-slate-200 w-85 sm:w-96 rounded-2xl shadow-xl z-50 p-4 space-y-3.5 animate-in fade-in duration-150"
                id="sync-logs-popup-container"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Cloud className="text-slate-500" size={15} />
                    <span className="text-xs font-extrabold text-slate-850 uppercase tracking-wider">Sync Control Queue</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-black uppercase py-0.5 px-2 bg-amber-100 text-amber-850 rounded-full">
                      {totalPendingSyncs} Pending
                    </span>
                    <button 
                      onClick={() => setShowSyncCenter(false)} 
                      className="text-[9px] font-bold text-slate-500 hover:underline"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {unsyncedChanges.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 space-y-2">
                      <div className="mx-auto w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                        <CheckCircle size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-600">Sync Pipeline Up-to-Date!</p>
                      <p className="text-[10px] text-slate-500">All local changes are fully persistent on Cloud Firestore.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pb-1">Un-synchronized Action Logs</p>
                      {unsyncedChanges.map((item) => {
                        let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                        let actionLabel = 'Create';
                        if (item.type === 'update') {
                          badgeBg = 'bg-blue-50 text-blue-700 border-blue-100';
                          actionLabel = 'Update';
                        } else if (item.type === 'delete') {
                          badgeBg = 'bg-rose-50 text-rose-700 border-rose-100';
                          actionLabel = 'Delete';
                        }

                        return (
                          <div 
                            key={`${item.collectionName}-${item.type}-${item.id}`}
                            className="bg-slate-50/60 hover:bg-slate-50 border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-3 transition"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${badgeBg}`}>
                                  {actionLabel}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {item.collectionName}
                                </span>
                              </div>
                              <h5 className="font-extrabold text-slate-800 text-[11px] mt-1 truncate">{item.label}</h5>
                              <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">{item.sublabel}</p>
                            </div>

                            <button
                              onClick={() => {
                                undoLocalChange(item.collectionName, item.id, item.type);
                              }}
                              className="py-1.5 px-2 bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-500 font-bold text-[9px] uppercase tracking-wider rounded-lg transition shrink-0 flex items-center gap-1 shadow-sm"
                              title="Revert change locally"
                            >
                              <RotateCcw size={9} />
                              Undo
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    disabled={settings.isSyncing || totalPendingSyncs === 0}
                    onClick={async () => {
                      try {
                        await triggerManualSync();
                      } catch (e: any) {
                        alert(`Replication failure: ${e?.message || String(e)}`);
                      }
                    }}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition shadow flex items-center justify-center gap-2 select-none disabled:opacity-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                  >
                    <CloudLightning size={12} className={settings.isSyncing ? "animate-spin" : ""} />
                    {settings.isSyncing ? 'Synchronizing Cloud...' : 'Sync Pending Items Now'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Lock/Logout */}
          {settings.pinLockEnabled && (
            <button 
              onClick={() => setIsLocked(true)}
              className="p-1.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-800 transition"
              title="Lock database dashboard"
              id="portal-lock-btn"
            >
              <LogOut size={14} />
            </button>
          )}

        </div>
      </header>

      {/* CORE DISPLAY WINDOW VIEW */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
        {renderActiveScreen()}
      </main>

    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-x-hidden text-slate-800">
      
      {/* MOBILE NAV CONTAINER SLIDERS - SLEEK INTERFACE */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white text-slate-800 p-6 justify-between animate-in slide-in-from-left duration-250 border-r border-slate-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow shadow-indigo-100">
                    TT
                  </div>
                  <span className="text-base font-bold font-display tracking-tight text-slate-800">TutorTrack <span className="text-indigo-600 text-xs ml-0.5 font-medium">Pro</span></span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 p-1 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5 pt-2">
                {navItems.map(item => {
                  const IconComponent = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                        isSelected 
                          ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <IconComponent size={15} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-550'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-6 mt-auto border-t border-slate-100">
              {currentUser ? (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border">
                  <div className="flex items-center gap-2 min-w-0">
                    {currentUser.photoURL ? (
                      <img src={currentUser.photoURL} alt="avatar" className="w-8 h-8 rounded-full border shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 font-display">
                        {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold text-slate-800 truncate leading-tight">{currentUser.displayName || currentUser.email}</p>
                      <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wide">Sync Connected</p>
                    </div>
                  </div>
                  <button
                    onClick={() => logOutFromFirebase(settings.firebaseConfig)}
                    className="p-1 px-1.5 bg-slate-200 hover:bg-slate-300 text-[9px] font-bold text-slate-650 text-slate-700 rounded border shrink-0"
                  >
                    Out
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 p-3 rounded-xl border text-center space-y-2">
                  <p className="text-[10px] text-slate-500 font-medium leading-none">Running in Offline sandbox mode</p>
                  <button
                    onClick={() => signInWithGoogle(settings.firebaseConfig)}
                    className="w-full py-1.5 bg-indigo-650 bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg text-[9px] font-extrabold transition-all"
                  >
                    Sync to Google Cloud
                  </button>
                </div>
              )}

              <div className="text-[10px] text-slate-400 font-medium leading-none">
                Personal Tuition Management System
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR VIEW - SLEEK INTERFACE */}
      <aside className="hidden lg:flex w-64 bg-white text-slate-805 p-5 flex-col justify-between shrink-0 border-r border-slate-200">
        <div className="space-y-6">
          
          {/* Logo & Banner - Sleek Interface style */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <NotebookText size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <span className="text-base font-bold font-display tracking-tight text-slate-805 block">TutorTrack <span className="text-indigo-605 font-bold text-[10px] uppercase tracking-wider ml-0.5">Pro</span></span>
              <span className="text-[9px] text-slate-400 font-bold tracking-widest block uppercase">Tuition Log OS</span>
            </div>
          </div>

          <div className="px-2 pt-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest font-display">Management</div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const IconComponent = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative group ${
                    isSelected 
                      ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <IconComponent size={15} className={`transition ${isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                    {item.label}
                  </span>
                  
                  {item.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

        </div>

        {/* Footer offline storage indicator block exactly matching design HTML */}
        <div className="space-y-4 border-t border-slate-100 pt-5">
          
          <div className="p-4 bg-slate-900 rounded-xl text-white">
            <p className="text-[10px] font-bold text-indigo-400 mb-1 tracking-wider uppercase">Offline Persistence</p>
            <div className="w-full bg-slate-700 h-1 rounded-full mb-2">
              <div className="bg-indigo-500 h-full w-[100%] rounded-full"></div>
            </div>
            <p className="text-[10px] opacity-70 text-slate-300">Local Engine: {students.length + schedules.length + attendance.length + payments.length} cached records</p>
          </div>

          <div className="space-y-1.5">
            {currentUser && (
              <div className="bg-emerald-50/50 border border-emerald-100 p-2 text-[10px] text-emerald-800 rounded-xl flex items-center gap-2 mb-2 font-medium">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="a" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-5 h-5 bg-emerald-250 text-emerald-800 font-bold flex items-center justify-center rounded-full text-[8px]">U</div>
                )}
                <div className="min-w-0 select-none">
                  <p className="font-extrabold truncate leading-tight">{currentUser.displayName}</p>
                  <p className="text-[8px] opacity-75">Cloud Synced Profile</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">
                {currentUser ? 'Cloud Backup Linked' : 'Offline Sandbox'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {settings.pinLockEnabled ? (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              )}
              <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">
                {settings.pinLockEnabled ? 'PIN lock active' : 'no pin lock set'}
              </span>
            </div>

            {!currentUser && (
              <button
                onClick={() => {
                  localStorage.removeItem('tutortrack_guest_sandbox');
                  setProceedAsOffline(false);
                }}
                className="text-[9.5px] text-indigo-650 hover:text-indigo-750 text-indigo-600 font-extrabold uppercase block select-none"
              >
                🔐 Open Sign In Portal
              </button>
            )}
          </div>

          <div className="text-[9px] text-slate-400 font-medium leading-none">
            TutorTrack © 2026. Cloud Backup Sync.
          </div>
        </div>
      </aside>

      {/* DYNAMIC VIEWPORTS DISPLAY */}
      {devicePreviewMode ? (
        
        // INTERACTIVE LAPTOP PREVIEW WITH PHONE EMULATOR SHELL
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 bg-slate-950 gap-6 animate-in fade-in duration-200">
          
          {/* Main workspace control options details info */}
          <div className="text-white max-w-sm space-y-4 lg:pr-4">
            <span className="text-[10px] bg-indigo-900 text-indigo-200 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Mobile UI Sandbox</span>
            <h2 className="text-2xl font-extrabold font-display leading-tight">Interactive Mobile Emulator Simulator</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Experience TutorTrack as a fully functional, offline-first React Native Android application. Click any dashboard metrics, log daily students, and slide through database tables smoothly!
            </p>

            <button
              onClick={() => setDevicePreviewMode(false)}
              className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow transition"
            >
              Return to standard desktop workspace
            </button>
          </div>

          {/* Core Interactive Device Emulator Panel */}
          <div className="w-full max-w-[395px] h-[785px] bg-slate-900 border-[10px] border-slate-800 rounded-[50px] shadow-2xl overflow-hidden relative ring-4 ring-slate-800 flex flex-col">
            
            {/* Native Mobile Status Bar Display mock */}
            <div className="bg-white px-6 pt-3 pb-1 flex justify-between items-center text-[10px] font-bold text-slate-700 z-40 relative select-none">
              <span>9:41 AM</span>
              {/* Phone ear-piece camera notch */}
              <div className="w-20 h-4 bg-slate-950 rounded-full absolute left-1/2 transform -translate-x-1/2 top-0" />
              <div className="flex gap-1.5 items-center">
                <span className="text-[9px] bg-emerald-100 p-0.5 px-1 text-emerald-800 rounded">LTE</span>
                <div className="w-5 h-2.5 bg-slate-800 rounded-sm p-0.5"><div className="w-full h-full bg-emerald-500 rounded-xs" /></div>
              </div>
            </div>

            {/* Mobile Nav Top tab bar switcher inside preview */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 overflow-x-hidden p-4">
              {renderActiveScreen()}
            </div>

            {/* Simulated Android/iOS home bar or action navigation bar */}
            <div className="bg-white border-t border-slate-100 p-3 h-16 flex items-center justify-around z-40 text-slate-500 shrink-0">
              {navItems.slice(0, 5).map(item => {
                const IconComponent = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => setActiveTab(item.id as any)}
                    className={`flex flex-col items-center justify-center gap-0.5 font-bold ${
                      isSelected ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <IconComponent size={16} />
                    <span className="text-[9px] leading-tight capitalize">{item.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      ) : (
        // Standard high-efficiency full-desktop system view
        ApplicationMainContent()
      )}

    </div>
  );
}
