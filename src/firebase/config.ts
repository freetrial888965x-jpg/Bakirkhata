import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Firebase Configuration
 * ----------------------
 * এই ফাইলটি থেকে Firebase-এর সমস্ত সংযোগ পরিচালিত হয়।
 * ভবিষ্যতে নতুন Firebase Project যুক্ত করতে চাইলে মূল ডিরেক্টরির
 * `firebase-applet-config.json` ফাইলের তথ্য পরিবর্তন করলেই চলবে।
 */
const app = initializeApp(firebaseConfig);

export const firebaseProjectId = firebaseConfig.projectId;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Named Firestore database instance support
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validate connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firebase Firestore সংযোগ বিচ্ছিন্ন রয়েছে। অনুগ্রহ করে কনফিগারেশন যাচাই করুন।');
    }
  }
}

testConnection();
