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
}

export interface AppSettings {
  darkMode: boolean;
  pinLockEnabled: boolean;
  pinCode: string;
  biometricLockEnabled: boolean;
  lastBackupTime: string;
  isSyncing: boolean;
  backupSuccessCount: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'schedule' | 'payment' | 'attendance' | 'system';
  timestamp: string;
  read: boolean;
}
