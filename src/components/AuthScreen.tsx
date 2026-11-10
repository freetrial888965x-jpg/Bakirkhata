import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { ExternalLink, Eye, EyeOff, Lock, Phone, User } from 'lucide-react';
import { auth, firebaseProjectId } from '../firebase/config';
import { setPendingRegistrationProfile } from '../services/ledgerService';
import { isValidPhone, normalizePhone, phoneToAuthEmail } from '../utils/format';

type AuthMode = 'login' | 'signup';

function getErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: string }).code)
    : '';
}

function translateAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়।';
    case 'auth/email-already-in-use':
      return 'এই মোবাইল নম্বর দিয়ে আগেই একটি অ্যাকাউন্ট তৈরি করা আছে।';
    case 'auth/weak-password':
      return 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।';
    case 'auth/too-many-requests':
      return 'অনেকবার ভুল চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
    case 'auth/operation-not-allowed':
      return 'Firebase প্রোজেক্টে পাসওয়ার্ড লগইন এখনো চালু করা হয়নি।';
    default:
      return 'লগইন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsConsoleEnable, setNeedsConsoleEnable] = useState(false);

  const consoleAuthProvidersUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsConsoleEnable(false);

    const trimmedName = name.trim();
    const normalizedPhone = normalizePhone(phone);

    if (mode === 'signup' && !trimmedName) {
      setError('আপনার নাম বা দোকানের নাম লেখা আবশ্যক।');
      return;
    }

    if (!isValidPhone(normalizedPhone)) {
      setError('অনুগ্রহ করে সঠিক মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX)।');
      return;
    }

    if (password.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }

    const authEmail = phoneToAuthEmail(normalizedPhone);
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, password);
      } else {
        setPendingRegistrationProfile({ name: trimmedName, phone: normalizedPhone });
        const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
        await updateProfile(cred.user, { displayName: trimmedName });
      }
    } catch (err) {
      setPendingRegistrationProfile(null);
      const code = getErrorCode(err);
      if (code === 'auth/operation-not-allowed') {
        setNeedsConsoleEnable(true);
      }
      setError(translateAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-red-600">📒 বাকির খাতা</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            শুধু মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে আপনার হিসাব পরিচালনা করুন
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
          {/* Segmented Tabs: Login / Create Account */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setNeedsConsoleEnable(false);
              }}
              className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              লগইন
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setNeedsConsoleEnable(false);
              }}
              className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              নতুন অ্যাকাউন্ট তৈরি
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 leading-relaxed space-y-2">
              <p className="font-semibold">{error}</p>
              {needsConsoleEnable && (
                <div className="space-y-2 pt-1 text-xs sm:text-sm text-red-700">
                  <p>
                    মোবাইল নম্বর ও পাসওয়ার্ড লগইন সচল করতে Firebase Console থেকে একবার পাসওয়ার্ড
                    অথেন্টিকেশন চালু করে দিন:
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>নিচের লিংকে ক্লিক করে Firebase Console খুলুন</li>
                    <li>
                      <strong>Sign-in method</strong> থেকে <strong>Email/Password</strong> চালু
                      (Enable) করে <strong>Save</strong> করুন
                    </li>
                    <li>এখানে ফিরে এসে আবার লগইন বা নতুন অ্যাকাউন্ট তৈরি করুন</li>
                  </ol>
                  <a
                    href={consoleAuthProvidersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    <span>Firebase Console খুলুন</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  আপনার নাম / দোকানের নাম <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    placeholder="যেমন: করিম স্টোর"
                    required
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-phone"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                মোবাইল নম্বর <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  placeholder="যেমন: 017XXXXXXXX"
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                পাসওয়ার্ড <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading
                ? 'অপেক্ষা করুন...'
                : mode === 'login'
                ? 'লগইন করুন'
                : 'অ্যাকাউন্ট তৈরি করুন'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500 leading-relaxed">
          Developer: <span className="font-medium text-slate-700">MD Rasel Islam Roni</span>
          <span aria-hidden="true"> · </span>
          <span>
            ডেভেলপার সাপোর্ট WhatsApp:{' '}
            <a
              href="https://wa.me/8801797977609"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-700 hover:underline tabular-nums"
            >
              01797977609
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
