import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, updateDoc, getDocs, collection, deleteDoc, writeBatch, getDocFromServer, getDoc
} from 'firebase/firestore';
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
  measurementId?: string;
}

/**
 * Utility helper to race a Promise with a timeout so operations never hang indefinitely.
 * Supports an optional AbortSignal to immediately abort and stop when requested.
 */
export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  operationName: string,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    return Promise.reject(new Error('SYNC_CANCELLED'));
  }

  return new Promise<T>((resolve, reject) => {
    let timer: any = null;

    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(new Error('SYNC_CANCELLED'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error(`[Timeout ${Math.round(timeoutMs / 1000)}s] "${operationName}" took too long to respond from Firebase servers. Check network connection or security rules.`));
    }, timeoutMs);

    promise
      .then((res) => {
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(res);
      })
      .catch((err) => {
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
}

export function getActiveConfig(customConfig?: FirebaseConfig | null): FirebaseConfig {
  const baseAppletConfig = (appletConfig && (appletConfig as any).apiKey) ? (appletConfig as any) : {
    apiKey: "AIzaSyDzKutBWol_klfnK-0uJ2irEB_uQU6Uhps",
    authDomain: "tutor-2026.firebaseapp.com",
    projectId: "tutor-2026",
    storageBucket: "tutor-2026.firebasestorage.app",
    messagingSenderId: "374342880731",
    appId: "1:374342880731:web:db47d67c9a09cb3863abfe",
    measurementId: "G-2JVF5M7BE1",
    firestoreDatabaseId: "(default)"
  };

  if (customConfig && customConfig.apiKey && customConfig.projectId) {
    const pId = customConfig.projectId.trim();
    return {
      apiKey: customConfig.apiKey.trim(),
      authDomain: (customConfig.authDomain || '').trim() || `${pId}.firebaseapp.com`,
      projectId: pId,
      storageBucket: (customConfig.storageBucket || '').trim() || `${pId}.firebasestorage.app`,
      messagingSenderId: (customConfig.messagingSenderId || '').trim() || baseAppletConfig.messagingSenderId || '',
      appId: (customConfig.appId || '').trim() || baseAppletConfig.appId || '',
      measurementId: customConfig.measurementId || baseAppletConfig.measurementId,
      firestoreDatabaseId: (customConfig.firestoreDatabaseId || '').trim() || baseAppletConfig.firestoreDatabaseId || '(default)'
    };
  }

  return baseAppletConfig;
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
  const isDefaultProject = configKey === 'tutor-2026' || (appletConfig && configKey === (appletConfig as any).projectId);
  const appName = isDefaultProject ? '[DEFAULT]' : configKey;
  
  let app: FirebaseApp;
  if (appName === '[DEFAULT]') {
    const defaultApp = existingApps.find(a => a.name === '[DEFAULT]');
    if (defaultApp) {
      app = defaultApp;
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
  } else {
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
  }

  const db = (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' && config.firestoreDatabaseId !== '')
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);
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
  try {
    const authInstance = getFirebaseAuth(customConfig);
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    const result = await signInWithPopup(authInstance, googleProvider);
    return result.user;
  } catch (err: any) {
    console.warn("Google Sign-In caught error:", err);
    if (err?.code === 'auth/network-request-failed') {
      throw new Error('Network connection to Firebase Auth servers failed. Check your internet connection or third-party cookies/sandbox restrictions.');
    } else if (err?.code === 'auth/popup-blocked') {
      throw new Error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
    } else if (err?.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in popup was closed before completing authentication.');
    }
    throw err;
  }
}

export async function signInWithEmail(email: string, password: string, customConfig?: FirebaseConfig | null): Promise<User> {
  try {
    const authInstance = getFirebaseAuth(customConfig);
    const result = await signInWithEmailAndPassword(authInstance, email, password);
    return result.user;
  } catch (err: any) {
    console.warn("Email Sign-In caught error:", err);
    if (err?.code === 'auth/network-request-failed') {
      throw new Error('Network connection to Firebase Auth servers failed. You can continue using the offline local mode seamlessly.');
    }
    throw err;
  }
}

export async function signUpWithEmail(email: string, password: string, customConfig?: FirebaseConfig | null): Promise<User> {
  try {
    const authInstance = getFirebaseAuth(customConfig);
    const result = await createUserWithEmailAndPassword(authInstance, email, password);
    return result.user;
  } catch (err: any) {
    console.warn("Email Sign-Up caught error:", err);
    if (err?.code === 'auth/network-request-failed') {
      throw new Error('Network connection to Firebase Auth servers failed. You can continue using the offline local mode seamlessly.');
    }
    throw err;
  }
}

export async function signInAnonymouslyFromFirebase(customConfig?: FirebaseConfig | null): Promise<User> {
  try {
    const authInstance = getFirebaseAuth(customConfig);
    const result = await signInAnonymously(authInstance);
    return result.user;
  } catch (err: any) {
    console.warn("Anonymous Sign-In caught error:", err);
    if (err?.code === 'auth/network-request-failed') {
      throw new Error('Network connection to Firebase Auth servers failed. Anonymous Cloud access unavailable right now; local mode is active.');
    }
    throw err;
  }
}

export async function logOutFromFirebase(customConfig?: FirebaseConfig | null): Promise<void> {
  const authInstance = getFirebaseAuth(customConfig);
  await signOut(authInstance);
}

/**
 * Deeply sanitizes objects for Firestore writes (setDoc, updateDoc, writeBatch.set).
 * Recursively removes all `undefined` values and converts dates/numbers into valid Firestore payloads,
 * preventing 'Function DocumentReference.set() called with invalid data. Unsupported field value: undefined' rejections.
 */
export function sanitizeForFirestore<T = any>(val: T): T {
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
      .map(item => sanitizeForFirestore(item)) as unknown as T;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(val as Record<string, any>)) {
    if (value !== undefined) {
      const sanitizedChild = sanitizeForFirestore(value);
      if (sanitizedChild !== undefined) {
        cleaned[key] = sanitizedChild;
      }
    }
  }
  return cleaned as T;
}

/**
 * Safely writes a document to Firestore, strictly stripping any undefined fields
 * before invoking setDoc with merge options.
 */
export async function safeSetDoc(
  docRef: any,
  data: any,
  options: { merge?: boolean } = { merge: true }
): Promise<void> {
  const sanitized = sanitizeForFirestore(data);
  return setDoc(docRef, sanitized, options);
}

/**
 * Safely updates a document in Firestore, strictly stripping any undefined fields
 * before invoking updateDoc.
 */
export async function safeUpdateDoc(
  docRef: any,
  data: any
): Promise<void> {
  const sanitized = sanitizeForFirestore(data);
  return updateDoc(docRef, sanitized);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, config?: FirebaseConfig | null) {
  let authUser: any = null;
  try {
    const authInstance = getFirebaseAuth(config);
    authUser = authInstance.currentUser;
  } catch (e) {
    // Auth might not be ready
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authUser?.uid || null,
      email: authUser?.email || null,
      emailVerified: authUser?.emailVerified || null,
      isAnonymous: authUser?.isAnonymous || null,
      tenantId: authUser?.tenantId || null,
      providerInfo: authUser?.providerData?.map((p: any) => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SyncProgressUpdate {
  stage: string;
  percent: number;
  currentCount: number;
  totalCount: number;
  log?: {
    type: 'info' | 'success' | 'warn' | 'error';
    message: string;
    details?: string;
  };
}

export type SyncProgressCallback = (update: SyncProgressUpdate) => void;

/**
 * Fast diagnostic connection tester that tests Firebase reachability, authentication state, and Firestore read/write capabilities
 */
export async function testFirebaseConnection(
  config: FirebaseConfig,
  currentUserId?: string
): Promise<{
  success: boolean;
  latencyMs: number;
  authStatus: string;
  userId?: string;
  feedback: string;
  details?: any;
}> {
  const startTime = Date.now();
  try {
    const instances = initializeFirebase(config);
    if (!instances) {
      return {
        success: false,
        latencyMs: 0,
        authStatus: 'Uninitialized',
        feedback: 'Firebase initialization failed. Missing API Key or Project ID.'
      };
    }

    const { db, auth } = instances;
    const authUser = auth.currentUser;
    const effectiveUserId = currentUserId || authUser?.uid || 'tutor-default';
    const authDesc = authUser ? `Authenticated (${authUser.email || authUser.uid})` : 'Guest Sandbox Mode';

    // Run ping write and read with a 8-second safety timeout
    const testDocPath = `tutors/${effectiveUserId}/system_test/ping`;
    const pingRef = doc(db, 'tutors', effectiveUserId, 'system_test', 'ping');

    await withTimeout(
      setDoc(pingRef, {
        pingAt: new Date().toISOString(),
        clientTimestamp: Date.now(),
        clientAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'TutorTrack-Engine',
      }, { merge: true }),
      8000,
      'Firestore Ping Write'
    );

    const snap = await withTimeout(
      getDocFromServer(pingRef),
      8000,
      'Firestore Ping Read'
    );

    const latency = Date.now() - startTime;

    return {
      success: true,
      latencyMs: latency,
      authStatus: authDesc,
      userId: effectiveUserId,
      feedback: `Successfully connected to Firebase Project "${config.projectId}" with ${latency}ms latency. Firestore database is online and active.`
    };
  } catch (err: any) {
    const latency = Date.now() - startTime;
    let friendlyMessage = err?.message || String(err);

    if (friendlyMessage.includes('permission-denied') || friendlyMessage.includes('Missing or insufficient permissions')) {
      friendlyMessage = `Firebase Security Rules prevented access. If you are not logged in, ensure your user is signed in or your rules allow access to the tutor collection.`;
    } else if (friendlyMessage.includes('Timeout')) {
      friendlyMessage = `Connection timed out after ${Math.round(latency / 1000)}s. Firebase servers did not respond in time. Please check your internet connection or Firestore project status.`;
    } else if (friendlyMessage.includes('the client is offline') || friendlyMessage.includes('network-request-failed')) {
      friendlyMessage = `Network connection to Firebase Firestore servers failed. Check internet access or firewall/proxy restrictions.`;
    }

    return {
      success: false,
      latencyMs: latency,
      authStatus: 'Connection Failed',
      feedback: friendlyMessage,
      details: err
    };
  }
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
  },
  onProgress?: SyncProgressCallback,
  signal?: AbortSignal
): Promise<{ 
  success: boolean; 
  count: number; 
  latencyMs: number; 
  error?: string;
  syncedBreakdown?: { [key: string]: number };
  feedbackMessage?: string;
  cancelled?: boolean;
}> {
  const syncStartTime = Date.now();
  const breakdown: { [key: string]: number } = {
    students: 0,
    schedules: 0,
    attendance: 0,
    payments: 0,
    examSchedules: 0,
    examRecords: 0,
    deleted: 0
  };

  try {
    if (signal?.aborted) {
      throw new Error('SYNC_CANCELLED');
    }

    const db = getFirebaseDb(config);
    const userId = currentUserId || 'tutor-default';

    onProgress?.({
      stage: 'Connecting to Firebase Firestore...',
      percent: 5,
      currentCount: 0,
      totalCount: 0,
      log: {
        type: 'info',
        message: `Connecting to Firebase Project "${config.projectId}" (Target Tutor ID: ${userId})...`
      }
    });

    const studentsList = data.students || [];
    const schedulesList = data.schedules || [];
    const attendanceList = data.attendance || [];
    const paymentsList = data.payments || [];
    const examSchedulesList = data.examSchedules || [];
    const examRecordsList = data.examRecords || [];
    const deletedList = data.deletedRecords || [];

    const totalItems = studentsList.length + schedulesList.length + attendanceList.length + 
                       paymentsList.length + examSchedulesList.length + examRecordsList.length + deletedList.length;

    onProgress?.({
      stage: 'Preparing Batch Operations...',
      percent: 15,
      currentCount: 0,
      totalCount: totalItems,
      log: {
        type: 'info',
        message: `Found ${totalItems} total entities queued for cloud replication.`
      }
    });

    let processedCount = 0;

    // 1. Process Deletions in batch
    if (deletedList.length > 0) {
      if (signal?.aborted) throw new Error('SYNC_CANCELLED');

      onProgress?.({
        stage: `Purging ${deletedList.length} deleted records from Cloud...`,
        percent: 20,
        currentCount: processedCount,
        totalCount: totalItems,
        log: {
          type: 'info',
          message: `Deleting ${deletedList.length} removed records from cloud database...`
        }
      });

      const delBatch = writeBatch(db);
      for (const del of deletedList) {
        const docRef = doc(db, 'tutors', userId, del.collectionName, del.id);
        delBatch.delete(docRef);
      }

      await withTimeout(delBatch.commit(), 12000, 'Firestore Delete Batch', signal);
      processedCount += deletedList.length;
      breakdown.deleted = deletedList.length;
      onProgress?.({
        stage: 'Deleted records cleared',
        percent: Math.min(25, Math.round((processedCount / (totalItems || 1)) * 100)),
        currentCount: processedCount,
        totalCount: totalItems,
        log: {
          type: 'success',
          message: `✓ Cleaned ${deletedList.length} deleted documents from cloud database.`
        }
      });
    }

    // Helper for batch uploading any entity array
    const uploadCollectionInBatches = async (
      collectionName: string,
      items: any[],
      startPercent: number,
      endPercent: number
    ) => {
      if (signal?.aborted) throw new Error('SYNC_CANCELLED');

      if (!items || items.length === 0) {
        onProgress?.({
          stage: `No changes in ${collectionName}`,
          percent: endPercent,
          currentCount: processedCount,
          totalCount: totalItems,
          log: {
            type: 'info',
            message: `✓ ${collectionName}: 0 items (already up to date)`
          }
        });
        return;
      }

      onProgress?.({
        stage: `Syncing ${collectionName} (${items.length} records)...`,
        percent: startPercent,
        currentCount: processedCount,
        totalCount: totalItems,
        log: {
          type: 'info',
          message: `Uploading ${items.length} ${collectionName} to cloud partition tutors/${userId}/${collectionName}...`
        }
      });

      // Split in chunks of up to 250 documents per batch to ensure lightweight payloads
      const CHUNK_SIZE = 250;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        if (signal?.aborted) throw new Error('SYNC_CANCELLED');

        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docRef = doc(db, 'tutors', userId, collectionName, item.id);
          const uploadPayload = sanitizeForFirestore({
            ...item,
            syncStatus: 'synced',
            synchronizedAt: new Date().toISOString(),
          });
          batch.set(docRef, uploadPayload, { merge: true });
        }

        await withTimeout(batch.commit(), 15000, `Batch upload for ${collectionName} [${i + 1}-${i + chunk.length}]`, signal);
        processedCount += chunk.length;
        breakdown[collectionName] = (breakdown[collectionName] || 0) + chunk.length;

        const currentPct = Math.round(startPercent + ((i + chunk.length) / items.length) * (endPercent - startPercent));
        onProgress?.({
          stage: `Synced ${processedCount}/${totalItems} items...`,
          percent: currentPct,
          currentCount: processedCount,
          totalCount: totalItems,
          log: {
            type: 'success',
            message: `✓ Replicated ${chunk.length} ${collectionName} items (Total: ${processedCount}/${totalItems})`
          }
        });
      }
    };

    // Sequential collection sync with step-by-step progress
    await uploadCollectionInBatches('students', studentsList, 25, 38);
    await uploadCollectionInBatches('schedules', schedulesList, 38, 50);
    await uploadCollectionInBatches('attendance', attendanceList, 50, 68);
    await uploadCollectionInBatches('payments', paymentsList, 68, 82);
    await uploadCollectionInBatches('examSchedules', examSchedulesList, 82, 90);
    await uploadCollectionInBatches('examRecords', examRecordsList, 90, 98);

    const totalDuration = Date.now() - syncStartTime;

    onProgress?.({
      stage: 'Replication Complete!',
      percent: 100,
      currentCount: processedCount,
      totalCount: totalItems,
      log: {
        type: 'success',
        message: `✓ Cloud Replication Finished: ${processedCount} records successfully synced to Firebase Firestore in ${totalDuration}ms.`
      }
    });

    return { 
      success: true, 
      count: processedCount, 
      latencyMs: totalDuration,
      syncedBreakdown: breakdown,
      feedbackMessage: `Successfully replicated ${processedCount} database entities to Firebase Firestore (tutor-2026) in ${totalDuration}ms.`
    };
  } catch (error: any) {
    const totalDuration = Date.now() - syncStartTime;
    const isCancelled = error?.message === 'SYNC_CANCELLED' || error?.name === 'AbortError' || signal?.aborted;

    if (isCancelled) {
      onProgress?.({
        stage: 'Replication Stopped',
        percent: 0,
        currentCount: 0,
        totalCount: 0,
        log: {
          type: 'warn',
          message: '⏹ Cloud replication process was manually stopped by user.'
        }
      });

      return {
        success: false,
        count: 0,
        latencyMs: totalDuration,
        cancelled: true,
        error: 'Replication was stopped by user.'
      };
    }

    console.error('Firebase database sync failed:', error);
    
    let userFriendlyError = error?.message || 'Unknown network error during replication.';
    if (userFriendlyError.includes('permission-denied') || userFriendlyError.includes('Missing or insufficient permissions')) {
      userFriendlyError = `Firebase Permission Denied: Your user credentials or security rules did not allow writing to tutors/${currentUserId || 'tutor-default'}.`;
    } else if (userFriendlyError.includes('Timeout')) {
      userFriendlyError = `Replication Timed Out: Firebase server took more than 15s to respond. Check internet connection or project quota.`;
    }

    onProgress?.({
      stage: 'Sync Failed',
      percent: 100,
      currentCount: 0,
      totalCount: 0,
      log: {
        type: 'error',
        message: `Replication Error: ${userFriendlyError}`,
        details: error?.stack || String(error)
      }
    });

    return { 
      success: false, 
      count: 0, 
      latencyMs: totalDuration,
      error: userFriendlyError 
    };
  }
}

export async function fetchFromFirebase(
  config: FirebaseConfig,
  currentUserId: string,
  onProgress?: SyncProgressCallback,
  signal?: AbortSignal
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
  cancelled?: boolean;
}> {
  try {
    if (signal?.aborted) throw new Error('SYNC_CANCELLED');

    const db = getFirebaseDb(config);
    const userId = currentUserId || 'tutor-default';

    onProgress?.({
      stage: 'Connecting to Cloud for Pull...',
      percent: 10,
      currentCount: 0,
      totalCount: 6,
      log: {
        type: 'info',
        message: `Connecting to Firebase Firestore (tutors/${userId}) to retrieve cloud database...`
      }
    });

    const fetchCollection = async (partitionId: string, collectionName: string, startPct: number, endPct: number, silentFail = false): Promise<any[]> => {
      if (signal?.aborted) throw new Error('SYNC_CANCELLED');

      const collPath = `tutors/${partitionId}/${collectionName}`;
      try {
        if (!silentFail) {
          onProgress?.({
            stage: `Downloading ${collectionName}...`,
            percent: startPct,
            currentCount: 0,
            totalCount: 6,
            log: {
              type: 'info',
              message: `Fetching ${collectionName} from cloud (tutors/${partitionId})...`
            }
          });
        }

        const snap = await withTimeout(
          getDocs(collection(db, 'tutors', partitionId, collectionName)),
          15000,
          `Fetch ${collectionName}`,
          signal
        );

        const list: any[] = [];
        snap.forEach(docSnap => {
          const docData = docSnap.data();
          list.push({
            ...docData,
            id: docData.id || docSnap.id,
            syncStatus: 'synced'
          });
        });

        if (!silentFail) {
          onProgress?.({
            stage: `Retrieved ${list.length} ${collectionName}`,
            percent: endPct,
            currentCount: 0,
            totalCount: 6,
            log: {
              type: 'success',
              message: `✓ Downloaded ${list.length} records for ${collectionName}`
            }
          });
        }

        return list;
      } catch (error: any) {
        if (error?.message === 'SYNC_CANCELLED' || error?.name === 'AbortError' || signal?.aborted) {
          throw error;
        }
        if (silentFail) {
          return [];
        }
        handleFirestoreError(error, OperationType.GET, collPath, config);
        return [];
      }
    };

    let students = await fetchCollection(userId, 'students', 15, 30);
    let schedules = await fetchCollection(userId, 'schedules', 30, 45);
    let attendance = await fetchCollection(userId, 'attendance', 45, 60);
    let payments = await fetchCollection(userId, 'payments', 60, 75);
    let examSchedules = await fetchCollection(userId, 'examSchedules', 75, 88);
    let examRecords = await fetchCollection(userId, 'examRecords', 88, 95);

    const totalFound = students.length + schedules.length + attendance.length + payments.length + examSchedules.length + examRecords.length;

    // Fallback: If user partition is empty and userId !== 'tutor-default', check tutor-default
    if (totalFound === 0 && userId !== 'tutor-default') {
      onProgress?.({
        stage: 'Checking default cloud partition...',
        percent: 96,
        currentCount: 0,
        totalCount: 6,
        log: {
          type: 'info',
          message: 'No records in authenticated partition. Checking default cloud partition...'
        }
      });
      const defStudents = await fetchCollection('tutor-default', 'students', 96, 97, true);
      const defSchedules = await fetchCollection('tutor-default', 'schedules', 97, 97, true);
      const defAttendance = await fetchCollection('tutor-default', 'attendance', 97, 98, true);
      const defPayments = await fetchCollection('tutor-default', 'payments', 98, 98, true);
      const defExamSchedules = await fetchCollection('tutor-default', 'examSchedules', 98, 99, true);
      const defExamRecords = await fetchCollection('tutor-default', 'examRecords', 99, 99, true);

      const defTotal = defStudents.length + defSchedules.length + defAttendance.length + defPayments.length + defExamSchedules.length + defExamRecords.length;
      if (defTotal > 0) {
        students = defStudents;
        schedules = defSchedules;
        attendance = defAttendance;
        payments = defPayments;
        examSchedules = defExamSchedules;
        examRecords = defExamRecords;
        onProgress?.({
          stage: `Restored from default partition (${defTotal} items)`,
          percent: 99,
          currentCount: 6,
          totalCount: 6,
          log: {
            type: 'info',
            message: `Found and pulled ${defTotal} records from default cloud partition.`
          }
        });
      }
    }

    const finalTotal = students.length + schedules.length + attendance.length + payments.length + examSchedules.length + examRecords.length;

    onProgress?.({
      stage: 'Pull Sync Complete!',
      percent: 100,
      currentCount: 6,
      totalCount: 6,
      log: {
        type: 'success',
        message: `✓ All 6 cloud database collections retrieved (${finalTotal} total records downloaded).`
      }
    });

    return {
      success: true,
      data: { students, schedules, attendance, payments, examSchedules, examRecords }
    };
  } catch (error: any) {
    const isCancelled = error?.message === 'SYNC_CANCELLED' || error?.name === 'AbortError' || signal?.aborted;
    if (isCancelled) {
      onProgress?.({
        stage: 'Pull Cancelled',
        percent: 0,
        currentCount: 0,
        totalCount: 0,
        log: {
          type: 'warn',
          message: '⏹ Cloud restore process was manually stopped by user.'
        }
      });
      return { success: false, cancelled: true, error: 'Pull operation was stopped by user.' };
    }

    console.error('Firebase pull sync failed:', error);
    let userFriendlyError = error?.message || 'Could not download from Firebase';

    if (typeof userFriendlyError === 'string' && userFriendlyError.startsWith('{') && userFriendlyError.includes('"error"')) {
      try {
        const parsed = JSON.parse(userFriendlyError);
        if (parsed.error?.includes('Missing or insufficient permissions') || parsed.error?.includes('permission-denied')) {
          userFriendlyError = 'Firebase Permission Denied: The cloud database rejected access. Please check Firebase authentication or security rules.';
        } else if (parsed.error) {
          userFriendlyError = `Firebase Firestore Error: ${parsed.error}`;
        }
      } catch (e) {
        // use raw error
      }
    }

    if (userFriendlyError.includes('Timeout')) {
      userFriendlyError = `Pull Sync Timed Out: Firebase server did not respond within 15 seconds. Check internet connectivity.`;
    }
    return { success: false, error: userFriendlyError };
  }
}

