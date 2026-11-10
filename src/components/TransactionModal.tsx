import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Delete, Eye, EyeOff, Lock } from 'lucide-react';
import { verifyAccountPassword } from '../services/ledgerService';
import { Customer, TransactionType } from '../types/ledger';
import {
  computeBalance,
  evaluateCalculatorExpression,
  formatNumberBn,
  formatTaka,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../utils/format';

interface TransactionModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  customerName?: string;
  customers?: Customer[];
  selectedCustomerId?: string;
  onSelectCustomerId?: (id: string) => void;
  initialType: TransactionType;
  initialAmount?: number;
  initialNote?: string;
  initialDate?: Date;
  currentTotalDue: number;
  currentTotalPayment: number;
  editingOldType?: TransactionType;
  editingOldAmount?: number;
  onClose: () => void;
  onSave: (data: {
    type: TransactionType;
    amount: number;
    note: string;
    transactionDate: Date;
    customerId: string;
  }) => Promise<void>;
}

const OPERATORS = ['+', '-', '×', '÷'];

export function TransactionModal({
  isOpen,
  mode,
  customerName,
  customers,
  selectedCustomerId = '',
  onSelectCustomerId,
  initialType,
  initialAmount,
  initialNote = '',
  initialDate,
  currentTotalDue,
  currentTotalPayment,
  editingOldType,
  editingOldAmount = 0,
  onClose,
  onSave,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [expression, setExpression] = useState('');
  const [dateTimeInput, setDateTimeInput] = useState('');
  const [note, setNote] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setExpression(
        initialAmount !== undefined && initialAmount > 0 ? String(initialAmount) : ''
      );
      setDateTimeInput(toDateTimeLocalValue(initialDate ?? new Date()));
      setNote(initialNote);
      setShowDetails(Boolean(initialNote) || mode === 'edit');
      setPassword('');
      setShowPassword(false);
      setError('');
      setSaving(false);
    }
  }, [isOpen, mode, initialType, initialAmount, initialNote, initialDate]);

  const appendDigit = useCallback((digit: string) => {
    setError('');
    setExpression((prev) => {
      if (digit === '.') {
        const lastOpIdx = Math.max(
          prev.lastIndexOf('+'),
          prev.lastIndexOf('-'),
          prev.lastIndexOf('×'),
          prev.lastIndexOf('÷')
        );
        const currentToken = prev.slice(lastOpIdx + 1);
        if (currentToken.includes('.')) return prev;
        return currentToken === '' ? `${prev}0.` : `${prev}.`;
      }
      if (digit === '00') {
        if (prev === '' || prev === '0') return '0';
        const lastCh = prev.slice(-1);
        if (OPERATORS.includes(lastCh)) return `${prev}0`;
        return `${prev}00`;
      }
      if (prev === '0') return digit;
      return `${prev}${digit}`;
    });
  }, []);

  const appendOperator = useCallback((op: string) => {
    setError('');
    setExpression((prev) => {
      if (!prev) {
        return op === '-' ? '-' : '';
      }
      const lastCh = prev.slice(-1);
      if (OPERATORS.includes(lastCh)) {
        if (prev.length === 1 && lastCh === '-') return prev;
        return `${prev.slice(0, -1)}${op}`;
      }
      if (lastCh === '.') {
        return `${prev}0${op}`;
      }
      return `${prev}${op}`;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setError('');
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setError('');
    setExpression('');
  }, []);

  const handleEquals = useCallback(() => {
    setError('');
    setExpression((prev) => {
      if (!prev) return '';
      const result = evaluateCalculatorExpression(prev, true);
      if (result === null) {
        setError('সঠিক হিসাব লিখুন (০ দিয়ে ভাগ করা যায় না)।');
        return prev;
      }
      return String(result);
    });
  }, []);

  // Support physical keyboard input on desktop when not typing in note/datetime/password
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        appendDigit('.');
      } else if (e.key === '+') {
        e.preventDefault();
        appendOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        appendOperator('-');
      } else if (e.key === '*') {
        e.preventDefault();
        appendOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        appendOperator('÷');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isOpen,
    saving,
    onClose,
    appendDigit,
    appendOperator,
    handleBackspace,
    handleEquals,
    handleClear,
  ]);

  if (!isOpen) return null;

  const hasOperators = /[+\-×÷]/.test(expression.replace(/^-/, ''));
  const evaluatedValue = evaluateCalculatorExpression(expression, true);
  const displayAmount = evaluatedValue !== null && evaluatedValue >= 0 ? evaluatedValue : 0;
  const validPreviewAmount = evaluatedValue !== null && evaluatedValue > 0 ? evaluatedValue : 0;

  let baseDue = currentTotalDue;
  let basePayment = currentTotalPayment;
  if (mode === 'edit' && editingOldType) {
    if (editingOldType === 'due') baseDue = Math.max(0, baseDue - editingOldAmount);
    else basePayment = Math.max(0, basePayment - editingOldAmount);
  }
  const previewDue = type === 'due' ? baseDue + validPreviewAmount : baseDue;
  const previewPayment = type === 'payment' ? basePayment + validPreviewAmount : basePayment;
  const previewBalance = computeBalance(previewDue, previewPayment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('অনুগ্রহ করে একজন গ্রাহক নির্বাচন করুন।');
      return;
    }

    const finalAmount = evaluateCalculatorExpression(expression, true);
    if (finalAmount === null || finalAmount <= 0) {
      setError('টাকার পরিমাণ ০-এর বেশি হতে হবে।');
      return;
    }
    if (finalAmount > 100000000) {
      setError('টাকার পরিমাণ অনুমোদিত সীমার চেয়ে বেশি।');
      return;
    }
    if (mode === 'edit' && !password) {
      setError('হিসাব এডিট করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (mode === 'edit') {
        await verifyAccountPassword(password);
      }
      await onSave({
        type,
        amount: Math.round(finalAmount * 100) / 100,
        note: note.trim(),
        transactionDate: fromDateTimeLocalValue(dateTimeInput),
        customerId: selectedCustomerId,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'লেনদেন সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setSaving(false);
    }
  };

  const isDue = type === 'due';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <form
        onSubmit={handleSubmit}
        className="flex h-full w-full flex-col justify-between bg-slate-100 sm:h-auto sm:max-h-[94vh] sm:max-w-md sm:rounded-2xl sm:overflow-hidden sm:shadow-2xl"
      >
        {/* Top Colored Header (matching screenshot style) */}
        <div
          className={`flex h-14 shrink-0 items-center justify-between gap-3 px-3 text-white ${
            isDue ? 'bg-red-600' : 'bg-blue-600'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="বন্ধ করুন"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full hover:bg-white/15 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 id="tx-modal-title" className="text-base sm:text-lg font-bold truncate">
                {mode === 'edit'
                  ? 'লেনদেন এডিট করুন'
                  : isDue
                  ? 'বাকির পরিমাণ যোগ করুন'
                  : 'জমার পরিমাণ যোগ করুন'}
              </h2>
            </div>
          </div>

          {/* Quick Type Switcher */}
          <div className="flex items-center gap-1 rounded-full bg-black/15 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setType('due')}
              className={`min-h-[30px] rounded-full px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                isDue ? 'bg-white text-red-600' : 'text-white/90 hover:text-white'
              }`}
            >
              বাকি
            </button>
            <button
              type="button"
              onClick={() => setType('payment')}
              className={`min-h-[30px] rounded-full px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                !isDue ? 'bg-white text-blue-600' : 'text-white/90 hover:text-white'
              }`}
            >
              জমা
            </button>
          </div>
        </div>

        {/* Scrollable Middle Display & Optional Details */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Customer Selector or Name */}
          {customers && customers.length > 0 && onSelectCustomerId ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs">
              <label
                htmlFor="tx-customer-select"
                className="block text-[11px] font-medium text-slate-500 mb-1"
              >
                গ্রাহক নির্বাচন করুন
              </label>
              <select
                id="tx-customer-select"
                value={selectedCustomerId}
                onChange={(e) => onSelectCustomerId(e.target.value)}
                required
                className="w-full text-sm font-semibold text-slate-900 bg-transparent focus:outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : customerName ? (
            <div className="px-1 flex items-center justify-between text-xs sm:text-sm text-slate-600">
              <span>
                গ্রাহক: <strong className="font-bold text-slate-900">{customerName}</strong>
              </span>
              <span
                className={`font-semibold tabular-nums ${
                  previewBalance.status === 'due'
                    ? 'text-red-600'
                    : previewBalance.status === 'advance'
                    ? 'text-emerald-600'
                    : 'text-slate-500'
                }`}
              >
                {previewBalance.status === 'due' &&
                  `নতুন বাকি: ${formatTaka(previewBalance.absAmount)}`}
                {previewBalance.status === 'advance' &&
                  `নতুন অগ্রিম: ${formatTaka(previewBalance.absAmount)}`}
                {previewBalance.status === 'settled' && 'হিসাব: ৳ ০'}
              </span>
            </div>
          ) : null}

          {/* White Calculator Display Card (matching screenshot) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="text-2xl font-bold text-slate-400">৳</span>
              <div className="flex-1 min-w-0 text-right">
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums break-all leading-tight">
                  {expression || '0'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleBackspace}
                aria-label="একটি অক্ষর মুছুন"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            {/* Live Evaluated Result + Details Toggle */}
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <span>{showDetails ? 'নোট ও তারিখ লুকান' : 'নোট ও তারিখ লিখুন'}</span>
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {hasOperators && (
                <span className="font-bold text-slate-700 tabular-nums">
                  মোট: {evaluatedValue !== null ? formatTaka(evaluatedValue) : '...'}
                </span>
              )}
            </div>

            {showDetails && (
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                <div>
                  <label
                    htmlFor="tx-datetime-input"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    তারিখ ও সময়
                  </label>
                  <input
                    id="tx-datetime-input"
                    type="datetime-local"
                    value={dateTimeInput}
                    onChange={(e) => setDateTimeInput(e.target.value)}
                    required
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm text-slate-900 focus:border-red-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tx-note-input"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    নোট (ঐচ্ছিক)
                  </label>
                  <input
                    id="tx-note-input"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    placeholder="যেমন: চাল, ডাল বা নগদ পরিশোধ"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Password Verification when Editing */}
          {mode === 'edit' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
              <label
                htmlFor="tx-edit-password"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                হিসাব এডিট করতে পাসওয়ার্ড দিন <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="tx-edit-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="আপনার অ্যাকাউন্টের পাসওয়ার্ড"
                  required
                  className="w-full min-h-[40px] rounded-xl border border-slate-300 bg-white pl-9 pr-10 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Primary CTA + Calculator Keypad (matching screenshot) */}
        <div className="shrink-0 bg-slate-100 px-3.5 pb-4 pt-1 sm:px-4 sm:pb-4 space-y-2.5">
          <button
            type="submit"
            disabled={saving}
            className={`w-full min-h-[48px] rounded-xl px-4 py-2.5 text-base font-bold text-white shadow-sm disabled:opacity-60 transition-colors tabular-nums cursor-pointer ${
              isDue ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving
              ? 'সেভ হচ্ছে...'
              : mode === 'edit'
              ? `৳${formatNumberBn(displayAmount)} আপডেট করুন`
              : isDue
              ? `৳${formatNumberBn(displayAmount)} বাকি যোগ করুন`
              : `৳${formatNumberBn(displayAmount)} জমা যোগ করুন`}
          </button>

          {/* 4-Column Calculator Keypad */}
          <div className="grid grid-cols-4 gap-2 select-none">
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-base font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              CE
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="মুছুন"
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => appendDigit('00')}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-base font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => appendOperator('÷')}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-xl font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              ÷
            </button>

            {['7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-xl font-semibold text-slate-900 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendOperator('×')}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-xl font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              ×
            </button>

            {['4', '5', '6'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-xl font-semibold text-slate-900 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendOperator('-')}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-2xl font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              -
            </button>

            {['1', '2', '3'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => appendDigit(d)}
                className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-xl font-semibold text-slate-900 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => appendOperator('+')}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-2xl font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => appendDigit('0')}
              className="col-span-2 min-h-[48px] rounded-xl bg-white border border-slate-200 text-xl font-semibold text-slate-900 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => appendDigit('.')}
              className="min-h-[48px] rounded-xl bg-white border border-slate-200 text-2xl font-bold text-slate-900 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
            >
              .
            </button>
            <button
              type="button"
              onClick={handleEquals}
              aria-label="হিসাব করুন"
              className={`min-h-[48px] rounded-xl border text-2xl font-bold shadow-2xs active:scale-[0.98] transition-all cursor-pointer ${
                isDue
                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
            >
              =
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
