import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { 
  CloudRain, ShieldAlert, ShieldCheck, Download, Upload, RotateCcw, CloudLightning, Shield, KeyRound, Monitor, Eye, EyeOff, Save, Trash2, FileSpreadsheet, RefreshCw, Volume2, Bell, Palette, Sun, Moon,
  Activity, CheckCircle2, AlertTriangle, XCircle, Terminal, Clock, Zap, Database, Server, Square, StopCircle,
  FileJson, Check, X, HardDrive, ArrowDownToLine, ArrowUpFromLine, Layers
} from 'lucide-react';
import { SOUND_PRESETS, playSoundPreset } from '../sound';
import appletConfig from '../../firebase-applet-config.json';
import { useTheme, THEME_PRESETS, ThemePreset } from '../theme';
import { getActiveConfig, isFirebaseConfigured } from '../firebase';

export default function SettingsModule() {
  const { 
    settings, students, schedules, attendance, payments, examSchedules, examRecords,
    toggleDarkMode, setColorTheme, setPinLock, clearDatabase, triggerManualSync, importData, importUnsyncedChanges,
    saveFirebaseConfig, triggerFirebasePull, updateLandmarkAlerts,
    syncProgress, clearSyncLogs, testFirebaseHealth, stopSync
  } = useStore();

  const { theme } = useTheme();

  const [pinInput, setPinInput] = useState('');
  const [pinEnabledLocal, setPinEnabledLocal] = useState(settings.pinLockEnabled);
  const [showPinState, setShowPinState] = useState(false);

  // Diagnostic Ping Testing State
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number; authStatus: string; feedback: string } | null>(null);
  const [showLogConsole, setShowLogConsole] = useState(true);

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

  // Local Database Backup & Import States
  const [isDraggingBackup, setIsDraggingBackup] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPendingPayload, setImportPendingPayload] = useState<any>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importFileSize, setImportFileSize] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importIncludeSettings, setImportIncludeSettings] = useState(true);
  const [importStats, setImportStats] = useState<{
    students: number;
    schedules: number;
    attendance: number;
    payments: number;
    examSchedules: number;
    examRecords: number;
    total: number;
    exportedAt?: string;
    appName?: string;
    version?: string;
  } | null>(null);

  // Unsynced Delta Export & Import States
  const [isDraggingUnsynced, setIsDraggingUnsynced] = useState(false);
  const [importUnsyncedModalOpen, setImportUnsyncedModalOpen] = useState(false);
  const [importUnsyncedPendingPayload, setImportUnsyncedPendingPayload] = useState<any>(null);
  const [importUnsyncedFileName, setImportUnsyncedFileName] = useState('');
  const [importUnsyncedFileSize, setImportUnsyncedFileSize] = useState('');
  const [importUnsyncedStats, setImportUnsyncedStats] = useState<{
    students: number;
    schedules: number;
    attendance: number;
    payments: number;
    examSchedules: number;
    examRecords: number;
    deletions: number;
    total: number;
    exportedAt?: string;
    type?: string;
  } | null>(null);

  const [exportSuccessNotice, setExportSuccessNotice] = useState<string | null>(null);
  const [restoreSuccessNotice, setRestoreSuccessNotice] = useState<string | null>(null);

  // Compute Unsynced / Pending Records in Local Database
  const unsyncedStudents = useMemo(() => students.filter(s => s.syncStatus === 'pending'), [students]);
  const unsyncedSchedules = useMemo(() => schedules.filter(s => s.syncStatus === 'pending'), [schedules]);
  const unsyncedAttendance = useMemo(() => attendance.filter(a => a.syncStatus === 'pending'), [attendance]);
  const unsyncedPayments = useMemo(() => payments.filter(p => p.syncStatus === 'pending'), [payments]);
  const unsyncedExamSchedules = useMemo(() => examSchedules.filter(e => e.syncStatus === 'pending'), [examSchedules]);
  const unsyncedExamRecords = useMemo(() => examRecords.filter(e => e.syncStatus === 'pending'), [examRecords]);
  const unsyncedDeletions = useMemo(() => settings.deletedRecords || [], [settings.deletedRecords]);

  const totalUnsyncedCount = useMemo(() => 
    unsyncedStudents.length + unsyncedSchedules.length + unsyncedAttendance.length + 
    unsyncedPayments.length + unsyncedExamSchedules.length + unsyncedExamRecords.length + 
    unsyncedDeletions.length,
    [unsyncedStudents, unsyncedSchedules, unsyncedAttendance, unsyncedPayments, unsyncedExamSchedules, unsyncedExamRecords, unsyncedDeletions]
  );

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
    const activeConfig = getActiveConfig(settings.firebaseConfig);
    if (!isFirebaseConfigured(activeConfig)) {
      alert('Please configure and save your Firebase Web App credentials first.');
      return;
    }
    if (confirm('Are you sure you want to pull data from Firebase Cloud? This will fetch all collections from the cloud database and synchronize them with your local tables.')) {
      setSyncPulling(true);
      try {
        const res = await triggerFirebasePull();
        if (res.success) {
          alert('✓ All cloud database collections have been successfully pulled and synchronized with local tables!');
        } else if (res.error !== 'Cancelled by user') {
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
  const handleExportCSV = (module: 'students' | 'attendance' | 'payments' | 'exams') => {
    let headers = '';
    let rows = '';
    let fileName = '';

    if (module === 'students') {
      headers = 'Id,Name,Class,Subjects,Phone,PaymentCycle,MonthlySalary,StartDate,Status\n';
      rows = students.map(s => 
        `"${s.id}","${s.name}","${s.class}","${(s.subjects || []).join(' | ')}","${s.phone}","${s.paymentCycle}",${s.monthlySalary},"${s.startDate}","${s.status}"`
      ).join('\n');
      fileName = `TutorTrack_Students_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (module === 'attendance') {
      headers = 'Id,StudentId,Date,EntryAt,ExitAt,Duration,Remarks\n';
      rows = attendance.map(a => 
        `"${a.id}","${a.studentId}","${a.date}","${a.entryAt}","${a.exitAt}",${a.duration},"${a.remarks || ''}"`
      ).join('\n');
      fileName = `TutorTrack_Attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (module === 'payments') {
      headers = 'Id,StudentId,BillingPeriod,AttendedDays,ExpectedDays,PayableAmount,PaidAmount,DueAmount,PaymentDate,Status\n';
      rows = payments.map(p => 
        `"${p.id}","${p.studentId}","${p.billingPeriod}",${p.attendedDays},${p.expectedDays},${p.payableAmount},${p.paidAmount},${p.dueAmount},"${p.paymentDate || ''}","${p.status}"`
      ).join('\n');
      fileName = `TutorTrack_Payments_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (module === 'exams') {
      headers = 'Id,StudentId,Subject,Topic,Date,TotalMarks,MarksObtained,Status,Remarks\n';
      rows = examRecords.map(e => 
        `"${e.id}","${e.studentId}","${e.subject}","${e.topic}","${e.date}",${e.totalMarks},${e.marksObtained},"${e.status}","${e.remarks || ''}"`
      ).join('\n');
      fileName = `TutorTrack_ExamRecords_${new Date().toISOString().slice(0, 10)}.csv`;
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
    URL.revokeObjectURL(url);
  };

  // High-fidelity JSON Full Backup Export
  const handleExportBackupJSON = () => {
    const totalRecords = students.length + schedules.length + attendance.length + payments.length + examSchedules.length + examRecords.length;
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const formattedDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const backupPayload = {
      version: '2.0',
      appName: 'TutorTrack Pro',
      exportedAt: now.toISOString(),
      exportedAtFormatted: formattedDate,
      databaseStats: {
        totalRecords,
        studentsCount: students.length,
        schedulesCount: schedules.length,
        attendanceCount: attendance.length,
        paymentsCount: payments.length,
        examSchedulesCount: examSchedules.length,
        examRecordsCount: examRecords.length
      },
      data: {
        students,
        schedules,
        attendance,
        payments,
        examSchedules,
        examRecords
      },
      settings: {
        darkMode: settings.darkMode,
        themeColor: settings.themeColor,
        pinLockEnabled: settings.pinLockEnabled,
        landmarkFirstAlert: settings.landmarkFirstAlert,
        landmarkSecondAlert: settings.landmarkSecondAlert,
        landmarkThirdAlert: settings.landmarkThirdAlert,
        landmarkFirstSound: settings.landmarkFirstSound,
        landmarkSecondSound: settings.landmarkSecondSound,
        landmarkThirdSound: settings.landmarkThirdSound
      }
    };

    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `TutorTrack_DB_Backup_${dateStr}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const sizeKb = (blob.size / 1024).toFixed(1);
    setExportSuccessNotice(`✓ Backup file generated successfully: "${fileName}" (${totalRecords} items, ${sizeKb} KB)`);
    setTimeout(() => setExportSuccessNotice(null), 6000);
  };

  // Helper to validate and stage imported backup file
  const handleProcessBackupFile = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      alert('Please select a valid .json database backup file.');
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
      : `${(file.size / 1024).toFixed(1)} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Normalize data whether in version 2.0 wrapper (parsed.data) or version 1.0 flat (parsed.students)
        const sourceData = parsed.data || parsed;
        const studentsList = Array.isArray(sourceData.students) ? sourceData.students : [];
        const schedulesList = Array.isArray(sourceData.schedules) ? sourceData.schedules : [];
        const attendanceList = Array.isArray(sourceData.attendance) ? sourceData.attendance : [];
        const paymentsList = Array.isArray(sourceData.payments) ? sourceData.payments : [];
        const examSchedulesList = Array.isArray(sourceData.examSchedules) ? sourceData.examSchedules : [];
        const examRecordsList = Array.isArray(sourceData.examRecords) ? sourceData.examRecords : [];

        const totalItems = studentsList.length + schedulesList.length + attendanceList.length + paymentsList.length + examSchedulesList.length + examRecordsList.length;

        if (totalItems === 0 && !parsed.settings) {
          alert('Invalid backup structure: The selected JSON file contains no recognized TutorTrack database collections.');
          return;
        }

        setImportPendingPayload({
          students: studentsList,
          schedules: schedulesList,
          attendance: attendanceList,
          payments: paymentsList,
          examSchedules: examSchedulesList,
          examRecords: examRecordsList,
          settings: parsed.settings || sourceData.settings
        });

        setImportFileName(file.name);
        setImportFileSize(sizeStr);
        setImportStats({
          students: studentsList.length,
          schedules: schedulesList.length,
          attendance: attendanceList.length,
          payments: paymentsList.length,
          examSchedules: examSchedulesList.length,
          examRecords: examRecordsList.length,
          total: totalItems,
          exportedAt: parsed.exportedAtFormatted || parsed.exportedAt || 'Unknown Date',
          appName: parsed.appName || 'TutorTrack Backup',
          version: parsed.version || '1.0'
        });

        setImportModalOpen(true);
      } catch (err: any) {
        alert('Failed parsing backup JSON file. Error: ' + (err?.message || 'Invalid JSON syntax'));
      }
    };
    reader.readAsText(file);
  };

  const handleImportFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessBackupFile(files[0]);
    }
    e.target.value = '';
  };

  const handleExecuteImport = () => {
    if (!importPendingPayload) return;

    const payloadToImport = {
      ...importPendingPayload,
      settings: importIncludeSettings ? importPendingPayload.settings : undefined
    };

    const res = importData(payloadToImport, importMode);

    setImportModalOpen(false);
    setRestoreSuccessNotice(`✓ Database restored successfully! Loaded ${res.count} total records via ${importMode === 'replace' ? 'Clean Overwrite' : 'Merge'} mode.`);
    setTimeout(() => setRestoreSuccessNotice(null), 8000);
  };

  // High-fidelity Export for Unsynced Local Delta
  const handleExportUnsyncedJSON = () => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const formattedDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const payload = {
      type: 'tutor_track_unsynced_delta',
      version: '2.0',
      appName: 'TutorTrack Pro - Unsynced Delta',
      exportedAt: now.toISOString(),
      exportedAtFormatted: formattedDate,
      summary: {
        totalPendingChanges: totalUnsyncedCount,
        pendingCreationsOrUpdates: totalUnsyncedCount - unsyncedDeletions.length,
        pendingDeletions: unsyncedDeletions.length,
        breakdown: {
          students: unsyncedStudents.length,
          schedules: unsyncedSchedules.length,
          attendance: unsyncedAttendance.length,
          payments: unsyncedPayments.length,
          examSchedules: unsyncedExamSchedules.length,
          examRecords: unsyncedExamRecords.length,
          deletions: unsyncedDeletions.length
        }
      },
      data: {
        students: unsyncedStudents,
        schedules: unsyncedSchedules,
        attendance: unsyncedAttendance,
        payments: unsyncedPayments,
        examSchedules: unsyncedExamSchedules,
        examRecords: unsyncedExamRecords
      },
      deletedRecords: unsyncedDeletions
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `TutorTrack_Unsynced_Delta_${dateStr}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const sizeKb = (blob.size / 1024).toFixed(1);
    setExportSuccessNotice(`✓ Unsynced changes exported successfully: "${fileName}" (${totalUnsyncedCount} pending items, ${sizeKb} KB)`);
    setTimeout(() => setExportSuccessNotice(null), 6000);
  };

  // Helper to validate and stage imported unsynced changes file
  const handleProcessUnsyncedFile = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      alert('Please select a valid .json unsynced delta file.');
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
      : `${(file.size / 1024).toFixed(1)} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const sourceData = parsed.data || parsed;
        const rawStudents = Array.isArray(sourceData.students) ? sourceData.students : [];
        const rawSchedules = Array.isArray(sourceData.schedules) ? sourceData.schedules : [];
        const rawAttendance = Array.isArray(sourceData.attendance) ? sourceData.attendance : [];
        const rawPayments = Array.isArray(sourceData.payments) ? sourceData.payments : [];
        const rawExamSchedules = Array.isArray(sourceData.examSchedules) ? sourceData.examSchedules : [];
        const rawExamRecords = Array.isArray(sourceData.examRecords) ? sourceData.examRecords : [];
        const rawDeletions = Array.isArray(parsed.deletedRecords) 
          ? parsed.deletedRecords 
          : (Array.isArray(sourceData.deletedRecords) ? sourceData.deletedRecords : []);

        const totalItems = rawStudents.length + rawSchedules.length + rawAttendance.length + rawPayments.length + rawExamSchedules.length + rawExamRecords.length + rawDeletions.length;

        if (totalItems === 0) {
          alert('No unsynced pending changes or deletions found in this JSON file.');
          return;
        }

        setImportUnsyncedPendingPayload({
          students: rawStudents,
          schedules: rawSchedules,
          attendance: rawAttendance,
          payments: rawPayments,
          examSchedules: rawExamSchedules,
          examRecords: rawExamRecords,
          deletedRecords: rawDeletions
        });

        setImportUnsyncedFileName(file.name);
        setImportUnsyncedFileSize(sizeStr);
        setImportUnsyncedStats({
          students: rawStudents.length,
          schedules: rawSchedules.length,
          attendance: rawAttendance.length,
          payments: rawPayments.length,
          examSchedules: rawExamSchedules.length,
          examRecords: rawExamRecords.length,
          deletions: rawDeletions.length,
          total: totalItems,
          exportedAt: parsed.exportedAtFormatted || parsed.exportedAt || 'Unknown Date',
          type: parsed.type || 'delta'
        });

        setImportUnsyncedModalOpen(true);
      } catch (err: any) {
        alert('Failed parsing delta JSON file. Error: ' + (err?.message || 'Invalid JSON syntax'));
      }
    };
    reader.readAsText(file);
  };

  const handleImportUnsyncedFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessUnsyncedFile(files[0]);
    }
    e.target.value = '';
  };

  const handleExecuteUnsyncedImport = async (triggerSyncImmediately: boolean = false) => {
    if (!importUnsyncedPendingPayload) return;

    const res = importUnsyncedChanges(importUnsyncedPendingPayload);
    setImportUnsyncedModalOpen(false);

    setRestoreSuccessNotice(`✓ Unsynced changes staged successfully! Staged ${res.appliedCount} record updates and ${res.deletedCount} pending deletions in local database.`);
    setTimeout(() => setRestoreSuccessNotice(null), 8000);

    if (triggerSyncImmediately) {
      setTimeout(() => {
        triggerManualSync().catch(err => console.error("Manual sync after import failed:", err));
      }, 400);
    }
  };

  return (
    <div className="space-y-6" id="settings-tab">
      
      {/* Header section */}
      <div>
        <h2 className={`text-xl font-bold ${theme.textTitle}`}>System Preferences</h2>
        <p className={`text-xs ${theme.textMuted}`}>Manage real-time back up status, export reports to CSV, configure biometric security logs, or wipe cache</p>
      </div>

      {/* Grid configuration blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Appearance & Themes Control Panel */}
        <div className={`p-5 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-4 flex flex-col justify-between text-slate-800 dark:text-slate-200`}>
          <div>
            <div className={`flex items-center gap-2 border-b ${theme.borderMuted} pb-3`}>
              <Palette className={theme.textAccent} size={18} />
              <h3 className={`font-bold ${theme.textTitle} text-sm font-display`}>Appearance & Aesthetic Themes</h3>
            </div>

            <p className={`text-xs ${theme.textMuted} mt-2 leading-relaxed`}>
              Personalize your workspace with responsive color presets and dynamic light/dark theme models.
            </p>

            {/* Dark Mode toggle section */}
            <div className="space-y-3 mt-4">
              <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Theme Model</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { if (settings.darkMode) toggleDarkMode(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    !settings.darkMode
                      ? `${theme.bgAccent} ${theme.borderAccent} ${theme.textAccent}`
                      : `${theme.bgCardElevated} ${theme.borderMain} text-slate-400 hover:text-slate-200`
                  }`}
                >
                  <Sun size={14} /> Light Theme
                </button>
                <button
                  type="button"
                  onClick={() => { if (!settings.darkMode) toggleDarkMode(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settings.darkMode
                      ? `${theme.bgAccent} ${theme.borderAccent} ${theme.textAccent}`
                      : `${theme.bgCardElevated} ${theme.borderMain} text-slate-400 hover:text-white`
                  }`}
                >
                  <Moon size={14} /> Dark Theme
                </button>
              </div>
            </div>

            {/* Theme Preset Picker Section */}
            <div className={`space-y-3 mt-4 pt-4 border-t ${theme.borderMuted}`}>
              <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-wider block`}>Color Presets</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((presetKey) => {
                  const preset = THEME_PRESETS[presetKey];
                  const isActive = settings.themeColor === presetKey || (!settings.themeColor && presetKey === 'indigo');
                  
                  // Color dot mapping
                  const dotColors: Record<ThemePreset, string> = {
                    indigo: 'bg-indigo-500',
                    emerald: 'bg-emerald-500',
                    rose: 'bg-rose-500',
                    amber: 'bg-amber-500',
                    violet: 'bg-violet-500',
                    blue: 'bg-blue-500',
                  };

                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => setColorTheme(presetKey)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                        isActive
                          ? `${theme.bgAccent} ${theme.borderAccent} ${theme.textAccent}`
                          : `${theme.bgCardElevated} ${theme.borderMain} hover:${theme.bgCardHover} ${theme.textMain}`
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 ${dotColors[presetKey]}`} />
                      <span className="truncate">{preset.name.split(' ')[1] || preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={`p-3 ${theme.bgCardElevated} rounded-2xl border ${theme.borderMuted} text-[10px] ${theme.textMuted} text-center`}>
            Active preset: <span className={`font-extrabold ${theme.textAccent}`}>{THEME_PRESETS[settings.themeColor as ThemePreset]?.name || 'Oceanic Indigo'}</span>
          </div>
        </div>

        {/* Firebase Synchronization controls */}
        <div className={`p-5 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-4 ${theme.textMain}`}>
          <div className={`flex items-center justify-between border-b ${theme.borderMuted} pb-3`}>
            <div className="flex items-center gap-2">
              <CloudLightning className={theme.textAccent} size={18} />
              <h3 className={`font-bold ${theme.textTitle} text-sm font-display`}>Firebase Backup Sync</h3>
            </div>
            
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-extrabold ${
              pendingCount > 0 
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-900/50' 
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-900/50'
            }`}>
              {pendingCount > 0 ? `${pendingCount} Pending` : 'Synced'}
            </span>
          </div>

          <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
            All database modifications write to local cache instantly. Config your Firebase Web App credentials below for real-time background replication.
          </p>

          <div className={`p-4 ${theme.bgCardElevated} rounded-2xl space-y-2.5 text-xs font-medium ${theme.textMain} border ${theme.borderMuted}`}>
            <div className="flex justify-between">
              <span>Cloud Status:</span>
              <span className={`font-bold flex items-center gap-1 ${settings.firebaseConfig?.apiKey ? 'text-emerald-600 dark:text-emerald-400' : theme.textMuted}`}>
                ● {settings.firebaseConfig?.apiKey ? 'Firebase Connected' : 'Local Offline Mode'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Sync Time:</span>
              <span className={`${theme.textTitle} font-bold`}>{settings.lastBackupTime || 'Never'}</span>
            </div>
            <div className="flex justify-between">
              <span>Sync Sessions:</span>
              <span className={`${theme.textAccent} font-extrabold`}>{settings.backupSuccessCount} uploads</span>
            </div>

            {pendingCount > 0 && (
              <div className={`pt-2.5 border-t ${theme.borderMuted} space-y-1.5 mt-2`}>
                <div className={`text-[9px] font-bold ${theme.textMuted} uppercase tracking-widest mb-1.5 font-sans`}>Unsynced Item Breakdown</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-bold font-sans">
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex justify-between items-center text-amber-700 dark:text-amber-400">
                    <span>Students:</span>
                    <span className="text-xs font-extrabold">{students.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex justify-between items-center text-amber-700 dark:text-amber-400">
                    <span>Schedules:</span>
                    <span className="text-xs font-extrabold">{schedules.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex justify-between items-center text-amber-700 dark:text-amber-400">
                    <span>Attendance:</span>
                    <span className="text-xs font-extrabold">{attendance.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex justify-between items-center text-amber-700 dark:text-amber-400">
                    <span>Payments:</span>
                    <span className="text-xs font-extrabold">{payments.filter(s => s.syncStatus === 'pending').length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* REAL-TIME PROGRESS BAR & STAGE INDICATOR */}
          {(syncProgress.isSyncing || settings.isSyncing) && (
            <div className={`p-4 ${theme.bgCardElevated} rounded-2xl border ${theme.borderAccent} shadow-sm space-y-3 animate-in fade-in duration-200`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className={`animate-spin ${theme.textAccent}`} size={16} />
                  <span className={`text-xs font-bold ${theme.textTitle}`}>{syncProgress.stage || 'Replicating...'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${theme.bgAccent} ${theme.textAccent}`}>
                    {syncProgress.percent}%
                  </span>
                  <button
                    type="button"
                    onClick={stopSync}
                    className="py-1 px-2.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition flex items-center gap-1 shadow-xs"
                    title="Halt current replication process immediately"
                  >
                    <StopCircle size={12} />
                    Stop
                  </button>
                </div>
              </div>

              {/* Graphical Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full ${theme.primary} transition-all duration-300 rounded-full`}
                  style={{ width: `${Math.max(5, syncProgress.percent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Entity: {syncProgress.currentCount} / {syncProgress.totalCount || 'Processing'}</span>
                <span>Protected with 15s Safety Timeout</span>
              </div>
            </div>
          )}

          {/* FIREBASE SERVER FEEDBACK BOX */}
          {syncProgress.firebaseResponse && !syncProgress.isSyncing && (
            <div className={`p-3.5 rounded-2xl border ${syncProgress.lastError ? 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'} space-y-2 text-xs`}>
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  {syncProgress.lastError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                  <span>{syncProgress.lastError ? 'Replication Issue Detected' : 'Firebase Server Response'}</span>
                </div>
                {syncProgress.firebaseResponse.latencyMs !== undefined && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/10 dark:bg-white/10">
                    ⚡ {syncProgress.firebaseResponse.latencyMs}ms Latency
                  </span>
                )}
              </div>

              <p className="text-[11px] leading-relaxed opacity-90">
                {syncProgress.lastError || syncProgress.firebaseResponse.rawFeedback}
              </p>

              {syncProgress.firebaseResponse.syncedCollections && (
                <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono">
                  {Object.entries(syncProgress.firebaseResponse.syncedCollections).map(([key, val]) => (
                    <div key={key} className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded text-center">
                      <span className="capitalize">{key}</span>: <b>{val}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diagnostic Test Button & Controls */}
          <div className="flex gap-2.5">
            <button
              onClick={async () => {
                setIsTestingPing(true);
                try {
                  const res = await testFirebaseHealth();
                  setPingResult(res);
                } finally {
                  setIsTestingPing(false);
                }
              }}
              disabled={isTestingPing || syncProgress.isSyncing}
              className={`flex-1 py-2 px-3 border ${theme.borderMain} ${theme.textMain} hover:${theme.bgCardHover} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50`}
              title="Performs an instant ping and write/read test against Firebase Firestore"
            >
              {isTestingPing ? (
                <>
                  <RefreshCw className="animate-spin" size={13} /> Testing...
                </>
              ) : (
                <>
                  <Zap size={13} className="text-amber-500" /> Test Ping {pingResult ? `(${pingResult.latencyMs}ms)` : ''}
                </>
              )}
            </button>
            <button
              onClick={() => setShowConfigForm(!showConfigForm)}
              className={`flex-1 py-2 px-3 border ${theme.borderMain} ${theme.textMain} hover:${theme.bgCardHover} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1`}
            >
              ⚙️ {showConfigForm ? 'Close Config' : 'Configure keys'}
            </button>
            <button
              onClick={handlePullFromFirebase}
              disabled={syncPulling || syncProgress.isSyncing}
              className={`flex-1 py-2 px-3 border ${theme.borderAccent} ${theme.textAccent} hover:${theme.bgAccent} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-50`}
            >
              📥 Pull cloud
            </button>
          </div>

          {/* DIAGNOSTIC EVENT & NETWORK LOGS TERMINAL */}
          <div className={`${theme.bgCardElevated} rounded-2xl border ${theme.borderMain} overflow-hidden`}>
            <div 
              className={`px-3 py-2 border-b ${theme.borderMuted} flex items-center justify-between cursor-pointer select-none`}
              onClick={() => setShowLogConsole(!showLogConsole)}
            >
              <div className="flex items-center gap-1.5">
                <Terminal size={13} className={theme.textAccent} />
                <span className={`text-[11px] font-bold ${theme.textTitle}`}>Replication & Diagnostic Log</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 font-mono text-slate-600 dark:text-slate-300">
                  {syncProgress.logs?.length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {syncProgress.logs?.length > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSyncLogs();
                    }}
                    className={`text-[10px] ${theme.textMuted} hover:${theme.textTitle} px-1.5 py-0.5 rounded border ${theme.borderMuted}`}
                  >
                    Clear
                  </button>
                )}
                <span className={`text-[10px] ${theme.textMuted}`}>{showLogConsole ? '▲' : '▼'}</span>
              </div>
            </div>

            {showLogConsole && (
              <div className="p-2.5 max-h-40 overflow-y-auto space-y-1 font-mono text-[10px]">
                {syncProgress.logs && syncProgress.logs.length > 0 ? (
                  syncProgress.logs.map((log) => {
                    const typeColor = 
                      log.type === 'success' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      log.type === 'error' ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' :
                      log.type === 'warn' ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' :
                      'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';

                    return (
                      <div key={log.id} className={`p-1.5 rounded border ${typeColor} flex items-start gap-1.5 leading-tight`}>
                        <span className="text-[9px] opacity-70 shrink-0">{log.timestamp}</span>
                        <span className="flex-1 break-all">{log.message}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className={`p-2 text-center ${theme.textMuted}`}>
                    No recent replication logs. Click "Synchronize SQLite to Firebase" or "Test Ping".
                  </div>
                )}
              </div>
            )}
          </div>

          {showConfigForm && (
            <form onSubmit={handleSaveConfig} className={`${theme.bgCardElevated} p-4 rounded-2xl space-y-2.5 border ${theme.borderMain} animate-in slide-in-from-top duration-200`}>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${theme.textMuted} block pb-1 border-b ${theme.borderMuted}`}>Firebase Credentials</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase block`}>API Key *</label>
                  <input 
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className={`w-full font-mono text-[10px] p-2 ${theme.bgInput} rounded-lg focus:outline-none`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase block`}>Project ID *</label>
                  <input 
                    type="text"
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="tutortrack-ea6b"
                    className={`w-full font-mono text-[10px] p-2 ${theme.bgInput} rounded-lg focus:outline-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase block`}>Auth Domain</label>
                  <input 
                    type="text"
                    value={authDomain}
                    onChange={(e) => setAuthDomain(e.target.value)}
                    placeholder="tutortrack.firebaseapp.com"
                    className={`w-full font-mono text-[10px] p-2 ${theme.bgInput} rounded-lg focus:outline-none`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase block`}>App ID</label>
                  <input 
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:842:web:6e..."
                    className={`w-full font-mono text-[10px] p-2 ${theme.bgInput} rounded-lg focus:outline-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase block`}>Database ID</label>
                  <input 
                    type="text"
                    value={dbId}
                    onChange={(e) => setDbId(e.target.value)}
                    placeholder="(default)"
                    className={`w-full font-mono text-[10px] p-2 ${theme.bgInput} rounded-lg focus:outline-none`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[9px] font-bold ${theme.textMuted} uppercase block`}>Measurement ID</label>
                  <input 
                    type="text"
                    value={measurementIdState}
                    onChange={(e) => setMeasurementIdState(e.target.value)}
                    placeholder="G-XXXXXX"
                    className={`w-full font-mono text-[10px] p-2 ${theme.bgInput} rounded-lg focus:outline-none`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-2 ${theme.btnPrimary} rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5`}
              >
                <Save size={13} /> Save Credentials
              </button>
            </form>
          )}

          {settings.isSyncing || syncProgress.isSyncing ? (
            <div className="flex gap-2">
              <button
                disabled
                className={`flex-1 py-3 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow opacity-90 cursor-wait`}
              >
                <RefreshCw className="animate-spin" size={14} />
                Replicating to cloud ({syncProgress.percent}%)...
              </button>
              <button
                type="button"
                onClick={stopSync}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow active:scale-98 shrink-0"
                title="Halt replication immediately"
              >
                <StopCircle size={14} />
                Stop Sync
              </button>
            </div>
          ) : (
            <button
              onClick={triggerManualSync}
              className={`w-full py-3 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow`}
            >
              <CloudLightning size={14} /> Synchronize SQLite to Firebase Now
            </button>
          )}
        </div>

        {/* Security PIN Lock Setup */}
        <div className={`p-5 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-4 flex flex-col justify-between ${theme.textMain}`}>
          <div>
            <div className={`flex items-center gap-2 border-b ${theme.borderMuted} pb-3`}>
              <KeyRound className={theme.textAccent} size={18} />
              <h3 className={`font-bold ${theme.textTitle} text-sm font-display`}>Biometric & PIN Lock Setup</h3>
            </div>

            <p className={`text-xs ${theme.textMuted} mt-2 leading-relaxed`}>
              Enable local application level PIN code protection to secure sensitive financial ledgers and student contact information.
            </p>

            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${theme.textMain} uppercase tracking-wide`}>Secure PIN Authentication</span>
                <button
                  onClick={() => setPinEnabledLocal(!pinEnabledLocal)}
                  className={`w-11 h-6 rounded-full p-0.5 transition ${pinEnabledLocal ? theme.primary : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition ${pinEnabledLocal ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {pinEnabledLocal && (
                <div className={`space-y-1 ${theme.bgCardElevated} p-3 rounded-2xl border ${theme.borderMuted} animate-in slide-in-from-top duration-200`}>
                  <label className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>Numeric PIN Code (4 digits)</label>
                  <div className="relative">
                    <input 
                      type={showPinState ? 'text' : 'password'}
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="e.g. 1485"
                      className={`w-full text-xs font-bold tracking-widest p-2 rounded-xl ${theme.bgInput} focus:outline-none`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinState(!showPinState)}
                      className={`absolute right-3 top-2.5 ${theme.textMuted} hover:${theme.textTitle}`}
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
            className={`w-full py-2.5 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5`}
          >
            <Save size={13} /> Save Security Profile
          </button>
        </div>

        {/* Session Landmark Alerts card */}
        <div className={`p-5 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-4 flex flex-col justify-between ${theme.textMain}`}>
          <div>
            <div className={`flex items-center gap-2 border-b ${theme.borderMuted} pb-3`}>
              <Volume2 className={theme.textAccent} size={18} />
              <h3 className={`font-bold ${theme.textTitle} text-sm font-display`}>Session Landmark Alerts</h3>
            </div>

            <p className={`text-xs ${theme.textMuted} mt-2 leading-relaxed font-sans`}>
              Configure landmark notification triggers (in minutes) for live tuition sessions to track your class durations with distinctive synthesized tones.
            </p>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              <div className="space-y-1">
                <label className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>1st Alert</label>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    min={1}
                    value={firstAlert}
                    onChange={(e) => setFirstAlert(Math.max(1, parseInt(e.target.value) || 0))}
                    className={`w-full text-xs font-bold p-2.5 pr-7 rounded-xl ${theme.bgInput} text-center focus:outline-none`}
                  />
                  <span className={`absolute right-2 text-[10px] font-bold ${theme.textMuted} pointer-events-none select-none`}>m</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>2nd Alert</label>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    min={1}
                    value={secondAlert}
                    onChange={(e) => setSecondAlert(Math.max(1, parseInt(e.target.value) || 0))}
                    className={`w-full text-xs font-bold p-2.5 pr-7 rounded-xl ${theme.bgInput} text-center focus:outline-none`}
                  />
                  <span className={`absolute right-2 text-[10px] font-bold ${theme.textMuted} pointer-events-none select-none`}>m</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>3rd Alert</label>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    min={1}
                    value={thirdAlert}
                    onChange={(e) => setThirdAlert(Math.max(1, parseInt(e.target.value) || 0))}
                    className={`w-full text-xs font-bold p-2.5 pr-7 rounded-xl ${theme.bgInput} text-center focus:outline-none`}
                  />
                  <span className={`absolute right-2 text-[10px] font-bold ${theme.textMuted} pointer-events-none select-none`}>m</span>
                </div>
              </div>
            </div>

            {/* Custom sound selectors */}
            <div className={`space-y-3 mt-4 pt-4 border-t ${theme.borderMuted}`}>
              <label className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block font-sans`}>Custom Alarm Tones</label>
              
              {/* 1st Alert sound */}
              <div className="flex items-center gap-2">
                <label className={`text-[10px] font-bold ${theme.textMuted} w-14 shrink-0 font-sans`}>1st Alert:</label>
                <select
                  value={firstSound}
                  onChange={(e) => {
                    setFirstSound(e.target.value);
                    playSoundPreset(e.target.value);
                  }}
                  className={`flex-1 text-xs p-2 rounded-xl ${theme.bgInput} font-bold focus:outline-none font-sans cursor-pointer`}
                >
                  {SOUND_PRESETS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => playSoundPreset(firstSound)}
                  className={`p-1 px-1.5 border ${theme.borderMain} hover:${theme.bgCardHover} rounded-xl ${theme.textAccent} transition flex-shrink-0`}
                  title="Test Alert Tone"
                >
                  <Volume2 size={13} />
                </button>
              </div>

              {/* 2nd Alert sound */}
              <div className="flex items-center gap-2">
                <label className={`text-[10px] font-bold ${theme.textMuted} w-14 shrink-0 font-sans`}>2nd Alert:</label>
                <select
                  value={secondSound}
                  onChange={(e) => {
                    setSecondSound(e.target.value);
                    playSoundPreset(e.target.value);
                  }}
                  className={`flex-1 text-xs p-2 rounded-xl ${theme.bgInput} font-bold focus:outline-none font-sans cursor-pointer`}
                >
                  {SOUND_PRESETS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => playSoundPreset(secondSound)}
                  className={`p-1 px-1.5 border ${theme.borderMain} hover:${theme.bgCardHover} rounded-xl ${theme.textAccent} transition flex-shrink-0`}
                  title="Test Alert Tone"
                >
                  <Volume2 size={13} />
                </button>
              </div>

              {/* 3rd Alert sound */}
              <div className="flex items-center gap-2">
                <label className={`text-[10px] font-bold ${theme.textMuted} w-14 shrink-0 font-sans`}>3rd Alert:</label>
                <select
                  value={thirdSound}
                  onChange={(e) => {
                    setThirdSound(e.target.value);
                    playSoundPreset(e.target.value);
                  }}
                  className={`flex-1 text-xs p-2 rounded-xl ${theme.bgInput} font-bold focus:outline-none font-sans cursor-pointer`}
                >
                  {SOUND_PRESETS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => playSoundPreset(thirdSound)}
                  className={`p-1 px-1.5 border ${theme.borderMain} hover:${theme.bgCardHover} rounded-xl ${theme.textAccent} transition flex-shrink-0`}
                  title="Test Alert Tone"
                >
                  <Volume2 size={13} />
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveLandmarks}
            className={`w-full py-2.5 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm`}
          >
            <Save size={13} /> Save Landmark Alert Profiles
          </button>
        </div>

        {/* Device OS Notifications card */}
        <div className={`p-5 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-4 flex flex-col justify-between ${theme.textMain}`}>
          <div>
            <div className={`flex items-center gap-2 border-b ${theme.borderMuted} pb-3`}>
              <Bell className={theme.textAccent} size={18} />
              <h3 className={`font-bold ${theme.textTitle} text-sm font-display`}>Device OS Notifications</h3>
            </div>

            <p className={`text-xs ${theme.textMuted} mt-2 leading-relaxed font-sans`}>
              Enable native operating-system level push alerts directly on your device / APK wrapper when tutor schedules, invoices, or critical system syncs complete.
            </p>

            <div className={`p-4 ${theme.bgCardElevated} rounded-2xl space-y-2.5 text-xs font-medium ${theme.textMain} border ${theme.borderMuted} mt-4 font-mono`}>
              <div className="flex justify-between items-center font-sans">
                <span>System Support:</span>
                <span className={`font-bold uppercase text-[9.5px] px-2 py-0.5 rounded tracking-wide ${
                  notificationPermission !== 'not-supported' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}>
                  {notificationPermission !== 'not-supported' ? 'Supported' : 'Unavailable'}
                </span>
              </div>
              <div className="flex justify-between items-center font-sans">
                <span>Current Permission:</span>
                <span className={`font-bold uppercase text-[9.5px] px-2 py-0.5 rounded tracking-wide ${
                  notificationPermission === 'granted' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' :
                  notificationPermission === 'denied' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                  'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                className={`w-full py-2.5 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm`}
              >
                <Bell size={13} /> Grant OS Permissions
              </button>
            )}
            {notificationPermission === 'granted' && (
              <button
                onClick={testOSNotification}
                className={`w-full py-2.5 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm`}
              >
                <Bell size={13} /> Send Test Push Notice
              </button>
            )}
            {notificationPermission === 'not-supported' && (
              <p className={`text-[10px] ${theme.textMuted} text-center leading-relaxed font-sans`}>
                Notice: Native alerts require an HTTPS origin or secure PWA/APK wrapper framework to request device triggers.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Live Export and Restore Notifications */}
      {exportSuccessNotice && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>{exportSuccessNotice}</span>
          </div>
          <button 
            onClick={() => setExportSuccessNotice(null)} 
            className="p-1 hover:bg-emerald-500/20 rounded-lg transition text-emerald-700 dark:text-emerald-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {restoreSuccessNotice && (
        <div className="p-4 bg-indigo-500/15 border border-indigo-500/30 rounded-2xl text-indigo-800 dark:text-indigo-300 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-indigo-500 shrink-0" />
            <span>{restoreSuccessNotice}</span>
          </div>
          <button 
            onClick={() => setRestoreSuccessNotice(null)} 
            className="p-1 hover:bg-indigo-500/20 rounded-lg transition text-indigo-700 dark:text-indigo-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Unsynced Local Changes & Delta Migration Section */}
      <div className={`p-6 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-6 ${theme.textMain}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${theme.borderMuted} pb-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${totalUnsyncedCount > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'}`}>
              <CloudLightning size={22} />
            </div>
            <div>
              <h3 className={`font-bold ${theme.textTitle} text-base font-display flex items-center gap-2`}>
                Unsynced Local Changes & Delta Migration
              </h3>
              <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                Export only pending modifications and deletions to a lightweight JSON delta, or import offline changes to stage for cloud synchronization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalUnsyncedCount > 0 ? (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 shadow-2xs animate-pulse">
                <Clock size={13} />
                {totalUnsyncedCount} Unsynced Change{totalUnsyncedCount === 1 ? '' : 's'} Pending
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 size={13} />
                All Records Synced with Cloud
              </span>
            )}
          </div>
        </div>

        {/* Pending Records Breakdown Cards */}
        <div>
          <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-wider block mb-2.5`}>
            Pending Local Delta Breakdown
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5">
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedStudents.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Students</div>
              <div className={`text-lg font-black ${unsyncedStudents.length > 0 ? 'text-amber-600 dark:text-amber-400' : theme.textTitle}`}>{unsyncedStudents.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedSchedules.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Schedules</div>
              <div className={`text-lg font-black ${unsyncedSchedules.length > 0 ? 'text-amber-600 dark:text-amber-400' : theme.textTitle}`}>{unsyncedSchedules.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedAttendance.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Attendance</div>
              <div className={`text-lg font-black ${unsyncedAttendance.length > 0 ? 'text-amber-600 dark:text-amber-400' : theme.textTitle}`}>{unsyncedAttendance.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedPayments.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Invoices</div>
              <div className={`text-lg font-black ${unsyncedPayments.length > 0 ? 'text-amber-600 dark:text-amber-400' : theme.textTitle}`}>{unsyncedPayments.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedExamSchedules.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Exams Sched.</div>
              <div className={`text-lg font-black ${unsyncedExamSchedules.length > 0 ? 'text-amber-600 dark:text-amber-400' : theme.textTitle}`}>{unsyncedExamSchedules.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedExamRecords.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Exam Grades</div>
              <div className={`text-lg font-black ${unsyncedExamRecords.length > 0 ? 'text-amber-600 dark:text-amber-400' : theme.textTitle}`}>{unsyncedExamRecords.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${unsyncedDeletions.length > 0 ? 'border-rose-500/40 bg-rose-500/5' : theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-rose-500">Deletions</div>
              <div className={`text-lg font-black ${unsyncedDeletions.length > 0 ? 'text-rose-600 dark:text-rose-400' : theme.textTitle}`}>{unsyncedDeletions.length}</div>
            </div>
          </div>
        </div>

        {/* Unsynced Export & Import Action Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          
          {/* EXPORT UNSYNCED DELTA */}
          <div className={`p-5 rounded-2xl border ${theme.borderMuted} ${theme.bgCardElevated} flex flex-col justify-between space-y-4`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="text-amber-500" size={18} />
                <h4 className={`text-sm font-bold ${theme.textTitle}`}>Export Unsynced Changes</h4>
              </div>
              <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
                Package all unpushed local creations, edits, and queued deletions into a lightweight delta JSON file. Ideal for transferring pending edits to another device or saving offline work.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleExportUnsyncedJSON}
                className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm hover:opacity-95"
              >
                <Download size={15} /> Export Unsynced Delta ({totalUnsyncedCount} items)
              </button>
              <span className="block text-center text-[10px] text-slate-400 mt-2">
                {totalUnsyncedCount > 0 ? `${totalUnsyncedCount} items awaiting cloud push` : 'All records in sync (will export current sync status payload)'}
              </span>
            </div>
          </div>

          {/* IMPORT UNSYNCED DELTA */}
          <div className={`p-5 rounded-2xl border ${theme.borderMuted} ${theme.bgCardElevated} flex flex-col justify-between space-y-4`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="text-indigo-500" size={18} />
                <h4 className={`text-sm font-bold ${theme.textTitle}`}>Import & Stage Unsynced Changes</h4>
              </div>
              <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
                Import delta JSON files from another offline device or teammate. Items are merged into your local database and flagged as pending, ready for Firebase Cloud sync.
              </p>
            </div>

            {/* Drag & Drop or File Browse Box */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDraggingUnsynced(true); }}
              onDragLeave={() => setIsDraggingUnsynced(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingUnsynced(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleProcessUnsyncedFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                isDraggingUnsynced 
                  ? 'border-amber-500 bg-amber-500/10' 
                  : `border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 bg-slate-50/50 dark:bg-slate-900/40`
              }`}
            >
              <input 
                type="file"
                id="unsynced-file-upload-input"
                accept=".json,application/json"
                onChange={handleImportUnsyncedFileInput}
                className="hidden"
              />
              <label 
                htmlFor="unsynced-file-upload-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <Upload size={20} className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition" />
                <span className={`text-xs font-bold ${theme.textTitle}`}>
                  Click to browse or drop Unsynced Delta JSON here
                </span>
                <span className="text-[10px] text-slate-400">
                  Accepts TutorTrack delta or partial JSON files
                </span>
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* Local Database Backup & Restore Section */}
      <div className={`p-6 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-6 ${theme.textMain}`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${theme.borderMuted} pb-4`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${theme.bgAccent} ${theme.textAccent} border ${theme.borderAccent}`}>
              <HardDrive size={22} />
            </div>
            <div>
              <h3 className={`font-bold ${theme.textTitle} text-base font-display flex items-center gap-2`}>
                Local Database Backup & Migration
              </h3>
              <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                Export full system snapshots to JSON for permanent offline storage, or restore previous backups seamlessly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${theme.bgCardElevated} border ${theme.borderMain} ${theme.textAccent} flex items-center gap-1.5 shadow-2xs`}>
              <Database size={13} />
              {students.length + schedules.length + attendance.length + payments.length + examSchedules.length + examRecords.length} Active Records
            </span>
          </div>
        </div>

        {/* Current Database Summary Grid */}
        <div>
          <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-wider block mb-2.5`}>
            Active Local Tables Overview
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Students</div>
              <div className={`text-lg font-black ${theme.textTitle}`}>{students.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Schedules</div>
              <div className={`text-lg font-black ${theme.textTitle}`}>{schedules.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Attendance</div>
              <div className={`text-lg font-black ${theme.textTitle}`}>{attendance.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Invoices</div>
              <div className={`text-lg font-black ${theme.textTitle}`}>{payments.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Exams Sched.</div>
              <div className={`text-lg font-black ${theme.textTitle}`}>{examSchedules.length}</div>
            </div>
            <div className={`p-3 rounded-2xl ${theme.bgCardElevated} border ${theme.borderMuted} text-center space-y-1`}>
              <div className="text-[10px] font-bold text-slate-500">Exam Grades</div>
              <div className={`text-lg font-black ${theme.textTitle}`}>{examRecords.length}</div>
            </div>
          </div>
        </div>

        {/* Export & Import Action Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          
          {/* EXPORT PANEL */}
          <div className={`p-5 rounded-2xl border ${theme.borderMuted} ${theme.bgCardElevated} flex flex-col justify-between space-y-4`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className={theme.textAccent} size={18} />
                <h4 className={`text-sm font-bold ${theme.textTitle}`}>Export Complete Database</h4>
              </div>
              <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
                Generate a single, comprehensive JSON file containing all students, classes, attendance logs, tuition invoices, exam records, and app configurations.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleExportBackupJSON}
                className={`w-full py-3 px-4 ${theme.btnPrimary} rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm hover:opacity-95`}
              >
                <Download size={15} /> Export Backup (.JSON)
              </button>
              <span className="block text-center text-[10px] text-slate-400 mt-2">
                Format: UTF-8 JSON • Compatible with all TutorTrack platforms
              </span>
            </div>
          </div>

          {/* IMPORT PANEL */}
          <div className={`p-5 rounded-2xl border ${theme.borderMuted} ${theme.bgCardElevated} flex flex-col justify-between space-y-4`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="text-emerald-500" size={18} />
                <h4 className={`text-sm font-bold ${theme.textTitle}`}>Import & Restore Database</h4>
              </div>
              <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
                Restore a previous database backup. You can inspect the record breakdown and choose between a clean replace or merging with existing data.
              </p>
            </div>

            {/* Drag & Drop or File Browse Box */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDraggingBackup(true); }}
              onDragLeave={() => setIsDraggingBackup(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingBackup(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleProcessBackupFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                isDraggingBackup 
                  ? 'border-emerald-500 bg-emerald-500/10' 
                  : `border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40`
              }`}
            >
              <input 
                type="file"
                id="backup-file-upload-input"
                accept=".json,application/json"
                onChange={handleImportFileInput}
                className="hidden"
              />
              <label 
                htmlFor="backup-file-upload-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
              >
                <Upload size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition" />
                <span className={`text-xs font-bold ${theme.textTitle}`}>
                  Click to browse or drop backup JSON here
                </span>
                <span className="text-[10px] text-slate-400">
                  Accepts TutorTrack .json backup files
                </span>
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* Spreadsheet CSV Reporting */}
      <div className={`p-5 ${theme.bgCard} border ${theme.borderMain} rounded-3xl shadow-sm space-y-4 ${theme.textMain}`}>
        <div className={`flex items-center gap-2 border-b ${theme.borderMuted} pb-3`}>
          <FileSpreadsheet className="text-emerald-500" size={18} />
          <h3 className={`font-bold ${theme.textTitle} text-sm font-display`}>Spreadsheet CSV Exports (Individual Modules)</h3>
        </div>

        <p className={`text-xs ${theme.textMuted} leading-relaxed`}>
          Download individual spreadsheet reports in standard CSV format compatible with Microsoft Excel, Apple Numbers, and Google Sheets.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleExportCSV('students')}
            className={`py-2.5 px-3 border ${theme.borderMain} ${theme.bgCardElevated} hover:${theme.bgCardHover} rounded-xl text-xs font-semibold ${theme.textMain} transition flex items-center justify-center gap-2`}
          >
            <Download size={13} className="text-emerald-500" />
            Students CSV
          </button>
          <button
            onClick={() => handleExportCSV('attendance')}
            className={`py-2.5 px-3 border ${theme.borderMain} ${theme.bgCardElevated} hover:${theme.bgCardHover} rounded-xl text-xs font-semibold ${theme.textMain} transition flex items-center justify-center gap-2`}
          >
            <Download size={13} className="text-emerald-500" />
            Attendance CSV
          </button>
          <button
            onClick={() => handleExportCSV('payments')}
            className={`py-2.5 px-3 border ${theme.borderMain} ${theme.bgCardElevated} hover:${theme.bgCardHover} rounded-xl text-xs font-semibold ${theme.textMain} transition flex items-center justify-center gap-2`}
          >
            <Download size={13} className="text-emerald-500" />
            Payments CSV
          </button>
          <button
            onClick={() => handleExportCSV('exams')}
            className={`py-2.5 px-3 border ${theme.borderMain} ${theme.bgCardElevated} hover:${theme.bgCardHover} rounded-xl text-xs font-semibold ${theme.textMain} transition flex items-center justify-center gap-2`}
          >
            <Download size={13} className="text-emerald-500" />
            Exam Grades CSV
          </button>
        </div>
      </div>

      {/* IMPORT & RESTORE PREVIEW MODAL */}
      {importModalOpen && importStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg ${theme.bgCard} border ${theme.borderMain} rounded-3xl p-6 shadow-2xl space-y-5 text-slate-800 dark:text-slate-100 max-h-[90vh] overflow-y-auto`}>
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Restore Database Backup
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify backup summary before applying changes
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* File Info Banner */}
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">File:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">{importFileName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Size:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{importFileSize}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Exported At:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{importStats.exportedAt}</span>
              </div>
            </div>

            {/* Breakdown of items in backup */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Records Found in Backup ({importStats.total} Total)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Students:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{importStats.students}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Schedules:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{importStats.schedules}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Attendance:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{importStats.attendance}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Invoices:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{importStats.payments}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Exam Sched.:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{importStats.examSchedules}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-300">Exam Grades:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{importStats.examRecords}</span>
                </div>
              </div>
            </div>

            {/* Restore Strategy Selection */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Choose Restore Strategy
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                    importMode === 'replace'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <CheckCircle2 size={14} className={importMode === 'replace' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                    <span>Clean Overwrite</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Replaces current database with this backup dataset cleanly.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                    importMode === 'merge'
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-bold shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <RefreshCw size={14} className={importMode === 'merge' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                    <span>Smart Merge</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                    Merges records by ID, keeping existing data and adding new items.
                  </p>
                </button>
              </div>

              {/* Include Settings checkbox */}
              {importPendingPayload?.settings && (
                <label className="flex items-center gap-2 pt-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
                  <input 
                    type="checkbox"
                    checked={importIncludeSettings}
                    onChange={(e) => setImportIncludeSettings(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Restore application preferences (Color presets, alert milestones, PIN settings)</span>
                </label>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Check size={14} /> Confirm & Restore
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Import & Stage Unsynced Changes Preview Modal */}
      {importUnsyncedModalOpen && importUnsyncedStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-lg ${theme.bgCard} border ${theme.borderMain} rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-200`}>
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <CloudLightning size={20} />
                </div>
                <div>
                  <h3 className={`font-bold ${theme.textTitle} text-base font-display`}>
                    Stage Unsynced Delta
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Review and stage offline pending changes
                  </span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setImportUnsyncedModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* File Info Card */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-xs">
              <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                <span className="truncate max-w-[240px]">{importUnsyncedFileName}</span>
                <span className="text-amber-700 dark:text-amber-400">{importUnsyncedFileSize}</span>
              </div>
              <div className="flex justify-between text-[11px] text-amber-800/80 dark:text-amber-300/80">
                <span>Exported timestamp:</span>
                <span className="font-mono">{importUnsyncedStats.exportedAt}</span>
              </div>
            </div>

            {/* Unsynced Delta Breakdown Grid */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-wider`}>
                  Pending Modifications in File ({importUnsyncedStats.total} total items)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block">Students</span>
                  <span className={`font-bold ${theme.textTitle} text-sm`}>{importUnsyncedStats.students}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block">Schedules</span>
                  <span className={`font-bold ${theme.textTitle} text-sm`}>{importUnsyncedStats.schedules}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block">Attendance</span>
                  <span className={`font-bold ${theme.textTitle} text-sm`}>{importUnsyncedStats.attendance}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block">Invoices</span>
                  <span className={`font-bold ${theme.textTitle} text-sm`}>{importUnsyncedStats.payments}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block">Exams Sched.</span>
                  <span className={`font-bold ${theme.textTitle} text-sm`}>{importUnsyncedStats.examSchedules}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center">
                  <span className="text-[10px] text-slate-500 block">Exam Grades</span>
                  <span className={`font-bold ${theme.textTitle} text-sm`}>{importUnsyncedStats.examRecords}</span>
                </div>
                <div className="p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/20 text-center col-span-2">
                  <span className="text-[10px] text-rose-500 block font-semibold">Pending Deletions</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">{importUnsyncedStats.deletions}</span>
                </div>
              </div>
            </div>

            {/* Explanation Note */}
            <div className="p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed flex items-start gap-2.5">
              <Zap size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">How unsynced staging works:</p>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                  Imported records will be merged into your local offline storage and tagged with <code className="px-1 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 font-mono text-[10px]">syncStatus: "pending"</code>. Queued deletions will be merged into your deletion log. All changes will be securely dispatched to Firebase Firestore during your next cloud sync.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportUnsyncedModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleExecuteUnsyncedImport(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Check size={14} /> Stage in Local Database
              </button>

              {isFirebaseConfigured() && (
                <button
                  type="button"
                  onClick={() => handleExecuteUnsyncedImport(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CloudLightning size={14} /> Stage & Sync Now
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Erase cache Warning box */}
      <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-3xl space-y-3">
        <h4 className="text-xs font-black text-rose-600 dark:text-rose-400 tracking-wide uppercase flex items-center gap-2">
          <ShieldAlert size={14} className="text-rose-600 dark:text-rose-400" /> Danger System Zone
        </h4>
        <p className={`text-xs ${theme.textMuted} leading-normal`}>
          Wiping the database deletes all local tables (students, lessons, bills, logs). The local cache will start as a completely fresh, empty dataset. This action is irreversible.
        </p>
        <button
          onClick={() => {
            if (confirm('Permanently wipe the SQLite offline database and restore template initial seeds? This action is irreversible.')) {
              clearDatabase();
            }
          }}
          className={`px-4 py-2 text-xs font-bold ${theme.bgCard} text-rose-600 dark:text-rose-400 hover:opacity-80 border border-rose-500/30 rounded-xl shadow-sm transition`}
        >
          Erase local database tables (Wipe clean)
        </button>
      </div>

    </div>
  );
}
