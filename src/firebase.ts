import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, User,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously 
} from 'firebase/auth';
import appletConfig from '../firebase-applet-config.json';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export function getActiveConfig(customConfig?: FirebaseConfig | null): FirebaseConfig {
  if (customConfig && customConfig.apiKey && customConfig.projectId) {
    return customConfig;
  }
  return appletConfig as FirebaseConfig;
}

export function isFirebaseConfigured(config: FirebaseConfig | null | undefined): boolean {
  return !!(config && config.apiKey && config.projectId);
}

export function initializeFirebase(customConfig?: FirebaseConfig | null) {
  const config = getActiveConfig(customConfig);
  if (!isFirebaseConfigured(config)) {
    return null;
  }

  const configKey = config.projectId;
  const existingApps = getApps();
  const appName = configKey === appletConfig.projectId ? '[DEFAULT]' : configKey;
  
  let app: FirebaseApp;
  const matchedApp = existingApps.find(a => a.name === appName);
  if (matchedApp) {
    app = matchedApp;
  } else {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    }, appName);
  }

  const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
  const auth = getAuth(app);

  return {
    app,
    db,
    auth
  };
}

// Quick getters
export function getFirebaseDb(customConfig?: FirebaseConfig | null) {
  const instances = initializeFirebase(customConfig);
  if (!instances) {
    throw new Error('Firebase could not be initialized. Please check config.');
  }
  return instances.db;
}

export function getFirebaseAuth(customConfig?: FirebaseConfig | null) {
  const instances = initializeFirebase(customConfig);
  if (!instances) {
    throw new Error('Firebase could not be initialized. Please check config.');
  }
  return instances.auth;
}

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(customConfig?: FirebaseConfig | null): Promise<User> {
  const authInstance = getFirebaseAuth(customConfig);
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await signInWithPopup(authInstance, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string, customConfig?: FirebaseConfig | null): Promise<User> {
  const authInstance = getFirebaseAuth(customConfig);
  const result = await signInWithEmailAndPassword(authInstance, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string, customConfig?: FirebaseConfig | null): Promise<User> {
  const authInstance = getFirebaseAuth(customConfig);
  const result = await createUserWithEmailAndPassword(authInstance, email, password);
  return result.user;
}

export async function signInAnonymouslyFromFirebase(customConfig?: FirebaseConfig | null): Promise<User> {
  const authInstance = getFirebaseAuth(customConfig);
  const result = await signInAnonymously(authInstance);
  return result.user;
}

export async function logOutFromFirebase(customConfig?: FirebaseConfig | null): Promise<void> {
  const authInstance = getFirebaseAuth(customConfig);
  await signOut(authInstance);
}

function sanitizeForFirestore(val: any): any {
  if (val === undefined) {
    return null;
  }
  if (val === null) {
    return null;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeForFirestore);
  }
  if (typeof val === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(val)) {
      if (val[key] !== undefined) {
        cleaned[key] = sanitizeForFirestore(val[key]);
      }
    }
    return cleaned;
  }
  return val;
}

export async function syncLocalToFirebase(
  config: FirebaseConfig,
  currentUserId: string,
  data: {
    students: any[];
    schedules: any[];
    attendance: any[];
    payments: any[];
    examSchedules?: any[];
    examRecords?: any[];
    deletedRecords?: { id: string; collectionName: string }[];
  }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const db = getFirebaseDb(config);
    const userId = currentUserId || 'tutor-default'; // Partitioned by active authenticated user ID
    let syncCount = 0;

    // Process deletions if any exist
    if (data.deletedRecords && data.deletedRecords.length > 0) {
      for (const del of data.deletedRecords) {
        const docRef = doc(db, 'tutors', userId, del.collectionName, del.id);
        await deleteDoc(docRef);
      }
    }

    // Helper to upload a collection to Firestore partitioned by the tutor's userId folder
    const syncCollection = async (collectionName: string, items: any[]) => {
      for (const item of items) {
        const docRef = doc(db, 'tutors', userId, collectionName, item.id);
        const uploadPayload = sanitizeForFirestore({
          ...item,
          syncStatus: 'synced',
          synchronizedAt: new Date().toISOString(),
        });
        await setDoc(docRef, uploadPayload, { merge: true });
        syncCount++;
      }
    };

    // Upload each data model
    await syncCollection('students', data.students);
    await syncCollection('schedules', data.schedules);
    await syncCollection('attendance', data.attendance);
    await syncCollection('payments', data.payments);
    if (data.examSchedules) await syncCollection('examSchedules', data.examSchedules);
    if (data.examRecords) await syncCollection('examRecords', data.examRecords);

    return { success: true, count: syncCount };
  } catch (error: any) {
    console.error('Firebase database sync failed:', error);
    return { success: false, count: 0, error: error?.message || 'Unknown network error' };
  }
}

export async function fetchFromFirebase(
  config: FirebaseConfig,
  currentUserId: string
): Promise<{
  success: boolean;
  data?: {
    students: any[];
    schedules: any[];
    attendance: any[];
    payments: any[];
    examSchedules: any[];
    examRecords: any[];
  };
  error?: string;
}> {
  try {
    const db = getFirebaseDb(config);
    const userId = currentUserId || 'tutor-default';

    const fetchCollection = async (collectionName: string): Promise<any[]> => {
      const snap = await getDocs(collection(db, 'tutors', userId, collectionName));
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      return list;
    };

    const students = await fetchCollection('students');
    const schedules = await fetchCollection('schedules');
    const attendance = await fetchCollection('attendance');
    const payments = await fetchCollection('payments');
    const examSchedules = await fetchCollection('examSchedules');
    const examRecords = await fetchCollection('examRecords');

    return {
      success: true,
      data: { students, schedules, attendance, payments, examSchedules, examRecords }
    };
  } catch (error: any) {
    console.error('Firebase pull sync failed:', error);
    return { success: false, error: error?.message || 'Could not download from Firebase' };
  }
}

