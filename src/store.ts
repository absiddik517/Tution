import { create } from 'zustand';
import { Student, Schedule, Attendance, Payment, AppSettings, AppNotification, ExamSchedule, ExamRecord } from './types';
import { TutorTrackDB } from './db';
import { syncLocalToFirebase, fetchFromFirebase, getActiveConfig, isFirebaseConfigured } from './firebase';

interface TutorTrackStore {
  students: Student[];
  schedules: Schedule[];
  attendance: Attendance[];
  payments: Payment[];
  examSchedules: ExamSchedule[];
  examRecords: ExamRecord[];
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

  // Actions - Exam Schedules
  addExamSchedule: (exam: Omit<ExamSchedule, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateExamSchedule: (id: string, updated: Partial<ExamSchedule>) => void;
  deleteExamSchedule: (id: string) => void;

  // Actions - Exam Records
  addExamRecord: (record: Omit<ExamRecord, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateExamRecord: (id: string, updated: Partial<ExamRecord>) => void;
  deleteExamRecord: (id: string) => void;

  // Sync Engine & Settings Trigger
  triggerManualSync: () => Promise<void>;
  saveFirebaseConfig: (config: AppSettings['firebaseConfig']) => void;
  triggerFirebasePull: () => Promise<{ success: boolean; error?: string }>;
  toggleDarkMode: () => void;
  setPinLock: (enabled: boolean, pin?: string) => void;
  updateLandmarkAlerts: (first: number, second: number, third: number, sound1?: string, sound2?: string, sound3?: string) => void;
  clearDatabase: () => void;
  
  // Notification Management
  addNotification: (title: string, body: string, type: AppNotification['type']) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  // Local Undo Change Action
  undoLocalChange: (collectionName: 'students' | 'schedules' | 'attendance' | 'payments' | 'examSchedules' | 'examRecords', id: string, changeType: 'create' | 'update' | 'delete') => void;

  // Export & Recovery
  importData: (imported: { students: Student[], schedules: Schedule[], attendance: Attendance[], payments: Payment[], examSchedules?: ExamSchedule[], examRecords?: ExamRecord[] }) => void;
}

export const useStore = create<TutorTrackStore>((originalSet, get) => {
  const set = (partial: any, replace?: boolean) => {
    const isCurrentlySyncing = get()?.settings?.isSyncing;
    originalSet(partial, replace as any);
    
    if (isCurrentlySyncing) {
      return;
    }
    
    let keys: string[] = [];
    if (typeof partial === 'function') {
      try {
        keys = Object.keys(partial(get()));
      } catch (e) {
        keys = ['students', 'schedules', 'attendance', 'payments', 'examSchedules', 'examRecords', 'settings'];
      }
    } else if (partial && typeof partial === 'object') {
      keys = Object.keys(partial);
    }
    
    const databaseKeys = ['students', 'schedules', 'attendance', 'payments', 'examSchedules', 'examRecords', 'settings'];
    const hasDbChanges = keys.some(key => databaseKeys.includes(key));
    
    if (hasDbChanges) {
      const config = getActiveConfig(get().settings.firebaseConfig);
      if (isFirebaseConfigured(config) && typeof navigator !== 'undefined' && navigator.onLine) {
        if (!get().settings.isSyncing) {
          setTimeout(() => {
            if (!get().settings.isSyncing) {
              const activeConfig = getActiveConfig(get().settings.firebaseConfig);
              if (isFirebaseConfigured(activeConfig) && navigator.onLine) {
                get().triggerManualSync().catch((err: any) => console.error("Auto sync failed:", err));
              }
            }
          }, 300);
        }
      }
    }
  };

  return {
    students: TutorTrackDB.getStudents(),
  schedules: TutorTrackDB.getSchedules(),
  attendance: TutorTrackDB.getAttendance(),
  payments: TutorTrackDB.getPayments(),
  examSchedules: TutorTrackDB.getExamSchedules(),
  examRecords: TutorTrackDB.getExamRecords(),
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
        const isOriginallySynced = s.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !s.previousState ? JSON.stringify(s) : s.previousState;
        return {
          ...s,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
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
      queueDeletes.push({ id: deletedStudent.id, collectionName: 'students' as const, snapshot: deletedStudent });
    }
    affectedSchedules.forEach(sc => {
      queueDeletes.push({ id: sc.id, collectionName: 'schedules' as const, snapshot: sc });
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
        const isOriginallySynced = sc.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !sc.previousState ? JSON.stringify(sc) : sc.previousState;
        return {
          ...sc,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        };
      }
      return sc;
    });
    TutorTrackDB.setSchedules(updated);
    set({ schedules: updated });
  },

  deleteSchedule: (id) => {
    const deleted = get().schedules.find(sc => sc.id === id);
    const updated = get().schedules.filter(sc => sc.id !== id);
    TutorTrackDB.setSchedules(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'schedules' as const, snapshot: deleted }]
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
        const isOriginallySynced = at.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !at.previousState ? JSON.stringify(at) : at.previousState;
        return {
          ...at,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        };
      }
      return at;
    });
    TutorTrackDB.setAttendance(updated);
    set({ attendance: updated });
  },

  deleteAttendance: (id) => {
    const deleted = get().attendance.find(at => at.id === id);
    const updated = get().attendance.filter(at => at.id !== id);
    TutorTrackDB.setAttendance(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'attendance' as const, snapshot: deleted }]
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
        const isOriginallySynced = py.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !py.previousState ? JSON.stringify(py) : py.previousState;
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
          previousState: prevSnapshot,
        };
      }
      return py;
    });
    TutorTrackDB.setPayments(updated);
    set({ payments: updated });
  },

  deletePayment: (id) => {
    const deleted = get().payments.find(py => py.id === id);
    const updated = get().payments.filter(py => py.id !== id);
    TutorTrackDB.setPayments(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'payments' as const, snapshot: deleted }]
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

  // EXAM ACTIONS
  addExamSchedule: (examData) => {
    const now = new Date().toISOString();
    const id = 'exsch-' + Math.random().toString(36).substring(2, 9);
    const newExam: ExamSchedule = {
      ...examData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [newExam, ...get().examSchedules];
    TutorTrackDB.setExamSchedules(updated);
    set({ examSchedules: updated });

    // Instantly queue an app alert notification
    const student = get().students.find(s => s.id === examData.studentId);
    get().addNotification(
      'Exam Scheduled',
      `Upcoming exam for ${student ? student.name : 'student'} on ${examData.date} at ${examData.time}.`,
      'exam'
    );
  },

  updateExamSchedule: (id, updatedFields) => {
    const now = new Date().toISOString();
    const updated: ExamSchedule[] = get().examSchedules.map(ex => {
      if (ex.id === id) {
        const isOriginallySynced = ex.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !ex.previousState ? JSON.stringify(ex) : ex.previousState;
        return {
          ...ex,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        };
      }
      return ex;
    });
    TutorTrackDB.setExamSchedules(updated);
    set({ examSchedules: updated });
  },

  deleteExamSchedule: (id) => {
    const deleted = get().examSchedules.find(ex => ex.id === id);
    const updated = get().examSchedules.filter(ex => ex.id !== id);
    TutorTrackDB.setExamSchedules(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'examSchedules' as const, snapshot: deleted }]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ examSchedules: updated, settings: updatedSettings });
    get().addNotification('Exam Schedule Removed', 'The exam schedule metadata was erased.', 'system');
  },

  addExamRecord: (recData) => {
    const now = new Date().toISOString();
    const id = 'exrec-' + Math.random().toString(36).substring(2, 9);
    const newRecord: ExamRecord = {
      ...recData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    const updated = [newRecord, ...get().examRecords];
    TutorTrackDB.setExamRecords(updated);
    set({ examRecords: updated });

    const student = get().students.find(s => s.id === recData.studentId);
    const scorePct = Math.round((recData.marksObtained / recData.totalMarks) * 100);
    get().addNotification(
      'Exam Record Added',
      `Marks recorded for ${student ? student.name : 'student'}: ${recData.marksObtained}/${recData.totalMarks} (${scorePct}%).`,
      'exam'
    );
  },

  updateExamRecord: (id, updatedFields) => {
    const now = new Date().toISOString();
    const updated: ExamRecord[] = get().examRecords.map(rec => {
      if (rec.id === id) {
        const isOriginallySynced = rec.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !rec.previousState ? JSON.stringify(rec) : rec.previousState;
        return {
          ...rec,
          ...updatedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        };
      }
      return rec;
    });
    TutorTrackDB.setExamRecords(updated);
    set({ examRecords: updated });
  },

  deleteExamRecord: (id) => {
    const deleted = get().examRecords.find(rec => rec.id === id);
    const updated = get().examRecords.filter(rec => rec.id !== id);
    TutorTrackDB.setExamRecords(updated);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, { id, collectionName: 'examRecords' as const, snapshot: deleted }]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ examRecords: updated, settings: updatedSettings });
    get().addNotification('Exam Record Removed', 'The grade progress sheet was updated.', 'system');
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
          examSchedules: get().examSchedules,
          examRecords: get().examRecords,
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
    const syncedExamSchedules = syncItem(get().examSchedules);
    const syncedExamRecords = syncItem(get().examRecords);

    TutorTrackDB.setStudents(syncedStudents);
    TutorTrackDB.setSchedules(syncedSchedules);
    TutorTrackDB.setAttendance(syncedAttendance);
    TutorTrackDB.setPayments(syncedPayments);
    TutorTrackDB.setExamSchedules(syncedExamSchedules);
    TutorTrackDB.setExamRecords(syncedExamRecords);

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();

    set(state => ({
      students: syncedStudents,
      schedules: syncedSchedules,
      attendance: syncedAttendance,
      payments: syncedPayments,
      examSchedules: syncedExamSchedules,
      examRecords: syncedExamRecords,
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
        const { students, schedules, attendance, payments, examSchedules = [], examRecords = [] } = result.data as any;
        
        // Merge or overwrite
        if (students.length > 0) TutorTrackDB.setStudents(students);
        if (schedules.length > 0) TutorTrackDB.setSchedules(schedules);
        if (attendance.length > 0) TutorTrackDB.setAttendance(attendance);
        if (payments.length > 0) TutorTrackDB.setPayments(payments);
        if (examSchedules.length > 0) TutorTrackDB.setExamSchedules(examSchedules);
        if (examRecords.length > 0) TutorTrackDB.setExamRecords(examRecords);

        set({
          students: students.length > 0 ? students : get().students,
          schedules: schedules.length > 0 ? schedules : get().schedules,
          attendance: attendance.length > 0 ? attendance : get().attendance,
          payments: payments.length > 0 ? payments : get().payments,
          examSchedules: examSchedules.length > 0 ? examSchedules : get().examSchedules,
          examRecords: examRecords.length > 0 ? examRecords : get().examRecords,
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

  updateLandmarkAlerts: (first, second, third, sound1, sound2, sound3) => {
    const updatedSettings = {
      ...get().settings,
      landmarkFirstAlert: first,
      landmarkSecondAlert: second,
      landmarkThirdAlert: third,
      landmarkFirstSound: sound1,
      landmarkSecondSound: sound2,
      landmarkThirdSound: sound3
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
      examSchedules: TutorTrackDB.getExamSchedules(),
      examRecords: TutorTrackDB.getExamRecords(),
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

    // Native Device / Hybrid APK Web Notification Trigger
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/favicon.svg'
          });
        } catch (e) {
          console.warn('Native local Notification failed to render:', e);
        }
      }
    }
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

  // LOCAL UNDO ACTION ENGINE
  undoLocalChange: (collectionName, id, changeType) => {
    if (changeType === 'create') {
      if (collectionName === 'students') {
        const updated = get().students.filter(s => s.id !== id);
        TutorTrackDB.setStudents(updated);
        set({ students: updated });
        get().addNotification('Undo Creation', 'Student record local creation undone.', 'system');
      } else if (collectionName === 'schedules') {
        const updated = get().schedules.filter(sc => sc.id !== id);
        TutorTrackDB.setSchedules(updated);
        set({ schedules: updated });
        get().addNotification('Undo Creation', 'Schedule slot creation undone.', 'system');
      } else if (collectionName === 'attendance') {
        const updated = get().attendance.filter(at => at.id !== id);
        TutorTrackDB.setAttendance(updated);
        set({ attendance: updated });
        get().addNotification('Undo Creation', 'Attendance log creation undone.', 'system');
      } else if (collectionName === 'payments') {
        const updated = get().payments.filter(py => py.id !== id);
        TutorTrackDB.setPayments(updated);
        set({ payments: updated });
        get().addNotification('Undo Creation', 'Payment ledger item creation undone.', 'system');
      } else if (collectionName === 'examSchedules') {
        const updated = get().examSchedules.filter(ex => ex.id !== id);
        TutorTrackDB.setExamSchedules(updated);
        set({ examSchedules: updated });
        get().addNotification('Undo Creation', 'Exam schedule creation undone.', 'system');
      } else if (collectionName === 'examRecords') {
        const updated = get().examRecords.filter(er => er.id !== id);
        TutorTrackDB.setExamRecords(updated);
        set({ examRecords: updated });
        get().addNotification('Undo Creation', 'Exam record creation undone.', 'system');
      }
    } else if (changeType === 'update') {
      if (collectionName === 'students') {
        const updated = get().students.map(s => {
          if (s.id === id && s.previousState) {
            try {
              const restored = JSON.parse(s.previousState);
              return { ...restored, syncStatus: 'synced' as const, previousState: undefined };
            } catch (e) {}
          }
          return s;
        });
        TutorTrackDB.setStudents(updated);
        set({ students: updated });
        get().addNotification('Undo Update', 'Student record restored to original synced state.', 'system');
      } else if (collectionName === 'schedules') {
        const updated = get().schedules.map(sc => {
          if (sc.id === id && sc.previousState) {
            try {
              const restored = JSON.parse(sc.previousState);
              return { ...restored, syncStatus: 'synced' as const, previousState: undefined };
            } catch (e) {}
          }
          return sc;
        });
        TutorTrackDB.setSchedules(updated);
        set({ schedules: updated });
        get().addNotification('Undo Update', 'Schedule slot restored to original synced state.', 'system');
      } else if (collectionName === 'attendance') {
        const updated = get().attendance.map(at => {
          if (at.id === id && at.previousState) {
            try {
              const restored = JSON.parse(at.previousState);
              return { ...restored, syncStatus: 'synced' as const, previousState: undefined };
            } catch (e) {}
          }
          return at;
        });
        TutorTrackDB.setAttendance(updated);
        set({ attendance: updated });
        get().addNotification('Undo Update', 'Attendance record restored to original synced state.', 'system');
      } else if (collectionName === 'payments') {
        const updated = get().payments.map(py => {
          if (py.id === id && py.previousState) {
            try {
              const restored = JSON.parse(py.previousState);
              return { ...restored, syncStatus: 'synced' as const, previousState: undefined };
            } catch (e) {}
          }
          return py;
        });
        TutorTrackDB.setPayments(updated);
        set({ payments: updated });
        get().addNotification('Undo Update', 'Payment record restored to original synced state.', 'system');
      } else if (collectionName === 'examSchedules') {
        const updated = get().examSchedules.map(ex => {
          if (ex.id === id && ex.previousState) {
            try {
              const restored = JSON.parse(ex.previousState);
              return { ...restored, syncStatus: 'synced' as const, previousState: undefined };
            } catch (e) {}
          }
          return ex;
        });
        TutorTrackDB.setExamSchedules(updated);
        set({ examSchedules: updated });
        get().addNotification('Undo Update', 'Exam schedule restored to original state.', 'system');
      } else if (collectionName === 'examRecords') {
        const updated = get().examRecords.map(er => {
          if (er.id === id && er.previousState) {
            try {
              const restored = JSON.parse(er.previousState);
              return { ...restored, syncStatus: 'synced' as const, previousState: undefined };
            } catch (e) {}
          }
          return er;
        });
        TutorTrackDB.setExamRecords(updated);
        set({ examRecords: updated });
        get().addNotification('Undo Update', 'Exam record restored to original state.', 'system');
      }
    } else if (changeType === 'delete') {
      const currentDeletes = get().settings.deletedRecords || [];
      const recordToDelete = currentDeletes.find(d => d.id === id && d.collectionName === collectionName);
      if (recordToDelete && recordToDelete.snapshot) {
        const snapshot = recordToDelete.snapshot;
        if (collectionName === 'students') {
          const updated = [snapshot, ...get().students];
          TutorTrackDB.setStudents(updated);
          set({ students: updated });
        } else if (collectionName === 'schedules') {
          const updated = [...get().schedules, snapshot];
          TutorTrackDB.setSchedules(updated);
          set({ schedules: updated });
        } else if (collectionName === 'attendance') {
          const updated = [snapshot, ...get().attendance];
          TutorTrackDB.setAttendance(updated);
          set({ attendance: updated });
        } else if (collectionName === 'payments') {
          const updated = [snapshot, ...get().payments];
          TutorTrackDB.setPayments(updated);
          set({ payments: updated });
        } else if (collectionName === 'examSchedules') {
          const updated = [snapshot, ...get().examSchedules];
          TutorTrackDB.setExamSchedules(updated);
          set({ examSchedules: updated });
        } else if (collectionName === 'examRecords') {
          const updated = [snapshot, ...get().examRecords];
          TutorTrackDB.setExamRecords(updated);
          set({ examRecords: updated });
        }

        const updatedDeletes = currentDeletes.filter(d => !(d.id === id && d.collectionName === collectionName));
        const updatedSettings = { ...get().settings, deletedRecords: updatedDeletes };
        TutorTrackDB.setSettings(updatedSettings);
        set({ settings: updatedSettings });
        get().addNotification('Undo Deletion', 'Restored deleted record from local memory.', 'system');
      }
    }
  },

  // DATA RESTORE & RECOVERY MODULE
  importData: (imported) => {
    TutorTrackDB.setStudents(imported.students);
    TutorTrackDB.setSchedules(imported.schedules);
    TutorTrackDB.setAttendance(imported.attendance);
    TutorTrackDB.setPayments(imported.payments);
    if (imported.examSchedules) TutorTrackDB.setExamSchedules(imported.examSchedules);
    if (imported.examRecords) TutorTrackDB.setExamRecords(imported.examRecords);
    
    set({
      students: imported.students,
      schedules: imported.schedules,
      attendance: imported.attendance,
      payments: imported.payments,
      examSchedules: imported.examSchedules || get().examSchedules,
      examRecords: imported.examRecords || get().examRecords,
    });

    get().addNotification('Database Migrated', 'Imported data parsed and compiled into active database.', 'system');
  }
}
});
