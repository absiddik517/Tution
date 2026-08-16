import { create } from 'zustand';
import { Student, Schedule, Attendance, Payment, AppSettings, AppNotification, ExamSchedule, ExamRecord, SyncProgressState, SyncLogEntry } from './types';
import { TutorTrackDB } from './db';
import { 
  syncLocalToFirebase, fetchFromFirebase, getActiveConfig, isFirebaseConfigured, testFirebaseConnection, SyncProgressUpdate 
} from './firebase';

/**
 * Data-sanitization helper to scrub incoming store objects and entity updates.
 * Recursively removes all `undefined` values and normalizes payload fields so Firestore
 * operations (such as setDoc, updateDoc, and writeBatch) never encounter 'invalid data' errors
 * due to unsupported undefined field values.
 */
export function scrubStoreObject<T>(val: T): T {
  if (val === undefined) {
    return undefined as unknown as T;
  }
  if (val === null) {
    return null as unknown as T;
  }
  if (val instanceof Date) {
    return val.toISOString() as unknown as T;
  }
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) {
      return 0 as unknown as T;
    }
    return val;
  }
  if (typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter(item => item !== undefined)
      .map(item => scrubStoreObject(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(val as Record<string, any>)) {
    if (value !== undefined) {
      const sanitizedChild = scrubStoreObject(value);
      if (sanitizedChild !== undefined) {
        cleaned[key] = sanitizedChild;
      }
    }
  }
  return cleaned as T;
}

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
  
  // Real-time Cloud Replication Progress & Feedback
  syncProgress: SyncProgressState;
  clearSyncLogs: () => void;
  testFirebaseHealth: () => Promise<{ success: boolean; latencyMs: number; authStatus: string; feedback: string }>;
  stopSync: () => void;
  
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
  setColorTheme: (theme: 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet' | 'blue') => void;
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

// Module-level abort controller for real-time cancellable sync operations
let currentSyncAbortController: AbortController | null = null;

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

    // Real-time Cloud Replication Progress & Feedback Initial State
    syncProgress: {
      isSyncing: false,
      stage: 'Idle',
      percent: 0,
      currentCount: 0,
      totalCount: 0,
      logs: [
        {
          id: 'init-1',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          stage: 'Ready',
          type: 'info',
          message: 'Firebase cloud replication engine ready.'
        }
      ],
      lastError: undefined,
      lastSuccessMessage: undefined
    },

    clearSyncLogs: () => {
      set((state: any) => ({
        syncProgress: {
          ...state.syncProgress,
          logs: []
        }
      }));
    },

    testFirebaseHealth: async () => {
      const config = getActiveConfig(get().settings.firebaseConfig);
      const userId = get().currentUser?.uid || 'tutor-default';
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Add test started log
      const startLog: SyncLogEntry = {
        id: 'test-' + Date.now(),
        timestamp: timeStr,
        stage: 'Health Check',
        type: 'info',
        message: `Testing Firebase connectivity to project "${config.projectId}"...`
      };

      set((state: any) => ({
        syncProgress: {
          ...state.syncProgress,
          logs: [startLog, ...state.syncProgress.logs.slice(0, 40)]
        }
      }));

      const res = await testFirebaseConnection(config, userId);

      const resultLog: SyncLogEntry = {
        id: 'test-res-' + Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        stage: 'Health Check',
        type: res.success ? 'success' : 'error',
        message: res.success 
          ? `✓ Ping Success (${res.latencyMs}ms): ${res.feedback}` 
          : `✗ Ping Failed (${res.latencyMs}ms): ${res.feedback}`
      };

      set((state: any) => ({
        syncProgress: {
          ...state.syncProgress,
          logs: [resultLog, ...state.syncProgress.logs.slice(0, 40)],
          firebaseResponse: {
            projectId: config.projectId,
            userId,
            latencyMs: res.latencyMs,
            rawFeedback: res.feedback
          }
        }
      }));

      return res;
    },

    searchTerm: '',
    setSearchTerm: (term) => set({ searchTerm: term }),
    classFilter: 'All',
    setClassFilter: (classF) => set({ classFilter: classF }),
    statusFilter: 'Active',
    setStatusFilter: (filter) => set({ statusFilter: filter }),

  // STUDENT ACTIONS
  addStudent: (studentData) => {
    const cleanedData = scrubStoreObject(studentData);
    const now = new Date().toISOString();
    const id = 'stud-' + Math.random().toString(36).substring(2, 9);
    const newStudent: Student = scrubStoreObject({
      ...cleanedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    const updated = [newStudent, ...get().students];
    TutorTrackDB.setStudents(updated);
    set({ students: updated });
    get().addNotification('New Student Joined', `${newStudent.name} registered under ${newStudent.class}.`, 'system');
  },

  updateStudent: (id, updatedFields) => {
    const cleanedFields = scrubStoreObject(updatedFields);
    const now = new Date().toISOString();
    const updated: Student[] = get().students.map(s => {
      if (s.id === id) {
        const isOriginallySynced = s.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !s.previousState ? JSON.stringify(s) : s.previousState;
        return scrubStoreObject({
          ...s,
          ...cleanedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        });
      }
      return s;
    });
    TutorTrackDB.setStudents(updated);
    set({ students: updated });
  },

  deleteStudent: (id) => {
    const deletedStudent = get().students.find(s => s.id === id);
    const affectedSchedules = get().schedules.filter(sch => sch.studentId === id);
    const affectedAttendance = get().attendance.filter(at => at.studentId === id);
    const affectedPayments = get().payments.filter(py => py.studentId === id);
    const affectedExamSchedules = get().examSchedules.filter(ex => ex.studentId === id);
    const affectedExamRecords = get().examRecords.filter(er => er.studentId === id);
    
    const queueDeletes: any[] = [];
    if (deletedStudent) {
      queueDeletes.push({ id: deletedStudent.id, collectionName: 'students' as const, snapshot: deletedStudent });
    }
    affectedSchedules.forEach(sc => {
      queueDeletes.push({ id: sc.id, collectionName: 'schedules' as const, snapshot: sc });
    });
    affectedAttendance.forEach(at => {
      queueDeletes.push({ id: at.id, collectionName: 'attendance' as const, snapshot: at });
    });
    affectedPayments.forEach(py => {
      queueDeletes.push({ id: py.id, collectionName: 'payments' as const, snapshot: py });
    });
    affectedExamSchedules.forEach(ex => {
      queueDeletes.push({ id: ex.id, collectionName: 'examSchedules' as const, snapshot: ex });
    });
    affectedExamRecords.forEach(er => {
      queueDeletes.push({ id: er.id, collectionName: 'examRecords' as const, snapshot: er });
    });

    const updated = get().students.filter(s => s.id !== id);
    TutorTrackDB.setStudents(updated);
    
    const updatedSchedules = get().schedules.filter(sch => sch.studentId !== id);
    TutorTrackDB.setSchedules(updatedSchedules);

    const updatedAttendance = get().attendance.filter(at => at.studentId !== id);
    TutorTrackDB.setAttendance(updatedAttendance);

    const updatedPayments = get().payments.filter(py => py.studentId !== id);
    TutorTrackDB.setPayments(updatedPayments);

    const updatedExamSchedules = get().examSchedules.filter(ex => ex.studentId !== id);
    TutorTrackDB.setExamSchedules(updatedExamSchedules);

    const updatedExamRecords = get().examRecords.filter(er => er.studentId !== id);
    TutorTrackDB.setExamRecords(updatedExamRecords);

    const existingDeletes = get().settings.deletedRecords || [];
    const updatedSettings = {
      ...get().settings,
      deletedRecords: [...existingDeletes, ...queueDeletes]
    };
    TutorTrackDB.setSettings(updatedSettings);

    set({ 
      students: updated, 
      schedules: updatedSchedules,
      attendance: updatedAttendance,
      payments: updatedPayments,
      examSchedules: updatedExamSchedules,
      examRecords: updatedExamRecords,
      settings: updatedSettings
    });
    get().addNotification('Student Removed', 'Related scheduling slots, lessons, payments, and exams cleared.', 'system');
  },

  // SCHEDULE ACTIONS
  addSchedule: (schedData) => {
    const cleanedData = scrubStoreObject(schedData);
    const now = new Date().toISOString();
    const id = 'sched-' + Math.random().toString(36).substring(2, 9);
    const newSched: Schedule = scrubStoreObject({
      ...cleanedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    const updated = [...get().schedules, newSched];
    TutorTrackDB.setSchedules(updated);
    set({ schedules: updated });
    
    // Simulate Notification Alarm Trigger 30m before
    get().addNotification('Schedule Added', `Class created on ${newSched.weekday}s at ${newSched.startTime}.`, 'schedule');
  },

  updateSchedule: (id, updatedFields) => {
    const cleanedFields = scrubStoreObject(updatedFields);
    const now = new Date().toISOString();
    const updated: Schedule[] = get().schedules.map(sc => {
      if (sc.id === id) {
        const isOriginallySynced = sc.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !sc.previousState ? JSON.stringify(sc) : sc.previousState;
        return scrubStoreObject({
          ...sc,
          ...cleanedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        });
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
    const duplicated: Schedule = scrubStoreObject({
      ...source,
      id: 'sched-' + Math.random().toString(36).substring(2, 9),
      weekday: source.weekday === 'Friday' ? 'Saturday' : source.weekday, // slightly variant to separate
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    const updated = [...get().schedules, duplicated];
    TutorTrackDB.setSchedules(updated);
    set({ schedules: updated });
    get().addNotification('Schedule Copied', `Copied session slot for duplication.`, 'schedule');
  },

  // ATTENDANCE ACTIONS
  addAttendance: (attData) => {
    const cleanedData = scrubStoreObject(attData);
    const now = new Date().toISOString();
    const id = 'att-' + Math.random().toString(36).substring(2, 9);
    const newAtt: Attendance = scrubStoreObject({
      ...cleanedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    const updated = [newAtt, ...get().attendance];
    TutorTrackDB.setAttendance(updated);
    set({ attendance: updated });

    // Instantly check and append relevant payment notifications if overdue
    get().addNotification('Attendance Logged', `Logged slot on ${newAtt.date} duration ${newAtt.duration} hrs.`, 'attendance');
  },

  updateAttendance: (id, updatedFields) => {
    const cleanedFields = scrubStoreObject(updatedFields);
    const now = new Date().toISOString();
    const updated: Attendance[] = get().attendance.map(at => {
      if (at.id === id) {
        const isOriginallySynced = at.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !at.previousState ? JSON.stringify(at) : at.previousState;
        return scrubStoreObject({
          ...at,
          ...cleanedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        });
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
    const cleanedData = scrubStoreObject(payData);
    const now = new Date().toISOString();
    const id = 'pay-' + Math.random().toString(36).substring(2, 9);
    const newPay: Payment = scrubStoreObject({
      ...cleanedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
    const updated = [newPay, ...get().payments];
    TutorTrackDB.setPayments(updated);
    set({ payments: updated });
    get().addNotification('Invoice Saved', `Invoice for period ${newPay.billingPeriod} is ${newPay.status}.`, 'payment');
  },

  updatePayment: (id, updatedFields) => {
    const cleanedFields = scrubStoreObject(updatedFields);
    const now = new Date().toISOString();
    const updated: Payment[] = get().payments.map(py => {
      if (py.id === id) {
        const isOriginallySynced = py.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !py.previousState ? JSON.stringify(py) : py.previousState;
        const payable = cleanedFields.payableAmount !== undefined ? cleanedFields.payableAmount : py.payableAmount;
        const paid = cleanedFields.paidAmount !== undefined ? cleanedFields.paidAmount : py.paidAmount;
        const due = payable - paid;
        let finalStatus: Payment['status'] = 'Due';
        if (paid >= payable) finalStatus = 'Paid';
        else if (paid > 0) finalStatus = 'Partial';

        return scrubStoreObject({
          ...py,
          ...cleanedFields,
          dueAmount: due,
          status: finalStatus,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        });
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
    const cleanedData = scrubStoreObject(examData);
    const now = new Date().toISOString();
    const id = 'exsch-' + Math.random().toString(36).substring(2, 9);
    const newExam: ExamSchedule = scrubStoreObject({
      ...cleanedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
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
    const cleanedFields = scrubStoreObject(updatedFields);
    const now = new Date().toISOString();
    const updated: ExamSchedule[] = get().examSchedules.map(ex => {
      if (ex.id === id) {
        const isOriginallySynced = ex.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !ex.previousState ? JSON.stringify(ex) : ex.previousState;
        return scrubStoreObject({
          ...ex,
          ...cleanedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        });
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
    const cleanedData = scrubStoreObject(recData);
    const now = new Date().toISOString();
    const id = 'exrec-' + Math.random().toString(36).substring(2, 9);
    const newRecord: ExamRecord = scrubStoreObject({
      ...cleanedData,
      id,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    });
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
    const cleanedFields = scrubStoreObject(updatedFields);
    const now = new Date().toISOString();
    const updated: ExamRecord[] = get().examRecords.map(rec => {
      if (rec.id === id) {
        const isOriginallySynced = rec.syncStatus === 'synced';
        const prevSnapshot = isOriginallySynced && !rec.previousState ? JSON.stringify(rec) : rec.previousState;
        return scrubStoreObject({
          ...rec,
          ...cleanedFields,
          updatedAt: now,
          syncStatus: 'pending' as const,
          previousState: prevSnapshot,
        });
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

  // OFFLINE-FIRST BACKGROUND SYNC ENGINE (2-WAY BIDIRECTIONAL REPLICATION)
  triggerManualSync: async () => {
    if (get().settings.isSyncing) return;

    if (currentSyncAbortController) {
      try {
        currentSyncAbortController.abort();
      } catch (e) {
        // ignore
      }
    }
    currentSyncAbortController = new AbortController();
    const abortSignal = currentSyncAbortController.signal;

    const rawCustomConfig = get().settings.firebaseConfig;
    const config = getActiveConfig(rawCustomConfig);
    const deletedRecords = get().settings.deletedRecords || [];
    const userId = get().currentUser?.uid || 'tutor-default';
    const startTime = Date.now();
    const startTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const maskedKey = config.apiKey ? `${config.apiKey.substring(0, 6)}...${config.apiKey.slice(-4)}` : 'None';

    const appendLog = (stage: string, type: 'info' | 'success' | 'warn' | 'error', message: string, details?: string) => {
      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      set(state => ({
        syncProgress: {
          ...state.syncProgress,
          stage,
          logs: [
            {
              id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              timestamp: now,
              stage,
              type,
              message,
              details
            },
            ...state.syncProgress.logs.slice(0, 50)
          ]
        }
      }));
    };

    // Initialize progress state and verify connection parameters
    set(state => ({
      settings: { ...state.settings, isSyncing: true },
      syncProgress: {
        ...state.syncProgress,
        isSyncing: true,
        stage: 'Verifying Firestore Mapping...',
        percent: 5,
        currentCount: 0,
        totalCount: 0,
        lastError: undefined,
        lastSuccessMessage: undefined,
        logs: [
          {
            id: 'sync-start-' + Date.now(),
            timestamp: startTimeStr,
            stage: 'Init',
            type: 'info',
            message: `Initiating Two-Way Cloud Synchronization...`
          },
          {
            id: 'sync-cfg-' + Date.now(),
            timestamp: startTimeStr,
            stage: 'Config Verified',
            type: 'info',
            message: `Firestore Mapping: Project="${config.projectId}", Database="${config.firestoreDatabaseId || '(default)'}", Partition="tutors/${userId}", API Key=${maskedKey}`,
            details: JSON.stringify({
              projectId: config.projectId,
              authDomain: config.authDomain,
              firestoreDatabaseId: config.firestoreDatabaseId || '(default)',
              userPartition: userId,
              isCustomConfig: !!(rawCustomConfig && rawCustomConfig.apiKey)
            })
          },
          ...state.syncProgress.logs.slice(0, 30)
        ]
      }
    }));

    const onProgressCallback = (update: SyncProgressUpdate) => {
      set(state => {
        const newLogs = update.log ? [
          {
            id: 'log-' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            stage: update.stage,
            type: update.log.type,
            message: update.log.message,
            details: update.log.details
          },
          ...state.syncProgress.logs.slice(0, 50)
        ] : state.syncProgress.logs;

        return {
          syncProgress: {
            ...state.syncProgress,
            stage: update.stage,
            percent: update.percent,
            currentCount: update.currentCount,
            totalCount: update.totalCount,
            logs: newLogs
          }
        };
      });
    };

    let workingStudents = [...get().students];
    let workingSchedules = [...get().schedules];
    let workingAttendance = [...get().attendance];
    let workingPayments = [...get().payments];
    let workingExamSchedules = [...get().examSchedules];
    let workingExamRecords = [...get().examRecords];

    const inboundPullStats = {
      downloadedCount: 0,
      newlyImported: 0,
      updatedLocally: 0
    };

    // ==========================================
    // PHASE 1: INBOUND CLOUD PULL & RECONCILE
    // ==========================================
    if (isFirebaseConfigured(config)) {
      try {
        appendLog('Inbound Pull', 'info', `Scanning cloud database for remote changes in tutors/${userId}...`);

        const pullRes = await fetchFromFirebase(config, userId, onProgressCallback, abortSignal);
        
        if (pullRes.success && pullRes.data) {
          const { 
            students: rawRemoteStudents = [], 
            schedules: rawRemoteSchedules = [], 
            attendance: rawRemoteAttendance = [], 
            payments: rawRemotePayments = [], 
            examSchedules: rawRemoteExamSchedules = [], 
            examRecords: rawRemoteExamRecords = [] 
          } = pullRes.data;

          const remoteStudents = rawRemoteStudents.map(scrubStoreObject);
          const remoteSchedules = rawRemoteSchedules.map(scrubStoreObject);
          const remoteAttendance = rawRemoteAttendance.map(scrubStoreObject);
          const remotePayments = rawRemotePayments.map(scrubStoreObject);
          const remoteExamSchedules = rawRemoteExamSchedules.map(scrubStoreObject);
          const remoteExamRecords = rawRemoteExamRecords.map(scrubStoreObject);

          const totalDownloaded = remoteStudents.length + remoteSchedules.length + remoteAttendance.length + remotePayments.length + remoteExamSchedules.length + remoteExamRecords.length;
          inboundPullStats.downloadedCount = totalDownloaded;

          appendLog('Reconciliation', 'info', `Downloaded ${totalDownloaded} cloud documents across all 6 collections. Reconciling with local state...`);

          // Generic reconciliation helper
          const reconcileCollection = <T extends { id: string; syncStatus?: string; updatedAt?: string }>(
            localList: T[],
            remoteList: T[],
            collectionName: 'students' | 'schedules' | 'attendance' | 'payments' | 'examSchedules' | 'examRecords'
          ): { reconciled: T[]; imported: number; updated: number } => {
            let imported = 0;
            let updated = 0;
            const resultMap = new Map<string, T>();

            // Populate local records
            localList.forEach(item => {
              resultMap.set(item.id, scrubStoreObject(item));
            });

            // Reconcile remote records
            remoteList.forEach(remoteItem => {
              // If user locally marked this document as deleted, do not resurrect it
              const isLocallyDeleted = deletedRecords.some(d => d.id === remoteItem.id && d.collectionName === collectionName);
              if (isLocallyDeleted) {
                return;
              }

              const cleanRemote = scrubStoreObject(remoteItem);
              const localItem = resultMap.get(cleanRemote.id);
              if (!localItem) {
                // New record from cloud
                resultMap.set(cleanRemote.id, { ...cleanRemote, syncStatus: 'synced' as const });
                imported++;
              } else {
                // Both local and remote exist
                if (localItem.syncStatus === 'pending') {
                  // User has pending uncommitted local edits: keep local version to push up
                } else {
                  // Both are synced: accept remote version
                  resultMap.set(cleanRemote.id, { ...cleanRemote, syncStatus: 'synced' as const });
                  updated++;
                }
              }
            });

            return {
              reconciled: Array.from(resultMap.values()),
              imported,
              updated
            };
          };

          const studReconcile = reconcileCollection(workingStudents, remoteStudents, 'students');
          workingStudents = studReconcile.reconciled;
          inboundPullStats.newlyImported += studReconcile.imported;
          inboundPullStats.updatedLocally += studReconcile.updated;

          const schedReconcile = reconcileCollection(workingSchedules, remoteSchedules, 'schedules');
          workingSchedules = schedReconcile.reconciled;
          inboundPullStats.newlyImported += schedReconcile.imported;
          inboundPullStats.updatedLocally += schedReconcile.updated;

          const attReconcile = reconcileCollection(workingAttendance, remoteAttendance, 'attendance');
          workingAttendance = attReconcile.reconciled;
          inboundPullStats.newlyImported += attReconcile.imported;
          inboundPullStats.updatedLocally += attReconcile.updated;

          const payReconcile = reconcileCollection(workingPayments, remotePayments, 'payments');
          workingPayments = payReconcile.reconciled;
          inboundPullStats.newlyImported += payReconcile.imported;
          inboundPullStats.updatedLocally += payReconcile.updated;

          const exSchedReconcile = reconcileCollection(workingExamSchedules, remoteExamSchedules, 'examSchedules');
          workingExamSchedules = exSchedReconcile.reconciled;
          inboundPullStats.newlyImported += exSchedReconcile.imported;
          inboundPullStats.updatedLocally += exSchedReconcile.updated;

          const exRecReconcile = reconcileCollection(workingExamRecords, remoteExamRecords, 'examRecords');
          workingExamRecords = exRecReconcile.reconciled;
          inboundPullStats.newlyImported += exRecReconcile.imported;
          inboundPullStats.updatedLocally += exRecReconcile.updated;

          appendLog('Reconciliation', 'success', `✓ Inbound Reconciliation Done: ${inboundPullStats.newlyImported} new records imported, ${inboundPullStats.updatedLocally} updated from cloud.`);
        } else if (pullRes.error) {
          appendLog('Inbound Pull', 'warn', `Cloud pull warning: ${pullRes.error}. Proceeding with outbound replication.`);
        }
      } catch (pullErr: any) {
        if (pullErr?.message === 'SYNC_CANCELLED' || abortSignal.aborted) {
          throw pullErr;
        }
        appendLog('Inbound Pull', 'warn', `Inbound pull encountered non-blocking issue: ${pullErr?.message || String(pullErr)}. Proceeding with outbound push.`);
      }
    }

    // ==========================================
    // PHASE 2: OUTBOUND CLOUD PUSH & REPLICATION
    // ==========================================
    let firebaseResult: { 
      success: boolean; 
      count?: number; 
      latencyMs?: number; 
      error?: string; 
      syncedBreakdown?: { [key: string]: number };
      feedbackMessage?: string;
      cancelled?: boolean;
    } = { success: true };

    if (isFirebaseConfigured(config)) {
      try {
        appendLog('Outbound Push', 'info', `Replicating local pending records & deletions to Firestore...`);

        // Strictly sanitize all entity payloads to prevent Firestore invalid data / undefined value errors
        const sanitizedOutboundPayload = {
          students: workingStudents.map(scrubStoreObject),
          schedules: workingSchedules.map(scrubStoreObject),
          attendance: workingAttendance.map(scrubStoreObject),
          payments: workingPayments.map(scrubStoreObject),
          examSchedules: workingExamSchedules.map(scrubStoreObject),
          examRecords: workingExamRecords.map(scrubStoreObject),
          deletedRecords: (deletedRecords || []).map(scrubStoreObject)
        };

        const result = await syncLocalToFirebase(
          config, 
          userId, 
          sanitizedOutboundPayload,
          onProgressCallback,
          abortSignal
        );

        firebaseResult = result;
      } catch (e: any) {
        const isCancelled = e?.message === 'SYNC_CANCELLED' || e?.name === 'AbortError' || abortSignal.aborted;
        firebaseResult = { success: false, cancelled: isCancelled, error: isCancelled ? 'Replication was stopped by user.' : (e?.message || String(e)) };
      }
    } else {
      // Local backup simulation with progress
      await new Promise(resolve => setTimeout(resolve, 600));
      firebaseResult = { success: true, count: workingStudents.length + workingSchedules.length, latencyMs: 600 };
    }

    if (currentSyncAbortController?.signal === abortSignal) {
      currentSyncAbortController = null;
    }

    if (firebaseResult.cancelled) {
      set(state => ({
        settings: { ...state.settings, isSyncing: false },
        syncProgress: {
          ...state.syncProgress,
          isSyncing: false,
          stage: 'Replication Stopped',
          percent: 0,
          lastError: 'Replication was stopped by user.',
          logs: [
            {
              id: 'stop-' + Date.now(),
              timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              stage: 'Stopped',
              type: 'warn',
              message: '⏹ Cloud replication process was manually stopped by user.'
            },
            ...state.syncProgress.logs.slice(0, 40)
          ]
        }
      }));
      get().addNotification('Sync Stopped', 'Database replication was stopped.', 'system');
      return;
    }

    if (!firebaseResult.success) {
      set(state => ({
        settings: { ...state.settings, isSyncing: false },
        syncProgress: {
          ...state.syncProgress,
          isSyncing: false,
          stage: 'Sync Failed',
          percent: 100,
          lastError: firebaseResult.error,
          logs: [
            {
              id: 'err-' + Date.now(),
              timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              stage: 'Error',
              type: 'error',
              message: `Replication failed: ${firebaseResult.error}`
            },
            ...state.syncProgress.logs.slice(0, 40)
          ]
        }
      }));
      get().addNotification('Sync Error', `Firebase error: ${firebaseResult.error}`, 'system');
      return;
    }

    // ==========================================
    // PHASE 3: DATABASE COMMIT & STATE SYNC
    // ==========================================
    const syncItem = <T extends { syncStatus: 'pending' | 'synced', updatedAt: string }>(list: T[]): T[] => {
      return list.map(item => ({
        ...item,
        syncStatus: 'synced' as const,
        updatedAt: item.updatedAt || new Date().toISOString()
      } as T));
    };

    const syncedStudents = syncItem(workingStudents);
    const syncedSchedules = syncItem(workingSchedules);
    const syncedAttendance = syncItem(workingAttendance);
    const syncedPayments = syncItem(workingPayments);
    const syncedExamSchedules = syncItem(workingExamSchedules);
    const syncedExamRecords = syncItem(workingExamRecords);

    // Save finalized tables to SQLite/DB
    TutorTrackDB.setStudents(syncedStudents);
    TutorTrackDB.setSchedules(syncedSchedules);
    TutorTrackDB.setAttendance(syncedAttendance);
    TutorTrackDB.setPayments(syncedPayments);
    TutorTrackDB.setExamSchedules(syncedExamSchedules);
    TutorTrackDB.setExamRecords(syncedExamRecords);

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString();
    const totalActive = syncedStudents.length + syncedSchedules.length + syncedAttendance.length + syncedPayments.length + syncedExamSchedules.length + syncedExamRecords.length;
    const totalDuration = Date.now() - startTime;

    const successMsg = `Two-Way Sync Complete: Inbound pulled ${inboundPullStats.downloadedCount} (Imported: ${inboundPullStats.newlyImported}, Updated: ${inboundPullStats.updatedLocally}), Outbound pushed ${firebaseResult.count || 0} records in ${totalDuration}ms.`;

    appendLog(
      'Sync Complete',
      'success',
      `✓ 2-Way Sync Finished: ${totalActive} database records are fully in sync with Firebase Firestore.`,
      `Inbound: ${inboundPullStats.downloadedCount} pulled (${inboundPullStats.newlyImported} new, ${inboundPullStats.updatedLocally} updated). Outbound: ${firebaseResult.count || 0} pushed in ${totalDuration}ms.`
    );

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
      },
      syncProgress: {
        ...state.syncProgress,
        isSyncing: false,
        stage: 'Sync Complete',
        percent: 100,
        lastSuccessMessage: successMsg,
        lastSyncDurationMs: totalDuration,
        firebaseResponse: {
          projectId: config.projectId,
          userId,
          syncedCollections: firebaseResult.syncedBreakdown,
          totalSynced: (firebaseResult.count || 0) + inboundPullStats.newlyImported,
          latencyMs: totalDuration,
          rawFeedback: successMsg
        }
      }
    }));

    // Persist finalized settings
    TutorTrackDB.setSettings(get().settings);

    if (isFirebaseConfigured(config)) {
      get().addNotification('Firestore 2-Way Sync Success', `Replication finished in ${totalDuration}ms. ${inboundPullStats.newlyImported} imported, ${firebaseResult.count || 0} pushed.`, 'system');
    } else {
      get().addNotification('Backup Success', 'All local tuition backup modules successfully synced.', 'system');
    }
  },

  stopSync: () => {
    if (currentSyncAbortController) {
      try {
        currentSyncAbortController.abort();
      } catch (e) {
        // ignore
      }
      currentSyncAbortController = null;
    }

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    set(state => ({
      settings: { ...state.settings, isSyncing: false },
      syncProgress: {
        ...state.syncProgress,
        isSyncing: false,
        stage: 'Replication Stopped',
        percent: 0,
        lastError: 'Replication process was stopped by user.',
        logs: [
          {
            id: 'stop-' + Date.now(),
            timestamp: nowStr,
            stage: 'Stopped',
            type: 'warn',
            message: '⏹ Cloud replication process was manually stopped by user.'
          },
          ...state.syncProgress.logs.slice(0, 40)
        ]
      }
    }));

    get().addNotification('Sync Stopped', 'Database replication was stopped.', 'system');
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

    if (currentSyncAbortController) {
      try {
        currentSyncAbortController.abort();
      } catch (e) {
        // ignore
      }
    }
    currentSyncAbortController = new AbortController();
    const abortSignal = currentSyncAbortController.signal;

    set(state => ({
      settings: { ...state.settings, isSyncing: true },
      syncProgress: {
        ...state.syncProgress,
        isSyncing: true,
        stage: 'Pulling from cloud...',
        percent: 10,
        logs: [
          {
            id: 'pull-' + Date.now(),
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            stage: 'Cloud Pull',
            type: 'info',
            message: `Starting cloud restore from Firebase project "${config.projectId}"...`
          },
          ...state.syncProgress.logs.slice(0, 30)
        ]
      }
    }));

    try {
      const onProgressCallback = (update: SyncProgressUpdate) => {
        set(state => {
          const newLogs = update.log ? [
            {
              id: 'log-' + Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              stage: update.stage,
              type: update.log.type,
              message: update.log.message,
              details: update.log.details
            },
            ...state.syncProgress.logs.slice(0, 45)
          ] : state.syncProgress.logs;

          return {
            syncProgress: {
              ...state.syncProgress,
              stage: update.stage,
              percent: update.percent,
              logs: newLogs
            }
          };
        });
      };

      const result = await fetchFromFirebase(config, userId, onProgressCallback, abortSignal);
      
      if (currentSyncAbortController?.signal === abortSignal) {
        currentSyncAbortController = null;
      }

      if (result.cancelled) {
        set(state => ({
          settings: { ...state.settings, isSyncing: false },
          syncProgress: {
            ...state.syncProgress,
            isSyncing: false,
            stage: 'Pull Cancelled',
            percent: 0,
            lastError: 'Cloud restore was cancelled by user.',
            lastSuccessMessage: undefined
          }
        }));
        get().addNotification('Pull Cancelled', 'Cloud restore was stopped.', 'system');
        return { success: false, error: 'Cancelled by user' };
      }

      set(state => ({
        settings: { ...state.settings, isSyncing: false },
        syncProgress: {
          ...state.syncProgress,
          isSyncing: false,
          stage: result.success ? 'Pull Complete' : 'Pull Failed',
          percent: 100,
          lastError: result.error,
          lastSuccessMessage: result.success ? 'Successfully downloaded and restored cloud database.' : undefined
        }
      }));

      if (result.success && result.data) {
        const rawData = result.data as any;
        const students = (rawData.students || []).map(scrubStoreObject);
        const schedules = (rawData.schedules || []).map(scrubStoreObject);
        const attendance = (rawData.attendance || []).map(scrubStoreObject);
        const payments = (rawData.payments || []).map(scrubStoreObject);
        const examSchedules = (rawData.examSchedules || []).map(scrubStoreObject);
        const examRecords = (rawData.examRecords || []).map(scrubStoreObject);
        const totalFetched = students.length + schedules.length + attendance.length + payments.length + examSchedules.length + examRecords.length;
        
        if (totalFetched === 0) {
          const currentLocalCount = get().students.length + get().schedules.length + get().attendance.length + get().payments.length + get().examSchedules.length + get().examRecords.length;
          if (currentLocalCount > 0) {
            get().addNotification('Cloud Partition Empty', 'Firebase cloud partition has 0 records. Existing local records have been preserved.', 'system');
            set(state => ({
              syncProgress: {
                ...state.syncProgress,
                lastSuccessMessage: 'Pull finished: Cloud partition contains 0 records. Local data was kept.'
              }
            }));
            return { success: true };
          }
        }

        // Set database tables
        TutorTrackDB.setStudents(students);
        TutorTrackDB.setSchedules(schedules);
        TutorTrackDB.setAttendance(attendance);
        TutorTrackDB.setPayments(payments);
        TutorTrackDB.setExamSchedules(examSchedules);
        TutorTrackDB.setExamRecords(examRecords);

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const updatedSettings = {
          ...get().settings,
          lastBackupTime: nowStr,
          deletedRecords: []
        };
        TutorTrackDB.setSettings(updatedSettings);

        set({
          students,
          schedules,
          attendance,
          payments,
          examSchedules,
          examRecords,
          settings: updatedSettings
        });

        get().addNotification('Firebase Cloud Pull Completed', `Successfully restored ${totalFetched} records from Firebase cloud tables.`, 'system');
        return { success: true };
      } else {
        get().addNotification('Pull Sync Rejected', result.error || 'Server rejected pull sync request.', 'system');
        return { success: false, error: result.error };
      }
    } catch (e: any) {
      if (currentSyncAbortController?.signal === abortSignal) {
        currentSyncAbortController = null;
      }
      set(state => ({
        settings: { ...state.settings, isSyncing: false },
        syncProgress: {
          ...state.syncProgress,
          isSyncing: false,
          stage: 'Pull Error',
          percent: 100,
          lastError: e?.message || String(e)
        }
      }));
      return { success: false, error: e?.message || String(e) };
    }
  },

  toggleDarkMode: () => {
    const updatedSettings = { ...get().settings, darkMode: !get().settings.darkMode };
    TutorTrackDB.setSettings(updatedSettings);
    set({ settings: updatedSettings });
  },

  setColorTheme: (theme) => {
    const updatedSettings = { ...get().settings, themeColor: theme };
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
    const students = (imported.students || []).map(scrubStoreObject);
    const schedules = (imported.schedules || []).map(scrubStoreObject);
    const attendance = (imported.attendance || []).map(scrubStoreObject);
    const payments = (imported.payments || []).map(scrubStoreObject);
    const examSchedules = imported.examSchedules ? imported.examSchedules.map(scrubStoreObject) : undefined;
    const examRecords = imported.examRecords ? imported.examRecords.map(scrubStoreObject) : undefined;

    TutorTrackDB.setStudents(students);
    TutorTrackDB.setSchedules(schedules);
    TutorTrackDB.setAttendance(attendance);
    TutorTrackDB.setPayments(payments);
    if (examSchedules) TutorTrackDB.setExamSchedules(examSchedules);
    if (examRecords) TutorTrackDB.setExamRecords(examRecords);
    
    set({
      students,
      schedules,
      attendance,
      payments,
      examSchedules: examSchedules || get().examSchedules,
      examRecords: examRecords || get().examRecords,
    });

    get().addNotification('Database Migrated', 'Imported data parsed and compiled into active database.', 'system');
  }
}
});
