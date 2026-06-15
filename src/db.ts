import { Student, Schedule, Attendance, Payment, AppSettings, AppNotification } from './types';

// Default initial mock data
const DEFAULT_STUDENTS: Student[] = [
  {
    id: 'stud-1',
    name: 'Arif Rahman',
    class: 'Class 10 (SSC)',
    subjects: ['Mathematics', 'Physics'],
    phone: '01711223344',
    paymentCycle: 'Monthly',
    monthlySalary: 6000,
    startDate: '2026-05-01',
    status: 'Active',
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'stud-2',
    name: 'Tanim Ahmed',
    class: 'Class 12 (HSC)',
    subjects: ['Chemistry', 'English'],
    phone: '+8801811223344',
    paymentCycle: 'Monthly',
    monthlySalary: 8000,
    startDate: '2026-05-10',
    status: 'Active',
    createdAt: '2026-05-10T11:00:00Z',
    updatedAt: '2026-05-10T11:00:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'stud-3',
    name: 'Nabila Islam',
    class: 'Class 8 (JSC)',
    subjects: ['General Science', 'General Math'],
    phone: '01911223344',
    paymentCycle: 'Weekly',
    monthlySalary: 1500, // weekly rate
    startDate: '2026-05-15',
    status: 'Active',
    createdAt: '2026-05-15T09:00:00Z',
    updatedAt: '2026-05-15T09:00:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'stud-4',
    name: 'Sajid Hasan',
    class: 'Class 9',
    subjects: ['Biology'],
    phone: '01511223344',
    paymentCycle: '12 Days',
    monthlySalary: 3000,
    startDate: '2026-04-10',
    status: 'Inactive',
    createdAt: '2026-04-10T14:30:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
    syncStatus: 'synced',
  }
];

const DEFAULT_SCHEDULES: Schedule[] = [
  {
    id: 'sched-1',
    studentId: 'stud-1',
    weekday: 'Saturday',
    startTime: '15:00',
    endTime: '16:30',
    location: 'Home Tuition',
    subject: 'Mathematics',
    remarks: 'Focus on geometry proofs',
    createdAt: '2026-05-01T10:15:00Z',
    updatedAt: '2026-05-01T10:15:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'sched-2',
    studentId: 'stud-1',
    weekday: 'Wednesday',
    startTime: '16:00',
    endTime: '17:30',
    location: 'Home Tuition',
    subject: 'Physics',
    remarks: 'Newtonian mechanics quiz prep',
    createdAt: '2026-05-01T10:18:00Z',
    updatedAt: '2026-05-01T10:18:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'sched-3',
    studentId: 'stud-2',
    weekday: 'Sunday',
    startTime: '14:00',
    endTime: '15:30',
    location: 'Coaching Center Room B',
    subject: 'Chemistry',
    remarks: 'Organic nomenclature chapter exam',
    createdAt: '2026-05-10T11:20:00Z',
    updatedAt: '2026-05-10T11:20:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'sched-4',
    studentId: 'stud-2',
    weekday: 'Tuesday',
    startTime: '17:00',
    endTime: '18:30',
    location: 'Online via Zoom',
    subject: 'English Literature',
    remarks: 'Hamlet act 3 review',
    createdAt: '2026-05-10T11:22:00Z',
    updatedAt: '2026-05-10T11:22:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'sched-5',
    studentId: 'stud-3',
    weekday: 'Monday',
    startTime: '15:30',
    endTime: '17:00',
    location: 'Home Tuition',
    subject: 'Algebra',
    remarks: 'Linear equations practice',
    createdAt: '2026-05-15T09:10:00Z',
    updatedAt: '2026-05-15T09:10:00Z',
    syncStatus: 'synced',
  }
];

const DEFAULT_ATTENDANCE: Attendance[] = [
  // First week of June 2026 attendance
  {
    id: 'att-1',
    studentId: 'stud-1',
    date: '2026-06-06', // Saturday
    entryAt: '15:00',
    exitAt: '16:30',
    duration: 1.5,
    remarks: 'Completed coordinate geometry chapter.',
    createdAt: '2026-06-06T16:35:00Z',
    updatedAt: '2026-06-06T16:35:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'att-2',
    studentId: 'stud-2',
    date: '2026-06-07', // Sunday
    entryAt: '14:00',
    exitAt: '15:30',
    duration: 1.5,
    remarks: 'Excellent progress on stereochemistry.',
    createdAt: '2026-06-07T15:32:00Z',
    updatedAt: '2026-06-07T15:32:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'att-3',
    studentId: 'stud-3',
    date: '2026-06-08', // Monday
    entryAt: '15:30',
    exitAt: '17:00',
    duration: 1.5,
    remarks: 'Practiced system of equations.',
    createdAt: '2026-06-08T17:05:00Z',
    updatedAt: '2026-06-08T17:05:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'att-4',
    studentId: 'stud-1',
    date: '2026-06-10', // Wednesday
    entryAt: '16:03',
    exitAt: '17:35',
    duration: 1.53,
    remarks: 'Solved relative motion numericals.',
    createdAt: '2026-06-10T17:40:00Z',
    updatedAt: '2026-06-10T17:40:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'att-5',
    studentId: 'stud-2',
    date: '2026-06-14', // Sunday
    entryAt: '14:05',
    exitAt: '15:40',
    duration: 1.58,
    remarks: 'Detailed character analysis test.',
    createdAt: '2026-06-14T15:45:00Z',
    updatedAt: '2026-06-14T15:45:00Z',
    syncStatus: 'synced',
  }
];

