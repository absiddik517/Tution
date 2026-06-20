import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { 
  CloudRain, ShieldAlert, ShieldCheck, Download, Upload, RotateCcw, CloudLightning, Shield, KeyRound, Monitor, Eye, EyeOff, Save, Trash2, FileSpreadsheet, RefreshCw, Volume2, Bell
} from 'lucide-react';
import { SOUND_PRESETS, playSoundPreset } from '../sound';
import appletConfig from '../../firebase-applet-config.json';

export default function SettingsModule() {
  const { 
    settings, students, schedules, attendance, payments, 
    toggleDarkMode, setPinLock, clearDatabase, triggerManualSync, importData,
    saveFirebaseConfig, triggerFirebasePull, updateLandmarkAlerts
  } = useStore();

  const [pinInput, setPinInput] = useState('');
  const [pinEnabledLocal, setPinEnabledLocal] = useState(settings.pinLockEnabled);
  const [showPinState, setShowPinState] = useState(false);

  // Landmark alert custom threshold states
  const [firstAlert, setFirstAlert] = useState(settings.landmarkFirstAlert ?? 40);
  const [secondAlert, setSecondAlert] = useState(settings.landmarkSecondAlert ?? 60);
  const [thirdAlert, setThirdAlert] = useState(settings.landmarkThirdAlert ?? 80);

  // Sound preset states for alerts
  const [firstSound, setFirstSound] = useState(settings.landmarkFirstSound ?? 'crystal');
  const [secondSound, setSecondSound] = useState(settings.landmarkSecondSound ?? 'double');
  const [thirdSound, setThirdSound] = useState(settings.landmarkThirdSound ?? 'triple');

  // Local OS Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'not-supported'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'not-supported';
  });

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        let permission: NotificationPermission;
        try {
          // Modern standard
          permission = await Notification.requestPermission();
        } catch (e) {
          // Callback-based fallback for older browsers & certain webviews
          permission = await new Promise<NotificationPermission>((resolve) => {
            Notification.requestPermission(resolve);
          });
        }
        
        setNotificationPermission(permission);
        if (permission === 'granted') {
          new Notification('Notifications Enabled! 🔔', {
            body: 'You will now receive operating-system level notices on your device.',
          });
        }
      } catch (err: any) {
        alert('Permission request failed: ' + (err?.message || err));
      }
    } else {
      alert('Local device notifications are not supported by this browser/wrapper environment.');
    }
  };

  const testOSNotification = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('TutorTrack Live Notification 🔔', {
        body: 'Success! Operating-system level notifications are active on your device.',
      });
    }
  };

  // Firebase Config Form State
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [apiKey, setApiKey] = useState(settings.firebaseConfig?.apiKey || appletConfig.apiKey);
  const [projectId, setProjectId] = useState(settings.firebaseConfig?.projectId || appletConfig.projectId);
  const [authDomain, setAuthDomain] = useState(settings.firebaseConfig?.authDomain || appletConfig.authDomain);
  const [storageBucket, setStorageBucket] = useState(settings.firebaseConfig?.storageBucket || appletConfig.storageBucket);
  const [messagingSenderId, setMessagingSenderId] = useState(settings.firebaseConfig?.messagingSenderId || appletConfig.messagingSenderId);
  const [appId, setAppId] = useState(settings.firebaseConfig?.appId || appletConfig.appId);
  const [dbId, setDbId] = useState(settings.firebaseConfig?.firestoreDatabaseId || (appletConfig as any).firestoreDatabaseId || '(default)');
  const [measurementIdState, setMeasurementIdState] = useState(settings.firebaseConfig?.measurementId || (appletConfig as any).measurementId || '');
  const [syncPulling, setSyncPulling] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId) {
      alert('API Key and Project ID are required to establish a secure database link.');
      return;
    }
    saveFirebaseConfig({
      apiKey,
      projectId,
      authDomain,
      storageBucket,
      messagingSenderId,
      appId,
      firestoreDatabaseId: dbId || '(default)',
      measurementId: measurementIdState
    });
    alert('Firebase Cloud synchronization parameters saved successfully.');
    setShowConfigForm(false);
  };

  const handlePullFromFirebase = async () => {
    if (!settings.firebaseConfig?.apiKey || !settings.firebaseConfig?.projectId) {
      alert('Please save your Firebase Web App configuration credentials first.');
      return;
    }
    if (confirm('Are you sure you want to pull from the cloud? This will pull down students, records, and payment logs, overwriting matching local data.')) {
      setSyncPulling(true);
      try {
        const res = await triggerFirebasePull();
        if (res.success) {
          alert('All cloud collections were pulled and synchronized securely with local tables!');
        } else {
          alert(`Failed pulling from Firestore: ${res.error}`);
        }
      } catch (err: any) {
        alert(`Pull Sync failed: ${err?.message || String(err)}`);
      } finally {
        setSyncPulling(false);
      }
    }
  };

  // Compute pending sync changes count
  const pendingCount = useMemo(() => {
    const listS = students.filter(s => s.syncStatus === 'pending').length;
    const listC = schedules.filter(s => s.syncStatus === 'pending').length;
    const listA = attendance.filter(s => s.syncStatus === 'pending').length;
    const listP = payments.filter(s => s.syncStatus === 'pending').length;
    return listS + listC + listA + listP;
  }, [students, schedules, attendance, payments]);

  // Handle Security PIN Save
  const handleSavePin = () => {
    if (pinEnabledLocal && (!pinInput || pinInput.length !== 4 || !/^\d+$/.test(pinInput))) {
      alert('Security PIN must consist of exactly 4 numeric digits.');
      return;
    }
    setPinLock(pinEnabledLocal, pinEnabledLocal ? pinInput : '');
    alert('Security locks updated successfully.');
  };

  const handleSaveLandmarks = () => {
    if (firstAlert <= 0 || secondAlert <= 0 || thirdAlert <= 0) {
      alert('Alert times must be positive integer values.');
      return;
    }
    if (firstAlert >= secondAlert || secondAlert >= thirdAlert) {
      alert('Alert timing order should be successive (1st < 2nd < 3rd milestone).');
      return;
    }
    updateLandmarkAlerts(firstAlert, secondAlert, thirdAlert, firstSound, secondSound, thirdSound);
    alert('Session milestone timing and custom audio triggers saved successfully.');
  };

  // CSV Export utility
  const handleExportCSV = (module: 'students' | 'attendance' | 'payments') => {
    let headers = '';
    let rows = '';
    let fileName = '';

    if (module === 'students') {
      headers = 'Id,Name,Class,Subjects,Phone,PaymentCycle,MonthlySalary,StartDate,Status\n';
      rows = students.map(s => 
        `"${s.id}","${s.name}","${s.class}","${s.subjects.join(' | ')}","${s.phone}","${s.paymentCycle}",${s.monthlySalary},"${s.startDate}","${s.status}"`
      ).join('\n');
      fileName = 'TutorTrack_Students.csv';
    } else if (module === 'attendance') {
      headers = 'Id,StudentId,Date,EntryAt,ExitAt,Duration,Remarks\n';
      rows = attendance.map(a => 
        `"${a.id}","${a.studentId}","${a.date}","${a.entryAt}","${a.exitAt}",${a.duration},"${a.remarks}"`
      ).join('\n');
      fileName = 'TutorTrack_Attendance.csv';
    } else if (module === 'payments') {
      headers = 'Id,StudentId,BillingPeriod,AttendedDays,ExpectedDays,PayableAmount,PaidAmount,DueAmount,PaymentDate,Status\n';
      rows = payments.map(p => 
        `"${p.id}","${p.studentId}","${p.billingPeriod}",${p.attendedDays},${p.expectedDays},${p.payableAmount},${p.paidAmount},${p.dueAmount},"${p.paymentDate}","${p.status}"`
      ).join('\n');
      fileName = 'TutorTrack_Payments.csv';
    }

    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Full Backup Restore
  const handleExportBackupJSON = () => {
    const backupObj = { students, schedules, attendance, payments };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TutorTrack_Offline_Database_Backup.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.students && parsed.schedules && parsed.attendance && parsed.payments) {
          importData(parsed);
          alert('Database restored successfully! All data records migrated.');
        } else {
          alert('Invalid file schema. Backup must contain students, schedules, attendance, and payments arrays.');
        }
      } catch (err) {
        alert('Failed parsing backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6" id="settings-tab">
      
      {/* Header section */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">System Preferences</h2>
        <p className="text-xs text-slate-400">Manage real-time back up status, export reports to CSV, configure biometric security logs, or wipe cache</p>
      </div>

      {/* Grid configuration blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Firebase Synchronization controls */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4 text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div className="flex items-center gap-2">
              <CloudLightning className="text-indigo-600" size={18} />
              <h3 className="font-bold text-slate-800 text-sm font-display">Firebase Backup Sync</h3>
            </div>
            
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-extrabold ${
              pendingCount > 0 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {pendingCount > 0 ? `${pendingCount} Pending` : 'Synced'}
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            All database modifications write to local cache instantly. Config your Firebase Web App credentials below for real-time background replication.
          </p>

          <div className="p-4 bg-slate-50 rounded-2xl space-y-2.5 text-xs font-medium text-slate-600">
            <div className="flex justify-between">
              <span>Cloud Status:</span>
              <span className={`font-bold flex items-center gap-1 ${settings.firebaseConfig?.apiKey ? 'text-emerald-700' : 'text-slate-400'}`}>
                ● {settings.firebaseConfig?.apiKey ? 'Firebase Connected' : 'Local Offline Mode'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Sync Time:</span>
              <span className="text-slate-800 font-bold">{settings.lastBackupTime || 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span>Sync Sessions:</span>
              <span className="text-indigo-600 font-extrabold">{settings.backupSuccessCount} uploads</span>
            </div>

            {pendingCount > 0 && (
              <div className="pt-2.5 border-t border-slate-200 space-y-1.5 mt-2">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">Unsynced Item Breakdown</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 font-sans">
                  <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100/50 flex justify-between items-center">
                    <span>Students:</span>
                    <span className="text-xs text-amber-800">{students.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                  <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100/50 flex justify-between items-center">
                    <span>Schedules:</span>
                    <span className="text-xs text-amber-800">{schedules.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                  <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100/50 flex justify-between items-center">
                    <span>Attendance:</span>
                    <span className="text-xs text-amber-800">{attendance.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                  <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-100/50 flex justify-between items-center">
                    <span>Payments:</span>
                    <span className="text-xs text-amber-800">{payments.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toggle buttons to configure or pull */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowConfigForm(!showConfigForm)}
              className="flex-1 py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
            >
              ⚙️ {showConfigForm ? 'Close Config' : 'Configure keys'}
            </button>
            <button
              onClick={handlePullFromFirebase}
              disabled={syncPulling || !settings.firebaseConfig?.apiKey}
              className="flex-1 py-2 px-3 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-50"
            >
              📥 Pull from cloud
            </button>
          </div>

          {showConfigForm && (
            <form onSubmit={handleSaveConfig} className="bg-slate-50 p-4 rounded-2xl space-y-2.5 border border-slate-100 animate-in slide-in-from-top duration-200">
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block pb-1 border-b border-slate-200">Firebase Credentials</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">API Key *</label>
                  <input 
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full font-mono text-[10px] p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Project ID *</label>
                  <input 
                    type="text"
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="tutortrack-ea6b"
                    className="w-full font-mono text-[10px] p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Auth Domain</label>
                  <input 
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="tutortrack.firebaseapp.com"
                    className="w-full font-mono text-[10px] p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">App ID</label>
                  <input 
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:842:web:6e..."
                    className="w-full font-mono text-[10px] p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Database ID</label>
                  <input 
                    type="text"
                    value={dbId}
                    onChange={(e) => setDbId(e.target.value)}
                    placeholder="(default)"
                    className="w-full font-mono text-[10px] p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Measurement ID</label>
                  <input 
                    type="text"
                    value={measurementIdState}
                    onChange={(e) => setMeasurementIdState(e.target.value)}
                    placeholder="G-XXXXXX"
                    className="w-full font-mono text-[10px] p-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Save size={13} /> Save Credentials
              </button>
            </form>
          )}

          <button
            onClick={triggerManualSync}
            disabled={settings.isSyncing}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow disabled:opacity-75 disabled:cursor-wait"
          >
            {settings.isSyncing ? (
              <>
                <RefreshCw className="animate-spin" size={14} /> Replicating to cloud database...
              </>
            ) : (
              <>
                <CloudLightning size={14} /> Synchronize SQLite to Firebase Now
              </>
            )}
          </button>
        </div>

        {/* Security PIN Lock Setup */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <KeyRound className="text-slate-700" size={18} />
              <h3 className="font-bold text-slate-800 text-sm">Biometric & PIN Lock Setup</h3>
            </div>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Enable local application level PIN code protection to secure sensitive financial ledgers and student contact information.
            </p>

            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Secure PIN Authentication</span>
                <button
                  onClick={() => setPinEnabledLocal(!pinEnabledLocal)}
                  className={`w-11 h-6 rounded-full p-0.5 transition ${pinEnabledLocal ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition ${pinEnabledLocal ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {pinEnabledLocal && (
                <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100 animate-in slide-in-from-top duration-200">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Numeric PIN Code (4 digits)</label>
                  <div className="relative">
                    <input 
                      type={showPinState ? 'text' : 'password'}
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="e.g. 1485"
                      className="w-full text-xs font-bold tracking-widest p-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinState(!showPinState)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPinState ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSavePin}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Save size={13} /> Save Security Profile
          </button>
        </div>

        {/* Session Landmark Alerts card */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Volume2 className="text-indigo-600" size={18} />
              <h3 className="font-bold text-slate-800 text-sm font-display">Session Landmark Alerts</h3>
            </div>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-sans">
              Configure landmark notification triggers (in minutes) for live tuition sessions to track your class durations with distinctive synthesized tones.
            </p>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">1st Alert</label>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    min={1}
                    value={firstAlert}
                    onChange={(e) => setFirstAlert(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full text-xs font-bold p-2.5 pr-7 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-center text-slate-800"
                  />
                  <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">m</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">2nd Alert</label>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    min={1}
                    value={secondAlert}
                    onChange={(e) => setSecondAlert(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full text-xs font-bold p-2.5 pr-7 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-center text-slate-800"
                  />
                  <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">m</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">3rd Alert</label>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    min={1}
                    value={thirdAlert}
                    onChange={(e) => setThirdAlert(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full text-xs font-bold p-2.5 pr-7 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500 text-center text-slate-800"
                  />
                  <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none select-none">m</span>
                </div>
              </div>
            </div>

            {/* Custom sound selectors */}
            <div className="space-y-3 mt-4 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Custom Alarm Tones</label>
              
              {/* 1st Alert sound */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 w-14 shrink-0 font-sans">1st Alert:</label>
                <select
                  value={firstSound}
                  onChange={(e) => {
                    setFirstSound(e.target.value);
                    playSoundPreset(e.target.value);
                  }}
                  className="flex-1 text-xs p-2 border border-slate-200 rounded-xl bg-white text-slate-800 font-bold focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                >
                  {SOUND_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => playSoundPreset(firstSound)}
                  className="p-1 px-1.5 border border-slate-200 hover:border-indigo-350 hover:bg-slate-55 rounded-xl text-indigo-600 transition flex-shrink-0"
                  title="Test Alert Tone"
                >
                  <Volume2 size={13} />
                </button>
              </div>

              {/* 2nd Alert sound */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 w-14 shrink-0 font-sans">2nd Alert:</label>
                <select
                  value={secondSound}
                  onChange={(e) => {
                    setSecondSound(e.target.value);
                    playSoundPreset(e.target.value);
                  }}
                  className="flex-1 text-xs p-2 border border-slate-200 rounded-xl bg-white text-slate-800 font-bold focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                >
                  {SOUND_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => playSoundPreset(secondSound)}
                  className="p-1 px-1.5 border border-slate-200 hover:border-indigo-350 hover:bg-slate-55 rounded-xl text-indigo-600 transition flex-shrink-0"
                  title="Test Alert Tone"
                >
                  <Volume2 size={13} />
                </button>
              </div>

              {/* 3rd Alert sound */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-400 w-14 shrink-0 font-sans">3rd Alert:</label>
                <select
                  value={thirdSound}
                  onChange={(e) => {
                    setThirdSound(e.target.value);
                    playSoundPreset(e.target.value);
                  }}
                  className="flex-1 text-xs p-2 border border-slate-200 rounded-xl bg-white text-slate-800 font-bold focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                >
                  {SOUND_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => playSoundPreset(thirdSound)}
                  className="p-1 px-1.5 border border-slate-200 hover:border-indigo-350 hover:bg-slate-55 rounded-xl text-indigo-600 transition flex-shrink-0"
                  title="Test Alert Tone"
                >
                  <Volume2 size={13} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveLandmarks}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Save size={13} /> Save Landmark Alert Profiles
          </button>
        </div>

        {/* Device OS Notifications card */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Bell className="text-indigo-650" size={18} />
              <h3 className="font-bold text-slate-800 text-sm font-display">Device OS Notifications</h3>
            </div>

            <p className="text-xs text-slate-500 mt-2 leading-relaxed font-sans">
              Enable native operating-system level push alerts directly on your device / APK wrapper when tutor schedules, invoices, or critical system syncs complete.
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-2.5 text-xs font-medium text-slate-600 mt-4 font-mono">
              <div className="flex justify-between items-center font-sans">
                <span>System Support:</span>
                <span className={`font-bold uppercase text-[9.5px] px-2 py-0.5 rounded tracking-wide ${
                  notificationPermission !== 'not-supported' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {notificationPermission !== 'not-supported' ? 'Supported' : 'Unavailable'}
                </span>
              </div>
              <div className="flex justify-between items-center font-sans">
                <span>Current Permission:</span>
                <span className={`font-bold uppercase text-[9.5px] px-2 py-0.5 rounded tracking-wide ${
                  notificationPermission === 'granted' ? 'bg-indigo-100 text-indigo-800' :
                  notificationPermission === 'denied' ? 'bg-rose-100 text-rose-800' :
                  'bg-slate-200 text-slate-600'
                }`}>
                  {notificationPermission === 'not-supported' ? 'Blocked' : notificationPermission}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            {notificationPermission !== 'granted' && notificationPermission !== 'not-supported' && (
              <button
                onClick={requestNotificationPermission}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-705 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Bell size={13} /> Grant OS Permissions
              </button>
            )}
            {notificationPermission === 'granted' && (
              <button
                onClick={testOSNotification}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Bell size={13} /> Send Test Push Notice
              </button>
            )}
            {notificationPermission === 'not-supported' && (
              <p className="text-[10px] text-slate-400 text-center leading-relaxed font-sans">
                Notice: Native alerts require an HTTPS origin or secure PWA/APK wrapper framework to request device triggers.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Document reporting & Data migration controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Export spreadsheet reports CSV */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
            <FileSpreadsheet className="text-emerald-600" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">Spreadsheet CSV Reporting</h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Generate and download individual spreadsheet reports in standard CSV format compatible with Microsoft Excel, Apple Numbers, and Google Sheets.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => handleExportCSV('students')}
              className="py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
            >
              Students CSV
            </button>
            <button
              onClick={() => handleExportCSV('attendance')}
              className="py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
            >
              Attendance CSV
            </button>
            <button
              onClick={() => handleExportCSV('payments')}
              className="py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition"
            >
              Payments CSV
            </button>
          </div>
        </div>

        {/* Database backup restoration */}
        <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
              <Download className="text-indigo-600" size={17} />
              <h3 className="font-bold text-slate-800 text-sm">Manual Migrations & Recovery</h3>
            </div>

            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Export high-fidelity JSON system files for clean manual backup retention, or restore custom exported backups.
            </p>
          </div>

          <div className="flex gap-2 text-xs">
            {/* Export JSON backup button */}
            <button
              onClick={handleExportBackupJSON}
              className="flex-1 py-2.5 border border-indigo-250 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl font-bold text-indigo-700 transition flex items-center justify-center gap-1.5"
            >
              <Download size={13} /> Export JSON
            </button>

            {/* Import JSON file trigger */}
            <label className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl font-semibold text-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload size={13} /> Import JSON
              <input 
                type="file"
                accept=".json"
                onChange={handleImportBackupJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>

      </div>

      {/* Erase cache Warning box */}
      <div className="p-5 bg-red-50/40 border border-red-100 rounded-3xl space-y-3">
        <h4 className="text-xs font-black text-red-800 tracking-wide uppercase flex items-center gap-2">
          <ShieldAlert size={14} className="text-red-700" /> Danger System Zone
        </h4>
        <p className="text-xs text-slate-600 leading-normal">
          Wiping the database deletes all local tables (students, lessons, bills, logs). The local cache will start as a completely fresh, empty dataset. This action is irreversible.
        </p>
        <button
          onClick={() => {
            if (confirm('Permanently wipe the SQLite offline database and restore template initial seeds? This action is irreversible.')) {
              clearDatabase();
            }
          }}
          className="px-4 py-2 text-xs font-bold bg-white text-red-600 hover:text-red-800 border border-red-200 hover:border-red-300 rounded-xl shadow-sm transition"
        >
          Erase local database tables (Wipe clean)
        </button>
      </div>

    </div>
  );
}
