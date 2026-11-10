import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  FileDown,
  Lock,
  Pencil,
  Phone,
  PlusCircle,
  Share2,
  Trash2,
  Wallet,
} from 'lucide-react';
import { verifyAccountPassword } from '../services/ledgerService';
import { Customer, LedgerTransaction, TransactionType } from '../types/ledger';
import { computeBalance, formatDateTimeBn, formatTaka } from '../utils/format';
import { generateCustomerPdfReport, triggerBlobDownload } from '../utils/pdfReport';

interface CustomerDetailViewProps {
  shopName: string;
  shopPhone?: string;
  customer: Customer;
  transactions: LedgerTransaction[];
  loadingTransactions: boolean;
  onBack: () => void;
  onEditCustomer: () => void;
  onDeleteCustomer: () => Promise<void>;
  onAddTransaction: (type: TransactionType) => void;
  onEditTransaction: (tx: LedgerTransaction) => void;
  onDeleteTransaction: (txId: string) => Promise<void>;
}

export function CustomerDetailView({
  shopName,
  shopPhone,
  customer,
  transactions,
  loadingTransactions,
  onBack,
  onEditCustomer,
  onDeleteCustomer,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}: CustomerDetailViewProps) {
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<LedgerTransaction | null>(null);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);
  const [reportMessage, setReportMessage] = useState('');

  const totals = useMemo(() => {
    if (loadingTransactions) {
      return {
        totalDue: customer.totalDue,
        totalPayment: customer.totalPayment,
      };
    }
    const dueSum = transactions.reduce(
      (sum, t) => (t.type === 'due' ? sum + t.amount : sum),
      0
    );
    const paymentSum = transactions.reduce(
      (sum, t) => (t.type === 'payment' ? sum + t.amount : sum),
      0
    );
    return {
      totalDue: Math.round(dueSum * 100) / 100,
      totalPayment: Math.round(paymentSum * 100) / 100,
    };
  }, [loadingTransactions, transactions, customer.totalDue, customer.totalPayment]);

  const balance = computeBalance(totals.totalDue, totals.totalPayment);

  const closeDeleteModals = () => {
    setConfirmDeleteTx(null);
    setConfirmDeleteCustomer(false);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteError('');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        closeDeleteModals();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleting]);

  const handleConfirmDeleteTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmDeleteTx) return;
    if (!deletePassword) {
      setDeleteError('ডিলিট করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await verifyAccountPassword(deletePassword);
      await onDeleteTransaction(confirmDeleteTx.id);
      closeDeleteModals();
    } catch (err) {
      setDeleteError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'ডিলিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmDeleteCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError('গ্রাহক ডিলিট করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      await verifyAccountPassword(deletePassword);
      await onDeleteCustomer();
      closeDeleteModals();
    } catch (err) {
      setDeleteError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'ডিলিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfBusy('download');
    setReportMessage('');
    try {
      const { blob, fileName } = await generateCustomerPdfReport({
        shopName,
        shopPhone,
        customer,
        transactions,
        totalDue: totals.totalDue,
        totalPayment: totals.totalPayment,
      });
      triggerBlobDownload(blob, fileName);
      setReportMessage('PDF রিপোর্ট ডাউনলোড হয়েছে।');
    } catch {
      setReportMessage('PDF তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleSharePdf = async () => {
    setPdfBusy('share');
    setReportMessage('');
    try {
      const { blob, fileName, summaryText } = await generateCustomerPdfReport({
        shopName,
        shopPhone,
        customer,
        transactions,
        totalDue: totals.totalDue,
        totalPayment: totals.totalPayment,
      });
      const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        navigator.canShare?.({ files: [pdfFile] })
      ) {
        try {
          await navigator.share({
            title: `${customer.name} — হিসাব রিপোর্ট`,
            text: summaryText,
            files: [pdfFile],
          });
          setReportMessage('রিপোর্ট সফলভাবে শেয়ার করা হয়েছে।');
          return;
        } catch (shareErr) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
          // Fall back to download + clipboard copy below
        }
      }

      triggerBlobDownload(blob, fileName);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(summaryText);
          setReportMessage(
            'PDF ডাউনলোড হয়েছে এবং হিসাবের সারসংক্ষেপ কপি হয়েছে — এখন যেকোনো মাধ্যমে পাঠাতে পারবেন।'
          );
          return;
        } catch {
          // Clipboard permission optional
        }
      }
      setReportMessage('PDF রিপোর্ট ডাউনলোড হয়েছে — এখন ফাইলটি শেয়ার করতে পারবেন।');
    } catch {
      setReportMessage('রিপোর্ট শেয়ার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5 pb-24 sm:px-6 sm:py-8 sm:pb-24 space-y-5">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>ড্যাশবোর্ডে ফিরুন</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEditCustomer}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>এডিট</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDeletePassword('');
              setDeleteError('');
              setShowDeletePassword(false);
              setConfirmDeleteCustomer(true);
            }}
            aria-label="গ্রাহক ডিলিট করুন"
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Customer Summary Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{customer.name}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{customer.phone || 'মোবাইল নম্বর দেওয়া নেই'}</span>
            </p>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              {balance.status === 'due' && 'বর্তমান মোট বাকি'}
              {balance.status === 'advance' && 'বর্তমান মোট অগ্রিম'}
              {balance.status === 'settled' && 'বর্তমান হিসাব'}
            </p>
            <p
              className={`mt-1 text-2xl sm:text-3xl font-bold tabular-nums ${
                balance.status === 'due'
                  ? 'text-red-600'
                  : balance.status === 'advance'
                  ? 'text-emerald-600'
                  : 'text-slate-600'
              }`}
            >
              {balance.status === 'settled'
                ? 'কোনো বাকি বা অগ্রিম নেই'
                : formatTaka(balance.absAmount)}
            </p>
          </div>
        </div>

        {/* Clean Unboxed Totals Breakdown */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
          <span>
            মোট বাকি:{' '}
            <strong className="font-semibold text-red-600 tabular-nums">
              {formatTaka(totals.totalDue)}
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            মোট জমা:{' '}
            <strong className="font-semibold text-blue-600 tabular-nums">
              {formatTaka(totals.totalPayment)}
            </strong>
          </span>
        </div>

        {/* Action Buttons: Add Due (Red) & Add Payment (Blue) */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onAddTransaction('due')}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm sm:text-base font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span>বাকি যোগ করুন</span>
          </button>

          <button
            type="button"
            onClick={() => onAddTransaction('payment')}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm sm:text-base font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span>জমা যোগ করুন</span>
          </button>
        </div>

        {/* PDF Report Download & Share */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loadingTransactions || pdfBusy !== null}
            onClick={handleDownloadPdf}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <FileDown className="h-4 w-4 shrink-0 text-red-600" />
            <span>{pdfBusy === 'download' ? 'তৈরি হচ্ছে...' : 'PDF ডাউনলোড'}</span>
          </button>

          <button
            type="button"
            disabled={loadingTransactions || pdfBusy !== null}
            onClick={handleSharePdf}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Share2 className="h-4 w-4 shrink-0 text-blue-600" />
            <span>{pdfBusy === 'share' ? 'প্রস্তুত হচ্ছে...' : 'রিপোর্ট শেয়ার'}</span>
          </button>
        </div>

        {reportMessage && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{reportMessage}</span>
          </div>
        )}
      </section>

      {/* Transaction History */}
      <section aria-label="হিসাবের ইতিহাস" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">হিসাবের ইতিহাস</h2>
        </div>

        {loadingTransactions ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse"
              >
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="mt-3 h-3.5 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
            <p className="text-sm sm:text-base font-medium text-slate-700">
              এই গ্রাহকের এখনো কোনো লেনদেন যোগ করা হয়নি।
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              উপরের “বাকি যোগ করুন” অথবা “জমা যোগ করুন” বাটনে চাপ দিয়ে প্রথম হিসাব লিখুন।
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const isDue = tx.type === 'due';
              return (
                <article
                  key={tx.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span
                          className={`text-sm sm:text-base font-bold ${
                            isDue ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {isDue ? 'বাকি:' : 'জমা:'}
                        </span>
                        <span
                          className={`text-lg sm:text-xl font-bold tabular-nums ${
                            isDue ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {formatTaka(tx.amount)}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-500">
                        {formatDateTimeBn(tx.transactionDate)}
                      </p>

                      {tx.note && (
                        <p className="text-sm text-slate-700 pt-0.5 break-words">
                          <span className="text-slate-500">নোট: </span>
                          {tx.note}
                        </p>
                      )}
                    </div>

                    {/* Edit & Delete Controls */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>এডিট</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeletePassword('');
                          setDeleteError('');
                          setShowDeletePassword(false);
                          setConfirmDeleteTx(tx);
                        }}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>ডিলিট</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Transaction Confirmation Modal (Password Protected) */}
      {confirmDeleteTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmDeleteTx}
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xl space-y-4"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900">লেনদেন ডিলিট করবেন?</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                {confirmDeleteTx.type === 'due' ? 'বাকি' : 'জমা'}{' '}
                <strong className="text-slate-900 tabular-nums">
                  {formatTaka(confirmDeleteTx.amount)}
                </strong>{' '}
                মুছে ফেলা হলে গ্রাহকের মোট হিসাব স্বয়ংক্রিয়ভাবে পুনরায় হিসাব হবে।
              </p>
            </div>

            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <div>
              <label
                htmlFor="delete-tx-password"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                ডিলিট নিশ্চিত করতে পাসওয়ার্ড দিন <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="delete-tx-password"
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="আপনার অ্যাকাউন্টের পাসওয়ার্ড"
                  autoFocus
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-11 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword((p) => !p)}
                  aria-label={showDeletePassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteModals}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={deleting}
                className="min-h-[42px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
              >
                {deleting ? 'যাচাই হচ্ছে...' : 'ডিলিট করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Customer Confirmation Modal (Password Protected) */}
      {confirmDeleteCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmDeleteCustomer}
            className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xl space-y-4"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900">গ্রাহক ডিলিট করবেন?</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                <strong className="text-slate-900">{customer.name}</strong> এবং তাঁর সমস্ত বাকি ও
                জমার ইতিহাস স্থায়ীভাবে মুছে যাবে।
              </p>
            </div>

            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {deleteError}
              </div>
            )}

            <div>
              <label
                htmlFor="delete-customer-password"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                ডিলিট নিশ্চিত করতে পাসওয়ার্ড দিন <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="delete-customer-password"
                  type={showDeletePassword ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="আপনার অ্যাকাউন্টের পাসওয়ার্ড"
                  autoFocus
                  required
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white pl-9 pr-11 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword((p) => !p)}
                  aria-label={showDeletePassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={closeDeleteModals}
                className="min-h-[42px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={deleting}
                className="min-h-[42px] rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
              >
                {deleting ? 'যাচাই হচ্ছে...' : 'হ্যাঁ, ডিলিট করুন'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
