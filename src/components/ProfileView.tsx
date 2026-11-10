import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  MessageCircle,
  Phone,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { changeAccountPassword, updateUserProfileName } from '../services/ledgerService';
import { Customer } from '../types/ledger';
import { computeBalance, formatNumberBn, formatTaka } from '../utils/format';

interface ProfileViewProps {
  userId: string;
  userName: string;
  userPhone?: string;
  customers: Customer[];
  totalTransactionsCount: number;
  onProfileNameUpdated: (newName: string) => void;
  onLogout: () => void;
}

export function ProfileView({
  userId,
  userName,
  userPhone,
  customers,
  totalTransactionsCount,
  onProfileNameUpdated,
  onLogout,
}: ProfileViewProps) {
  // Edit Shop/User Name state
  const [nameInput, setNameInput] = useState(userName);
  const [namePassword, setNamePassword] = useState('');
  const [showNamePwd, setShowNamePwd] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');

  // Change Password state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwdFields, setShowPwdFields] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  let totalDue = 0;
  let totalAdvance = 0;
  for (const c of customers) {
    const bal = computeBalance(c.totalDue, c.totalPayment);
    if (bal.status === 'due') totalDue += bal.absAmount;
    else if (bal.status === 'advance') totalAdvance += bal.absAmount;
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');

    if (!nameInput.trim()) {
      setNameError('দোকান বা ব্যবহারকারীর নাম লেখা আবশ্যক।');
      return;
    }
    if (!namePassword) {
      setNameError('নাম পরিবর্তন করতে আপনার বর্তমান পাসওয়ার্ড দিন।');
      return;
    }

    setNameSaving(true);
    try {
      const updated = await updateUserProfileName(userId, nameInput, namePassword);
      onProfileNameUpdated(updated);
      setNamePassword('');
      setNameSuccess('নাম সফলভাবে আপডেট হয়েছে।');
    } catch (err) {
      setNameError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'নাম পরিবর্তন করতে সমস্যা হয়েছে।'
      );
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPwd.length < 6) {
      setPwdError('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('নতুন পাসওয়ার্ড দুটি মিলছে না।');
      return;
    }

    setPwdSaving(true);
    try {
      await changeAccountPassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdSuccess('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।');
    } catch (err) {
      setPwdError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে।'
      );
    } finally {
      setPwdSaving(false);
    }
  };

  const avatarInitial = userName.trim().charAt(0) || 'ব';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24 space-y-5">
      {/* Profile Hero Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-xl font-bold text-white">
            {avatarInitial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{userName}</h1>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-slate-500 tabular-nums">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{userPhone || 'মোবাইল নম্বর যুক্ত নেই'}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70 py-3 text-center">
          <div className="px-2">
            <p className="text-[11px] sm:text-xs text-slate-500">মোট গ্রাহক</p>
            <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 tabular-nums">
              {formatNumberBn(customers.length)}
            </p>
          </div>
          <div className="px-2">
            <p className="text-[11px] sm:text-xs text-slate-500">মোট বাকি</p>
            <p className="mt-1 text-base sm:text-lg font-bold text-red-600 tabular-nums">
              {formatTaka(totalDue)}
            </p>
          </div>
          <div className="px-2">
            <p className="text-[11px] sm:text-xs text-slate-500">মোট লেনদেন</p>
            <p className="mt-1 text-base sm:text-lg font-bold text-blue-600 tabular-nums">
              {formatNumberBn(totalTransactionsCount)}
            </p>
          </div>
        </div>
      </section>

      {/* Edit Name Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Store className="h-5 w-5 text-red-600" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900">দোকান বা প্রোফাইলের নাম পরিবর্তন</h2>
        </div>

        <form onSubmit={handleUpdateName} className="mt-4 space-y-3.5">
          {nameError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {nameError}
            </div>
          )}
          {nameSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{nameSuccess}</span>
            </div>
          )}

          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1">
              নাম / দোকানের নাম
            </label>
            <input
              id="profile-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={100}
              required
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
            />
          </div>

          <div>
            <label
              htmlFor="profile-name-password"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              নিশ্চিত করতে পাসওয়ার্ড দিন <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="profile-name-password"
                type={showNamePwd ? 'text' : 'password'}
                value={namePassword}
                onChange={(e) => setNamePassword(e.target.value)}
                placeholder="আপনার অ্যাকাউন্টের পাসওয়ার্ড"
                required
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-11 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
              />
              <button
                type="button"
                onClick={() => setShowNamePwd((p) => !p)}
                aria-label={showNamePwd ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showNamePwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={nameSaving}
            className="min-h-[42px] rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {nameSaving ? 'সেভ হচ্ছে...' : 'নাম আপডেট করুন'}
          </button>
        </form>
      </section>

      {/* Change Password Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-red-600" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">পাসওয়ার্ড পরিবর্তন করুন</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPwdFields((p) => !p)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            {showPwdFields ? 'লুকান' : 'দেখান'}
          </button>
        </div>

        <form onSubmit={handleChangePassword} className="mt-4 space-y-3.5">
          {pwdError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{pwdSuccess}</span>
            </div>
          )}

          <div>
            <label htmlFor="pwd-current" className="block text-sm font-medium text-slate-700 mb-1">
              বর্তমান পাসওয়ার্ড
            </label>
            <input
              id="pwd-current"
              type={showPwdFields ? 'text' : 'password'}
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
              placeholder="বর্তমান পাসওয়ার্ড লিখুন"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pwd-new" className="block text-sm font-medium text-slate-700 mb-1">
                নতুন পাসওয়ার্ড
              </label>
              <input
                id="pwd-new"
                type={showPwdFields ? 'text' : 'password'}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                minLength={6}
                required
                placeholder="কমপক্ষে ৬ অক্ষর"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
              />
            </div>

            <div>
              <label htmlFor="pwd-confirm" className="block text-sm font-medium text-slate-700 mb-1">
                পুনরায় নতুন পাসওয়ার্ড
              </label>
              <input
                id="pwd-confirm"
                type={showPwdFields ? 'text' : 'password'}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                minLength={6}
                required
                placeholder="একই পাসওয়ার্ড আবার লিখুন"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pwdSaving}
            className="min-h-[42px] rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {pwdSaving ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
          </button>
        </form>
      </section>

      {/* Security Note & Logout */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            আপনার সকল গ্রাহক ও লেনদেনের তথ্য শুধুমাত্র আপনার অ্যাকাউন্টের অধীনে সুরক্ষিতভাবে সংরক্ষিত।
            যেকোনো হিসাব এডিট বা ডিলিট করতে অ্যাকাউন্টের পাসওয়ার্ড যাচাই করা হয়।
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>অ্যাকাউন্ট থেকে লগআউট করুন</span>
        </button>
      </section>

      {/* Developer & Support Info */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-2.5">
        <h2 className="text-sm font-bold text-slate-900">ডেভেলপার ও সাপোর্ট</h2>
        <p className="text-sm text-slate-600">
          Developer: <strong className="font-semibold text-slate-900">MD Rasel Islam Roni</strong>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-sm text-slate-600 tabular-nums">
            ডেভেলপার সাপোর্ট WhatsApp:{' '}
            <strong className="font-semibold text-slate-900">01797977609</strong>
          </p>
          <a
            href="https://wa.me/8801797977609"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>WhatsApp-এ যোগাযোগ</span>
          </a>
        </div>
      </section>
    </main>
  );
}
