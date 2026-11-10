import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { Customer, LedgerTransaction, TransactionType, UserProfile } from '../types/ledger';
import { extractPhoneFromAuthEmail } from '../utils/format';

function roundCurrency(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function toDateOrNull(val: unknown): Date | null {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

export async function verifyAccountPassword(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('সেশন পাওয়া যায়নি। অনুগ্রহ করে আবার লগইন করুন।');
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  if (!hasPasswordProvider) {
    throw new Error(
      'এই অ্যাকাউন্টে পাসওয়ার্ড সেট করা নেই। মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন।'
    );
  }

  if (!password) {
    throw new Error('অনুগ্রহ করে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।');
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';

    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      throw new Error('ভুল পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিন।');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('অনেকবার ভুল পাসওয়ার্ড দেওয়া হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।');
    }
    throw new Error('পাসওয়ার্ড যাচাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
  }
}

const inFlightProfiles = new Map<string, Promise<UserProfile | null>>();
let pendingRegistrationProfile: { name: string; phone: string } | null = null;

export function setPendingRegistrationProfile(profile: { name: string; phone: string } | null): void {
  pendingRegistrationProfile = profile;
}

export function ensureUserProfile(
  user: User,
  preferredName?: string,
  preferredPhone?: string
): Promise<UserProfile | null> {
  const existingPromise = inFlightProfiles.get(user.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const pending = pendingRegistrationProfile;
  pendingRegistrationProfile = null;

  const promise = (async (): Promise<UserProfile | null> => {
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid,
        name: data.name,
        email: data.email,
        phone: typeof data.phone === 'string' ? data.phone : extractPhoneFromAuthEmail(data.email),
        createdAt: toDateOrNull(data.createdAt),
        updatedAt: toDateOrNull(data.updatedAt),
      };
    }

    const derivedPhone = preferredPhone || pending?.phone || extractPhoneFromAuthEmail(user.email);
    const cleanName = (
      preferredName ||
      pending?.name ||
      user.displayName ||
      derivedPhone ||
      user.email?.split('@')[0] ||
      'ব্যবহারকারী'
    )
      .trim()
      .slice(0, 100);
    const cleanEmail = (user.email || 'user@bakirkhata.app').trim().slice(0, 150);
    const cleanPhone = derivedPhone.trim().slice(0, 30);

    const payload: Record<string, unknown> = {
      uid: user.uid,
      name: cleanName || 'ব্যবহারকারী',
      email: cleanEmail,
      createdAt: serverTimestamp(),
    };
    if (cleanPhone) {
      payload.phone = cleanPhone;
    }

    try {
      await setDoc(userRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return {
      uid: user.uid,
      name: cleanName || 'ব্যবহারকারী',
      email: cleanEmail,
      phone: cleanPhone || undefined,
      createdAt: new Date(),
    };
  })().finally(() => {
    inFlightProfiles.delete(user.uid);
  });

  inFlightProfiles.set(user.uid, promise);
  return promise;
}

export function subscribeToCustomers(
  userId: string,
  onData: (customers: Customer[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = `users/${userId}/customers`;
  const q = query(collection(db, 'users', userId, 'customers'), where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Customer[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          name: d.name ?? '',
          phone: d.phone ?? '',
          totalDue: typeof d.totalDue === 'number' ? d.totalDue : 0,
          totalPayment: typeof d.totalPayment === 'number' ? d.totalPayment : 0,
          createdAt: toDateOrNull(d.createdAt),
          updatedAt: toDateOrNull(d.updatedAt),
        };
      });

      // Sort by most recently updated/created first
      items.sort((a, b) => {
        const timeA = (a.updatedAt ?? a.createdAt)?.getTime() ?? 0;
        const timeB = (b.updatedAt ?? b.createdAt)?.getTime() ?? 0;
        return timeB - timeA;
      });

      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export async function addCustomer(
  userId: string,
  input: { name: string; phone: string }
): Promise<string> {
  const path = `users/${userId}/customers`;
  const cleanName = input.name.trim().slice(0, 100);
  const cleanPhone = input.phone.trim().slice(0, 30);

  if (!cleanName) {
    throw new Error('গ্রাহকের নাম দেওয়া আবশ্যক।');
  }

  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'customers'), {
      userId,
      name: cleanName,
      phone: cleanPhone,
      totalDue: 0,
      totalPayment: 0,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCustomer(
  userId: string,
  customerId: string,
  input: { name: string; phone: string }
): Promise<void> {
  const path = `users/${userId}/customers/${customerId}`;
  const cleanName = input.name.trim().slice(0, 100);
  const cleanPhone = input.phone.trim().slice(0, 30);

  if (!cleanName) {
    throw new Error('গ্রাহকের নাম দেওয়া আবশ্যক।');
  }

  try {
    await updateDoc(doc(db, 'users', userId, 'customers', customerId), {
      name: cleanName,
      phone: cleanPhone,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomerWithTransactions(
  userId: string,
  customerId: string
): Promise<void> {
  const customerPath = `users/${userId}/customers/${customerId}`;
  try {
    const txSnap = await getDocs(
      query(
        collection(db, 'users', userId, 'customers', customerId, 'transactions'),
        where('userId', '==', userId),
        where('customerId', '==', customerId)
      )
    );

    const batch = writeBatch(db);
    txSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'users', userId, 'customers', customerId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, customerPath);
  }
}

export function subscribeToTransactions(
  userId: string,
  customerId: string,
  onData: (transactions: LedgerTransaction[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = `users/${userId}/customers/${customerId}/transactions`;
  const q = query(
    collection(db, 'users', userId, 'customers', customerId, 'transactions'),
    where('userId', '==', userId),
    where('customerId', '==', customerId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LedgerTransaction[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId,
          customerId: d.customerId,
          type: d.type === 'payment' ? 'payment' : 'due',
          amount: typeof d.amount === 'number' ? d.amount : 0,
          note: typeof d.note === 'string' ? d.note : '',
          transactionDate: toDateOrNull(d.transactionDate) ?? new Date(),
          createdAt: toDateOrNull(d.createdAt),
          updatedAt: toDateOrNull(d.updatedAt),
        };
      });

      // Newest transactionDate first, tie-broken by createdAt
      items.sort((a, b) => {
        const dateDiff = b.transactionDate.getTime() - a.transactionDate.getTime();
        if (dateDiff !== 0) return dateDiff;
        const createdA = a.createdAt?.getTime() ?? 0;
        const createdB = b.createdAt?.getTime() ?? 0;
        return createdB - createdA;
      });

      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export async function addTransaction(
  userId: string,
  customerId: string,
  input: {
    type: TransactionType;
    amount: number;
    note: string;
    transactionDate: Date;
  }
): Promise<void> {
  const path = `users/${userId}/customers/${customerId}/transactions`;
  const amount = Math.round(input.amount * 100) / 100;
  const cleanNote = input.note.trim().slice(0, 300);

  if (!(amount > 0 && amount <= 100000000)) {
    throw new Error('সঠিক টাকার পরিমাণ লিখুন।');
  }

  const customerRef = doc(db, 'users', userId, 'customers', customerId);
  const txCollectionRef = collection(db, 'users', userId, 'customers', customerId, 'transactions');

  try {
    await runTransaction(db, async (tx) => {
      const customerSnap = await tx.get(customerRef);
      if (!customerSnap.exists()) {
        throw new Error('গ্রাহকের তথ্য পাওয়া যায়নি।');
      }

      const cData = customerSnap.data();
      const currentDue = typeof cData.totalDue === 'number' ? cData.totalDue : 0;
      const currentPayment = typeof cData.totalPayment === 'number' ? cData.totalPayment : 0;

      const nextDue =
        input.type === 'due' ? roundCurrency(currentDue + amount) : currentDue;
      const nextPayment =
        input.type === 'payment' ? roundCurrency(currentPayment + amount) : currentPayment;

      const newTxRef = doc(txCollectionRef);
      tx.set(newTxRef, {
        userId,
        customerId,
        type: input.type,
        amount,
        note: cleanNote,
        transactionDate: Timestamp.fromDate(input.transactionDate),
        createdAt: serverTimestamp(),
      });

      tx.update(customerRef, {
        totalDue: nextDue,
        totalPayment: nextPayment,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTransaction(
  userId: string,
  customerId: string,
  transactionId: string,
  input: {
    type: TransactionType;
    amount: number;
    note: string;
    transactionDate: Date;
  }
): Promise<void> {
  const path = `users/${userId}/customers/${customerId}/transactions/${transactionId}`;
  const amount = Math.round(input.amount * 100) / 100;
  const cleanNote = input.note.trim().slice(0, 300);

  if (!(amount > 0 && amount <= 100000000)) {
    throw new Error('সঠিক টাকার পরিমাণ লিখুন।');
  }

  const customerRef = doc(db, 'users', userId, 'customers', customerId);
  const txRef = doc(db, 'users', userId, 'customers', customerId, 'transactions', transactionId);

  try {
    await runTransaction(db, async (tx) => {
      const [customerSnap, txSnap] = await Promise.all([tx.get(customerRef), tx.get(txRef)]);
      if (!customerSnap.exists() || !txSnap.exists()) {
        throw new Error('লেনদেনের তথ্য পাওয়া যায়নি।');
      }

      const cData = customerSnap.data();
      const oldData = txSnap.data();

      let nextDue = typeof cData.totalDue === 'number' ? cData.totalDue : 0;
      let nextPayment = typeof cData.totalPayment === 'number' ? cData.totalPayment : 0;

      const oldAmount = typeof oldData.amount === 'number' ? oldData.amount : 0;
      if (oldData.type === 'due') {
        nextDue = roundCurrency(nextDue - oldAmount);
      } else {
        nextPayment = roundCurrency(nextPayment - oldAmount);
      }

      if (input.type === 'due') {
        nextDue = roundCurrency(nextDue + amount);
      } else {
        nextPayment = roundCurrency(nextPayment + amount);
      }

      tx.update(txRef, {
        type: input.type,
        amount,
        note: cleanNote,
        transactionDate: Timestamp.fromDate(input.transactionDate),
        updatedAt: serverTimestamp(),
      });

      tx.update(customerRef, {
        totalDue: nextDue,
        totalPayment: nextPayment,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTransaction(
  userId: string,
  customerId: string,
  transactionId: string
): Promise<void> {
  const path = `users/${userId}/customers/${customerId}/transactions/${transactionId}`;
  const customerRef = doc(db, 'users', userId, 'customers', customerId);
  const txRef = doc(db, 'users', userId, 'customers', customerId, 'transactions', transactionId);

  try {
    await runTransaction(db, async (tx) => {
      const [customerSnap, txSnap] = await Promise.all([tx.get(customerRef), tx.get(txRef)]);
      if (!customerSnap.exists() || !txSnap.exists()) {
        throw new Error('লেনদেনের তথ্য পাওয়া যায়নি।');
      }

      const cData = customerSnap.data();
      const oldData = txSnap.data();
      const oldAmount = typeof oldData.amount === 'number' ? oldData.amount : 0;

      let nextDue = typeof cData.totalDue === 'number' ? cData.totalDue : 0;
      let nextPayment = typeof cData.totalPayment === 'number' ? cData.totalPayment : 0;

      if (oldData.type === 'due') {
        nextDue = roundCurrency(nextDue - oldAmount);
      } else {
        nextPayment = roundCurrency(nextPayment - oldAmount);
      }

      tx.delete(txRef);
      tx.update(customerRef, {
        totalDue: nextDue,
        totalPayment: nextPayment,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncCustomerTotalsIfNeeded(
  userId: string,
  customer: Customer,
  transactions: LedgerTransaction[]
): Promise<void> {
  const computedDue = roundCurrency(
    transactions.reduce((acc, t) => (t.type === 'due' ? acc + t.amount : acc), 0)
  );
  const computedPayment = roundCurrency(
    transactions.reduce((acc, t) => (t.type === 'payment' ? acc + t.amount : acc), 0)
  );

  if (
    Math.abs(computedDue - customer.totalDue) > 0.01 ||
    Math.abs(computedPayment - customer.totalPayment) > 0.01
  ) {
    const path = `users/${userId}/customers/${customer.id}`;
    try {
      await updateDoc(doc(db, 'users', userId, 'customers', customer.id), {
        totalDue: computedDue,
        totalPayment: computedPayment,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function updateUserProfileName(
  userId: string,
  newName: string,
  currentPassword: string
): Promise<string> {
  const cleanName = newName.trim().slice(0, 100);
  if (!cleanName) {
    throw new Error('নাম বা দোকানের নাম লেখা আবশ্যক।');
  }

  await verifyAccountPassword(currentPassword);

  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      name: cleanName,
      updatedAt: serverTimestamp(),
    });
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: cleanName });
    }
    return cleanName;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function changeAccountPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  }

  await verifyAccountPassword(currentPassword);

  const user = auth.currentUser;
  if (!user) {
    throw new Error('সেশন পাওয়া যায়নি। অনুগ্রহ করে আবার লগইন করুন।');
  }

  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    if (code === 'auth/weak-password') {
      throw new Error('নতুন পাসওয়ার্ড আরও শক্তিশালী দিন (কমপক্ষে ৬ অক্ষর)।');
    }
    throw new Error('পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
  }
}

export async function fetchAllUserTransactions(
  userId: string,
  customerIds: string[]
): Promise<LedgerTransaction[]> {
  if (customerIds.length === 0) return [];

  const results = await Promise.all(
    customerIds.map(async (customerId) => {
      const path = `users/${userId}/customers/${customerId}/transactions`;
      try {
        const q = query(
          collection(db, 'users', userId, 'customers', customerId, 'transactions'),
          where('userId', '==', userId),
          where('customerId', '==', customerId)
        );
        const snap = await getDocs(q);
        return snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            userId: d.userId,
            customerId: d.customerId,
            type: d.type === 'payment' ? ('payment' as const) : ('due' as const),
            amount: typeof d.amount === 'number' ? d.amount : 0,
            note: typeof d.note === 'string' ? d.note : '',
            transactionDate: toDateOrNull(d.transactionDate) ?? new Date(),
            createdAt: toDateOrNull(d.createdAt),
            updatedAt: toDateOrNull(d.updatedAt),
          };
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    })
  );

  const merged = results.flat();
  merged.sort((a, b) => {
    const dateDiff = b.transactionDate.getTime() - a.transactionDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    const createdA = a.createdAt?.getTime() ?? 0;
    const createdB = b.createdAt?.getTime() ?? 0;
    return createdB - createdA;
  });

  return merged;
}
