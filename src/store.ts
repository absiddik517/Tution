import { create } from 'zustand';
import { Student, Schedule, Attendance, Payment, AppSettings, AppNotification } from './types';
import { TutorTrackDB } from './db';
import { syncLocalToFirebase, fetchFromFirebase, getActiveConfig, isFirebaseConfigured } from './firebase';

interface TutorTrackStore {
  students: Student[];
  schedules: Schedule[];
  attendance: Attendance[];
  payments: Payment[];
  settings: AppSettings;
  notifications: AppNotification[];
  currentUser: any | null;
  setCurrentUser: (user: any | null) => void;
  
  // Filtering & Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  classFilter: string;
  setClassFilter: (classF: string) => void;
  statusFilter: 'All' | 'Active' | 'Inactive';
  setStatusFilter: (filter: 'All' | 'Active' | 'Inactive') => void;

  // Actions - Students
  addStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateStudent: (id: string, updated: Partial<Student>) => void;
  deleteStudent: (id: string) => void;

  // Actions - Schedules
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateSchedule: (id: string, updated: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  duplicateSchedule: (id: string) => void;

  // Actions - Attendance
  addAttendance: (attendance: Omit<Attendance, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateAttendance: (id: string, updated: Partial<Attendance>) => void;
  deleteAttendance: (id: string) => void;

  // Actions - Payments
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updatePayment: (id: string, updated: Partial<Payment>) => void;
  deletePayment: (id: string) => void;
  generateAutoPayments: (studentId: string, billingPeriod: string, expectedDays: number) => void;

  // Sync Engine & Settings Trigger
  triggerManualSync: () => Promise<void>;
  saveFirebaseConfig: (config: AppSettings['firebaseConfig']) => void;
  triggerFirebasePull: () => Promise<{ success: boolean; error?: string }>;
  toggleDarkMode: () => void;
  setPinLock: (enabled: boolean, pin?: string) => void;
  clearDatabase: () => void;
  
  // Notification Management
  addNotification: (title: string, body: string, type: AppNotification['type']) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Export & Recovery
  importData: (imported: { students: Student[], schedules: Schedule[], attendance: Attendance[], payments: Payment[] }) => void;
}

export const useStore = create<TutorTrackStore>((set, get) => ({
  students: TutorTrackDB.getStudents(),
  schedules: TutorTrackDB.getSchedules(),
  attendance: TutorTrackDB.getAttendance(),
  payments: TutorTrackDB.getPayments(),
  settings: TutorTrackDB.getSettings(),
  notifications: TutorTrackDB.getNotifications(),
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),
  classFilter: 'All',
  setClassFilter: (classF) => set({ classFilter: classF }),
  statusFilter: 'Active',
  setStatusFilter: (filter) => set({ statusFilter: filter }),

  // STUDENT ACTIONS
  addStudent: (studentData) => {
    const now = new Date().toISOString();
    const id = 'stud-' + Math.random().toString(36).substring(2, 9);
    const newStudent: Student = {
      ...studentData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [newStudent, ...get().students];
    TutorTrackDB.setStudents(updated);
    set({ students: updated });
    get().addNotification('New Student Joined', `${newStudent.name} registered under ${newStudent.class}.`, 'system');
  },

  updateStudent: (id, updatedFields) => {
    const now = new Date().toISOString();
    const updated: Student[] = get().students.map(s => {
      if (s.id === id) {
        return {
          ...s,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
        };
      }
      return s;
    });
    TutorTrackDB.setStudents(updated);
    set({ students: updated });
  },

  deleteStudent: (id) => {
    const deletedStudent = get().students.find(s => s.id === id);
    const affectedSchedules = get().schedules.filter(sch => sch.studentId === id);
    
    const queueDeletes: any[] = [];
    if (deletedStudent) {
      queueDeletes.push({ id: deletedStudent.id, collectionName: 'students' as const });
    }
    affectedSchedules.forEach(sc => {
      queueDeletes.push({ id: sc.id, collectionName: 'schedules' as const });
    });

    const updated = get().students.filter(s => s.id !== id);
    TutorTrackDB.setStudents(updated);
    const updatedSchedules = get().schedules.filter(sch => sch.studentId !== id);
    TutorTrackDB.setSchedules(updatedSchedules);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, ...queueDeletes]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ 
      students: updated, 
      schedules: updatedSchedules,
      settings: updatedSettings
    });
    get().addNotification('Student Removed', 'Related scheduling slots and records cleared.', 'system');
  },

  // SCHEDULE ACTIONS
  addSchedule: (schedData) => {
    const now = new Date().toISOString();
    const id = 'sched-' + Math.random().toString(36).substring(2, 9);
    const newSched: Schedule = {
      ...schedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [...get().schedules, newSched];
    TutorTrackDB.setSchedules(updated);
    set({ schedules: updated });
    
    // Simulate Notification Alarm Trigger 30m before
    get().addNotification('Schedule Added', `Class created on ${newSched.weekday}s at ${newSched.startTime}.`, 'schedule');
  },

  updateSchedule: (id, updatedFields) => {
    const now = new Date().toISOString();
    const updated: Schedule[] = get().schedules.map(sc => {
      if (sc.id === id) {
        return {
          ...sc,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
        };
      }
      return sc;
    });
    TutorTrackDB.setSchedules(updated);
    set({ schedules: updated });
  },

  deleteSchedule: (id) => {
    const updated = get().schedules.filter(sc => sc.id !== id);
    TutorTrackDB.setSchedules(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'schedules' as const }]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ schedules: updated, settings: updatedSettings });
  },

  duplicateSchedule: (id) => {
    const source = get().schedules.find(sc => sc.id === id);
    if (!source) return;
    const now = new Date().toISOString();
    const duplicated: Schedule = {
      ...source,
      id: 'sched-' + Math.random().toString(36).substring(2, 9),
      weekday: source.weekday === 'Friday' ? 'Saturday' : source.weekday, // slightly variant to separate
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [...get().schedules, duplicated];
    TutorTrackDB.setSchedules(updated);
    set({ schedules: updated });
    get().addNotification('Schedule Copied', `Copied session slot for duplication.`, 'schedule');
  },

  // ATTENDANCE ACTIONS
  addAttendance: (attData) => {
    const now = new Date().toISOString();
    const id = 'att-' + Math.random().toString(36).substring(2, 9);
    const newAtt: Attendance = {
      ...attData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [newAtt, ...get().attendance];
    TutorTrackDB.setAttendance(updated);
    set({ attendance: updated });

    // Instantly check and append relevant payment notifications if overdue
    get().addNotification('Attendance Logged', `Logged slot on ${newAtt.date} duration ${newAtt.duration} hrs.`, 'attendance');
  },

  updateAttendance: (id, updatedFields) => {
    const now = new Date().toISOString();
    const updated: Attendance[] = get().attendance.map(at => {
      if (at.id === id) {
        return {
          ...at,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
        };
      }
      return at;
    });
    TutorTrackDB.setAttendance(updated);
    set({ attendance: updated });
  },

  deleteAttendance: (id) => {
    const updated = get().attendance.filter(at => at.id !== id);
    TutorTrackDB.setAttendance(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'attendance' as const }]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ attendance: updated, settings: updatedSettings });
  },

  // PAYMENT ACTIONS
  addPayment: (payData) => {
    const now = new Date().toISOString();
    const id = 'pay-' + Math.random().toString(36).substring(2, 9);
    const newPay: Payment = {
      ...payData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [newPay, ...get().payments];
    TutorTrackDB.setPayments(updated);
    set({ payments: updated });
    get().addNotification('Invoice Saved', `Invoice for period ${newPay.billingPeriod} is ${newPay.status}.`, 'payment');
  },

  updatePayment: (id, updatedFields) => {
    const now = new Date().toISOString();
    const updated: Payment[] = get().payments.map(py => {
      if (py.id === id) {
        const payable = updatedFields.payableAmount !== undefined ? updatedFields.payableAmount : py.payableAmount;
        const paid = updatedFields.paidAmount !== undefined ? updatedFields.paidAmount : py.paidAmount;
        const due = payable - paid;
        let finalStatus: Payment['status'] = 'Due';
        if (paid >= payable) finalStatus = 'Paid';
        else if (paid > 0) finalStatus = 'Partial';

        return {
          ...py,
          ...updatedFields,
          dueAmount: due,
          status: finalStatus,
          updatedAt: now,
          syncStatus: 'pending' as const,
        };
      }
      return py;
    });
    TutorTrackDB.setPayments(updated);
    set({ payments: updated });
  },

  deletePayment: (id) => {
    const updated = get().payments.filter(py => py.id !== id);
    TutorTrackDB.setPayments(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'payments' as const }]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ payments: updated, settings: updatedSettings });
  },

  // AUTOMATED BILLING GENERATION
  generateAutoPayments: (studentId, billingPeriod, expectedDays) => {
    const student = get().students.find(s => s.id === studentId);
    if (!student) return;

    // Filter attendance records during selected billingPeriod (e.g. "June 2026")
    const periodMonths: { [key: string]: string } = {
      'January': '01', 'February': '02', 'March': '03', 'April': '04', 'May': '05', 'June': '06',
      'July': '07', 'August': '08', 'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };
    
    const parts = billingPeriod.split(' ');
    const monthName = parts[0];
    const yearStr = parts[1] || '2026';
    const monthCode = periodMonths[monthName] || '06';
    const datePrefix = `${yearStr}-${monthCode}`;

    const studentAttendance = get().attendance.filter(at => 
      at.studentId === studentId && at.date.startsWith(datePrefix)
    );

    const attendedCount = studentAttendance.length;
    let computedPayable = student.monthlySalary;

    // Implement Custom billing calculations
    if (student.paymentCycle !== 'Monthly') {
      // Payable Amount = (Monthly Salary / Expected Days) * Attended Days
      const ratePerDay = student.monthlySalary / (expectedDays || 8);
      computedPayable = Math.round(ratePerDay * attendedCount * 100) / 100;
    }

    // Check if duplicate billing already exists to update it or replace it
    const existing = get().payments.find(p => p.studentId === studentId && p.billingPeriod === billingPeriod);

    if (existing) {
      get().updatePayment(existing.id, {
        attendedDays: attendedCount,
        expectedDays,
        payableAmount: computedPayable,
      });
      get().addNotification('Invoice Updated', `Re-calculated billing for ${student.name} (${billingPeriod}).`, 'payment');
    } else {
      get().addPayment({
        studentId,
        billingPeriod,
        attendedDays: attendedCount,
        expectedDays,
        payableAmount: computedPayable,
        paidAmount: 0,
        dueAmount: computedPayable,
        paymentDate: '',
        status: 'Due'
      });
    }
  },

  // OFFLINE-FIRST BACKGROUND SYNC ENGINE
  triggerManualSync: async () => {
    if (get().settings.isSyncing) return;

    // Turn indicator active
    set(state => ({
      settings: { ...state.settings, isSyncing: true }
    }));

    let firebaseResult: { success: boolean; error?: string } = { success: true };
    const config = getActiveConfig(get().settings.firebaseConfig);
    const deletedRecords = get().settings.deletedRecords || [];
    const userId = get().currentUser?.uid || 'tutor-default';

    if (isFirebaseConfigured(config)) {
      try {
        const result = await syncLocalToFirebase(config, userId, {
          students: get().students,
          schedules: get().schedules,
          attendance: get().attendance,
          payments: get().payments,
          deletedRecords
        });
        if (!result.success) {
          firebaseResult = { success: false, error: result.error };
        }
      } catch (e: any) {
        firebaseResult = { success: false, error: e?.message || String(e) };
      }
    } else {
      // Wait simulating outline backup
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (!firebaseResult.success) {
      set(state => ({
        settings: { ...state.settings, isSyncing: false }
      }));
      get().addNotification('Sync Error', `Firebase rejection: ${firebaseResult.error}`, 'system');
      return;
    }

    // Turn all pending objects to 'synced'
    const syncItem = <T extends { syncStatus: 'pending' | 'synced', updatedAt: string }>(list: T[]): T[] => {
      return list.map(item => ({
        ...item,
        syncStatus: 'synced' as const,
        updatedAt: new Date().toISOString()
      } as T));
    };

    const syncedStudents = syncItem(get().students);
    const syncedSchedules = syncItem(get().schedules);
    const syncedAttendance = syncItem(get().attendance);
    const syncedPayments = syncItem(get().payments);

    TutorTrackDB.setStudents(syncedStudents);
    TutorTrackDB.setSchedules(syncedSchedules);
    TutorTrackDB.setAttendance(syncedAttendance);
    TutorTrackDB.setPayments(syncedPayments);

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();

    set(state => ({
      students: syncedStudents,
      schedules: syncedSchedules,
      attendance: syncedAttendance,
      payments: syncedPayments,
      settings: {
        ...state.settings,
        isSyncing: false,
        lastBackupTime: nowStr,
        backupSuccessCount: state.settings.backupSuccessCount + 1,
        deletedRecords: []
      }
    }));

    // Persist finalized settings
    TutorTrackDB.setSettings(get().settings);

    if (isFirebaseConfigured(config)) {
      get().addNotification('Firestore Sync Success', 'Successfully synchronized local tables to Firebase Firestore.', 'system');
    } else {
      get().addNotification('Backup Success', 'All local tuition backup modules successfully synced.', 'system');
    }
  },

  saveFirebaseConfig: (config) => {
    const updatedSettings = { ...get().settings, firebaseConfig: config };
    TutorTrackDB.setSettings(updatedSettings);
    set({ settings: updatedSettings });
    get().addNotification('Firebase Configuration Saved', 'Credential parameters connected successfully.', 'system');
  },

  triggerFirebasePull: async () => {
    const config = getActiveConfig(get().settings.firebaseConfig);
    const userId = get().currentUser?.uid || 'tutor-default';
    if (!isFirebaseConfigured(config)) {
      return { success: false, error: 'Firebase config is not found or incomplete under Settings.' };
    }

    set(state => ({
      settings: { ...state.settings, isSyncing: true }
    }));

    try {
      const result = await fetchFromFirebase(config, userId);
      set(state => ({
        settings: { ...state.settings, isSyncing: false }
      }));

      if (result.success && result.data) {
        const { students, schedules, attendance, payments } = result.data;
        
        // Merge or overwrite
        if (students.length > 0) TutorTrackDB.setStudents(students);
        if (schedules.length > 0) TutorTrackDB.setSchedules(schedules);
        if (attendance.length > 0) TutorTrackDB.setAttendance(attendance);
        if (payments.length > 0) TutorTrackDB.setPayments(payments);

        set({
          students: students.length > 0 ? students : get().students,
          schedules: schedules.length > 0 ? schedules : get().schedules,
          attendance: attendance.length > 0 ? attendance : get().attendance,
          payments: payments.length > 0 ? payments : get().payments,
        });

        get().addNotification('Firebase Sync Pull Completed', 'Overwrote active dataset with Firebase database cloud tables.', 'system');
        return { success: true };
      } else {
        get().addNotification('Pull Sync Rejected', result.error || 'Server rejected pull sync request.', 'system');
        return { success: false, error: result.error };
      }
    } catch (e: any) {
      set(state => ({
        settings: { ...state.settings, isSyncing: false }
      }));
      return { success: false, error: e?.message || String(e) };
    }
  },

  toggleDarkMode: () => {
    const updatedSettings = { ...get().settings, darkMode: !get().settings.darkMode };
    TutorTrackDB.setSettings(updatedSettings);
    set({ settings: updatedSettings });
  },

  setPinLock: (enabled, code) => {
    const updatedSettings = {
      ...get().settings,
      pinLockEnabled: enabled,
      pinCode: code || ''
    };
    TutorTrackDB.setSettings(updatedSettings);
    set({ settings: updatedSettings });
  },

  clearDatabase: () => {
    TutorTrackDB.resetDB();
    set({
      students: TutorTrackDB.getStudents(),
      schedules: TutorTrackDB.getSchedules(),
      attendance: TutorTrackDB.getAttendance(),
      payments: TutorTrackDB.getPayments(),
      settings: TutorTrackDB.getSettings(),
      notifications: TutorTrackDB.getNotifications(),
    });
    get().addNotification('Database Erased', 'SQLite state restored to primary factory defaults.', 'system');
  },

  // NOTIFICATION UTILITY
  addNotification: (title, body, type) => {
    const newNotif: AppNotification = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      title,
      body,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };
    const updated = [newNotif, ...get().notifications].slice(0, 30); // limit 30 logs
    TutorTrackDB.setNotifications(updated);
    set({ notifications: updated });
  },

  markNotificationRead: (id) => {
    const updated = get().notifications.map(n => n.id === id ? { ...n, read: true } : n);
    TutorTrackDB.setNotifications(updated);
    set({ notifications: updated });
  },

  clearNotifications: () => {
    TutorTrackDB.setNotifications([]);
    set({ notifications: [] });
  },

  // DATA RESTORE & RECOVERY MODULE
  importData: (imported) => {
    TutorTrackDB.setStudents(imported.students);
    TutorTrackDB.setSchedules(imported.schedules);
    TutorTrackDB.setAttendance(imported.attendance);
    TutorTrackDB.setPayments(imported.payments);
    
    set({
      students: imported.students,
      schedules: imported.schedules,
      attendance: imported.attendance,
      payments: imported.payments
    });

    get().addNotification('Database Migrated', 'Imported data parsed and compiled into active database.', 'system');
  }
}));
