export interface Student {
  id: string;
  name: string;
  class: string;
  subjects: string[];
  phone: string;
  paymentCycle: 'Monthly' | 'Weekly' | '12 Days' | 'Custom';
  monthlySalary: number;
  startDate: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
  previousState?: string;
}

export interface Schedule {
  id: string;
  studentId: string;
  weekday: 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location: string;
  subject: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
  previousState?: string;
  sessionStatus?: 'idle' | 'running' | 'completed';
  sessionDate?: string; // YYYY-MM-DD
  sessionStartedAt?: string; // ISO string when running
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  entryAt: string; // HH:MM
  exitAt: string; // HH:MM
  duration: number; // in hours
  remarks: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
  previousState?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  billingPeriod: string; // e.g., "June 2026"
  attendedDays: number;
  expectedDays: number;
  payableAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentDate: string; // YYYY-MM-DD or empty
  status: 'Paid' | 'Partial' | 'Due';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
  previousState?: string;
}

export interface DeletedRecord {
  id: string;
  collectionName: 'students' | 'schedules' | 'attendance' | 'payments' | 'examSchedules' | 'examRecords';
  snapshot?: any;
}

export interface AppSettings {
  darkMode: boolean;
  pinLockEnabled: boolean;
  pinCode: string;
  biometricLockEnabled: boolean;
  lastBackupTime: string;
  isSyncing: boolean;
  backupSuccessCount: number;
  landmarkFirstAlert?: number;
  landmarkSecondAlert?: number;
  landmarkThirdAlert?: number;
  landmarkFirstSound?: string;
  landmarkSecondSound?: string;
  landmarkThirdSound?: string;
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    firestoreDatabaseId?: string;
  };
  deletedRecords?: DeletedRecord[];
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'schedule' | 'payment' | 'attendance' | 'system' | 'exam';
  timestamp: string;
  read: boolean;
}

export interface ExamSchedule {
  id: string;
  studentId: string;
  subject: string;
  topic: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  totalMarks: number;
  reminderMinutes: number; // e.g., 30, 60, 1440 (1 day)
  reminderSent?: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
  previousState?: string;
}

export interface ExamRecord {
  id: string;
  studentId: string;
  examScheduleId?: string; // Optional link to schedule
  subject: string;
  topic: string;
  date: string; // YYYY-MM-DD
  totalMarks: number;
  marksObtained: number;
  remarks: string;
  status: 'Passed' | 'Failed' | 'Awaiting' | 'Absent';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'pending' | 'synced';
  previousState?: string;
}
