import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, X } from 'lucide-react';
import { verifyAccountPassword } from '../services/ledgerService';

interface AddCustomerModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialName?: string;
  initialPhone?: string;
  onClose: () => void;
  onSave: (data: { name: string; phone: string }) => Promise<void>;
}

export function AddCustomerModal({
  isOpen,
  mode,
  initialName = '',
  initialPhone = '',
  onClose,
  onSave,
}: AddCustomerModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPhone(initialPhone);
      setPassword('');
      setShowPassword(false);
      setError('');
      setSaving(false);
    }
  }, [isOpen, initialName, initialPhone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('গ্রাহকের নাম দেওয়া আবশ্যক।');
      return;
    }
    if (mode === 'edit' && !password) {
      setError('তথ্য এডিট করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (mode === 'edit') {
        await verifyAccountPassword(password);
      }
      await onSave({ name: trimmedName, phone: phone.trim() });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'তথ্য সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-modal-title"
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <h2 id="customer-modal-title" className="text-lg font-bold text-slate-900">
            {mode === 'create' ? 'নতুন গ্রাহক যোগ করুন' : 'গ্রাহকের তথ্য এডিট করুন'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="customer-name-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              গ্রাহকের নাম <span className="text-red-600">*</span>
            </label>
            <input
              id="customer-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="যেমন: জামাল কাকা"
              autoFocus
              required
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
            />
          </div>

          <div>
            <label
              htmlFor="customer-phone-input"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              মোবাইল নম্বর <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
            </label>
            <input
              id="customer-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              placeholder="যেমন: 017XXXXXXXX"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
            />
          </div>

          {mode === 'edit' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
              <label
                htmlFor="customer-edit-password"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                এডিট নিশ্চিত করতে পাসওয়ার্ড দিন <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="customer-edit-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="আপনার অ্যাকাউন্টের পাসওয়ার্ড"
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-11 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving ? 'যাচাই হচ্ছে...' : 'সেভ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
