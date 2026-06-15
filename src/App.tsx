import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from './store';
import { 
  Users, Calendar, Clock, DollarSign, CloudLightning, ShieldCheck, ShieldAlert, KeyRound, Bell, Settings, LogOut, CheckCircle, Unlock, Smartphone, Monitor, ChevronRight, Menu, X, NotebookText, HelpCircle
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentModule from './components/StudentModule';
import ScheduleModule from './components/ScheduleModule';
import AttendanceModule from './components/AttendanceModule';
import PaymentModule from './components/PaymentModule';
import SettingsModule from './components/SettingsModule';

export default function App() {
  const { 
    settings, notifications, students, schedules, attendance, payments, 
    markNotificationRead, clearNotifications, triggerManualSync 
  } = useStore();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'schedules' | 'attendance' | 'payments' | 'settings'>('dashboard');
  const [devicePreviewMode, setDevicePreviewMode] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pinEntry, setPinEntry] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Alarm clock ticking tracking state
  const [currentTimeState, setCurrentTimeState] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeState(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync state computed pendings
  const totalPendingSyncs = useMemo(() => {
    const s = students.filter(item => item.syncStatus === 'pending').length;
    const c = schedules.filter(item => item.syncStatus === 'pending').length;
    const a = attendance.filter(item => item.syncStatus === 'pending').length;
    const p = payments.filter(item => item.syncStatus === 'pending').length;
    return s + c + a + p;
  }, [students, schedules, attendance, payments]);

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
      case 'settings': return <SettingsModule />;
      default: return <Dashboard onNavigate={(tab: any) => setActiveTab(tab)} />;
    }
  };

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
          {/* Active Cloud Sync block - styled exactly like the design HTML */}
          <div 
            onClick={triggerManualSync}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide border cursor-pointer select-none transition-all hover:scale-102 ${
              totalPendingSyncs > 0 
                ? 'bg-amber-50 border-amber-200 text-amber-700' 
                : 'bg-emerald-50 border-emerald-100 text-emerald-700'
            }`}
            title="Synchronize offline local database changes immediately to Firebase"
            id="cloud-backup-indicator"
          >
            <div className={`w-2 h-2 rounded-full ${totalPendingSyncs > 0 ? 'bg-amber-505 animate-bounce' : 'bg-emerald-500 animate-pulse'}`}></div>
            <span className="hidden sm:inline">
              {totalPendingSyncs > 0 ? `${totalPendingSyncs} Pending Syncs` : 'SYNCED: CLOUD BACKUP ACTIVE'}
            </span>
            <span className="sm:hidden">
              {totalPendingSyncs > 0 ? 'PENDING' : 'SYNCED'}
            </span>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

          {/* Profile block matching the design HTML */}
          <div className="flex items-center gap-3 hidden sm:flex" id="tutor-profile-widget">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900">Dr. Sarah Mitchell</p>
              <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-tighter">Senior Mathematics Tutor</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center text-[10px] font-extrabold text-indigo-700">
              SM
            </div>
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
              onClick={() => setShowNotificationCenter(!showNotificationCenter)}
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
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
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

            <div className="pt-6 border-t border-slate-100 text-xs text-slate-400 font-medium">
              Personal Tuition Management System
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
            <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 overflow-x-hidden">
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
