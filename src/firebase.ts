import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

export function isFirebaseConfigured(config: FirebaseConfig | null | undefined): boolean {
  return !!(config && config.apiKey && config.projectId);
}

export function getFirebaseDb(config: FirebaseConfig) {
  if (!isFirebaseConfigured(config)) {
    throw new Error('Firebase is not configured. Please supply API Key and Project ID.');
  }

  // Prevent multiple app initializations in React/Vite hot-reloading dev environment
  let app;
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
  }

  return getFirestore(app, config.firestoreDatabaseId || '(default)');
}

export async function syncLocalToFirebase(
  config: FirebaseConfig,
  data: {
    students: any[];
    schedules: any[];
    attendance: any[];
    payments: any[];
  }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const db = getFirebaseDb(config);
    const userId = 'tutor-default'; // Shared or partitioned by user
    let syncCount = 0;

    // Helper to upload a collection to Firestore partitioned by the tutor's userId folder
    const syncCollection = async (collectionName: string, items: any[]) => {
      for (const item of items) {
        const docRef = doc(db, 'tutors', userId, collectionName, item.id);
        const uploadPayload = {
          ...item,
          syncStatus: 'synced',
          synchronizedAt: new Date().toISOString(),
        };
        await setDoc(docRef, uploadPayload, { merge: true });
        syncCount++;
      }
    };

    // Upload each data model
    await syncCollection('students', data.students);
    await syncCollection('schedules', data.schedules);
    await syncCollection('attendance', data.attendance);
    await syncCollection('payments', data.payments);

    return { success: true, count: syncCount };
  } catch (error: any) {
    console.error('Firebase database sync failed:', error);
    return { success: false, count: 0, error: error?.message || 'Unknown network error' };
  }
}

export async function fetchFromFirebase(
  config: FirebaseConfig
): Promise<{
  success: boolean;
  data?: {
    students: any[];
    schedules: any[];
    attendance: any[];
    payments: any[];
  };
  error?: string;
}> {
  try {
    const db = getFirebaseDb(config);
    const userId = 'tutor-default';

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

    return {
      success: true,
      data: { students, schedules, attendance, payments }
    };
  } catch (error: any) {
    console.error('Firebase pull sync failed:', error);
    return { success: false, error: error?.message || 'Could not download from Firebase' };
  }
}