const DEFAULT_PAYMENTS: Payment[] = [
  // May billing cycle (Fully Paid)
  {
    id: 'pay-1',
    studentId: 'stud-1',
    billingPeriod: 'May 2026',
    attendedDays: 8,
    expectedDays: 8,
    payableAmount: 6000,
    paidAmount: 6000,
    dueAmount: 0,
    paymentDate: '2026-05-30',
    status: 'Paid',
    createdAt: '2026-05-30T18:00:00Z',
    updatedAt: '2026-05-30T18:00:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'pay-2',
    studentId: 'stud-2',
    billingPeriod: 'May 2026',
    attendedDays: 6,
    expectedDays: 6,
    payableAmount: 8000,
    paidAmount: 8000,
    dueAmount: 0,
    paymentDate: '2026-05-31',
    status: 'Paid',
    createdAt: '2026-05-31T20:00:00Z',
    updatedAt: '2026-05-31T20:00:00Z',
    syncStatus: 'synced',
  },
  // June partial/pending lists
  {
    id: 'pay-3',
    studentId: 'stud-1',
    billingPeriod: 'June 2026',
    attendedDays: 2,
    expectedDays: 8,
    payableAmount: 6000,
    paidAmount: 2500,
    dueAmount: 3500,
    paymentDate: '2026-06-12',
    status: 'Partial',
    createdAt: '2026-06-11T12:00:00Z',
    updatedAt: '2026-06-12T14:00:00Z',
    syncStatus: 'synced',
  },
  {
    id: 'pay-4',
    studentId: 'stud-2',
    billingPeriod: 'June 2026',
    attendedDays: 2,
    expectedDays: 8,
    payableAmount: 8000,
    paidAmount: 0,
    dueAmount: 8000,
    paymentDate: '',
    status: 'Due',
    createdAt: '2026-06-11T12:00:00Z',
    updatedAt: '2026-06-11T12:00:00Z',
    syncStatus: 'synced',
  }
];

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  pinLockEnabled: false,
  pinCode: '',
  biometricLockEnabled: false,
  lastBackupTime: '2026-06-14 22:30',
  isSyncing: false,
  backupSuccessCount: 42,
};

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'Upcoming Tuition Reminder',
    body: 'In 30 minutes: Math session with Nabila Islam at Home.',
    type: 'schedule',
    timestamp: '2026-06-15T15:00:00Z',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Outstanding Due Alert',
    body: 'Tanim Ahmed has a pending invoice of ৳8000 for the billing cycle June 2026.',
    type: 'payment',
    timestamp: '2026-06-13T09:00:00Z',
    read: true,
  },
  {
    id: 'notif-3',
    title: 'Attendance Logging Request',
    body: 'Physics session with Arif Rahman on Tuesday had no attendance parsed.',
    type: 'attendance',
    timestamp: '2026-06-10T18:00:00Z',
    read: false,
  }
];

// Helper to interact with LocalStorage mirroring SQLite
const getStored = <T>(key: string, orDefault: T): T => {
  const v = localStorage.getItem(key);
  if (!v) return orDefault;
  try {
    return JSON.parse(v) as T;
  } catch (e) {
    return orDefault;
  }
};

const setStored = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const TutorTrackDB = {
  getStudents: (): Student[] => getStored('tt_students', []),
  setStudents: (students: Student[]) => setStored('tt_students', students),

  getSchedules: (): Schedule[] => getStored('tt_schedules', []),
  setSchedules: (schedules: Schedule[]) => setStored('tt_schedules', schedules),

  getAttendance: (): Attendance[] => getStored('tt_attendance', []),
  setAttendance: (attendance: Attendance[]) => setStored('tt_attendance', attendance),

  getPayments: (): Payment[] => getStored('tt_payments', []),
  setPayments: (payments: Payment[]) => setStored('tt_payments', payments),

  getSettings: (): AppSettings => getStored('tt_settings', {
    darkMode: false,
    pinLockEnabled: false,
    pinCode: '',
    biometricLockEnabled: false,
    lastBackupTime: 'Never',
    isSyncing: false,
    backupSuccessCount: 0,
  }),
  setSettings: (settings: AppSettings) => setStored('tt_settings', settings),

  getNotifications: (): AppNotification[] => getStored('tt_notifications', []),
  setNotifications: (notif: AppNotification[]) => setStored('tt_notifications', notif),

  // Reset database to initial empty slate (removing the default database state)
  resetDB: () => {
    setStored('tt_students', []);
    setStored('tt_schedules', []);
    setStored('tt_attendance', []);
    setStored('tt_payments', []);
    setStored('tt_settings', {
      darkMode: false,
      pinLockEnabled: false,
      pinCode: '',
      biometricLockEnabled: false,
      lastBackupTime: 'Never',
      isSyncing: false,
      backupSuccessCount: 0,
    });
    setStored('tt_notifications', []);
  }
};
