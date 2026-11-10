import { useMemo, useState } from 'react';
import {
  ChevronRight,
  PlusCircle,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Customer, LedgerTransaction, TransactionType } from '../types/ledger';
import { computeBalance, convertBengaliDigits, formatNumberBn, formatTaka } from '../utils/format';

export type TimeRangeFilter = 'day' | 'month' | 'year' | 'all';

interface HomeViewProps {
  customers: Customer[];
  allTransactions: LedgerTransaction[];
  loading: boolean;
  loadingAllTx: boolean;
  onRefreshSummary: () => void;
  onSelectCustomer: (customerId: string) => void;
  onGoToCustomersTab: () => void;
  onOpenAddCustomer: () => void;
  onQuickActionTransaction: (type: TransactionType, customer?: Customer) => void;
}

export function HomeView({
  customers,
  allTransactions,
  loading,
  loadingAllTx,
  onRefreshSummary,
  onSelectCustomer,
  onGoToCustomersTab,
  onOpenAddCustomer,
  onQuickActionTransaction,
}: HomeViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Overall customer ledger totals (always up to date from customer docs)
  const ledgerSummary = useMemo(() => {
    let totalRemainingDue = 0;
    let totalAdvance = 0;
    let dueCustomers = 0;
    let advanceCustomers = 0;
    let grossDue = 0;
    let grossPayment = 0;

    for (const c of customers) {
      grossDue += c.totalDue;
      grossPayment += c.totalPayment;
      const bal = computeBalance(c.totalDue, c.totalPayment);
      if (bal.status === 'due') {
        totalRemainingDue += bal.absAmount;
        dueCustomers += 1;
      } else if (bal.status === 'advance') {
        totalAdvance += bal.absAmount;
        advanceCustomers += 1;
      }
    }

    const collectionRate =
      grossDue > 0 ? Math.min(100, Math.round((grossPayment / grossDue) * 100)) : 0;

    return {
      totalCustomers: customers.length,
      dueCustomers,
      advanceCustomers,
      totalRemainingDue: Math.round(totalRemainingDue * 100) / 100,
      totalAdvance: Math.round(totalAdvance * 100) / 100,
      grossDue: Math.round(grossDue * 100) / 100,
      grossPayment: Math.round(grossPayment * 100) / 100,
      collectionRate,
    };
  }, [customers]);

  // Period-filtered due given & payment collected from allTransactions
  const periodStats = useMemo(() => {
    if (timeRange === 'all') {
      return {
        dueGiven: ledgerSummary.grossDue,
        paymentCollected: ledgerSummary.grossPayment,
      };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    const threshold =
      timeRange === 'day'
        ? startOfToday
        : timeRange === 'month'
        ? startOfMonth
        : startOfYear;

    let dueGiven = 0;
    let paymentCollected = 0;

    for (const tx of allTransactions) {
      if (tx.transactionDate.getTime() >= threshold) {
        if (tx.type === 'due') dueGiven += tx.amount;
        else paymentCollected += tx.amount;
      }
    }

    return {
      dueGiven: Math.round(dueGiven * 100) / 100,
      paymentCollected: Math.round(paymentCollected * 100) / 100,
    };
  }, [timeRange, allTransactions, ledgerSummary.grossDue, ledgerSummary.grossPayment]);

  const filteredCustomers = useMemo(() => {
    const q = convertBengaliDigits(searchQuery.trim()).toLowerCase();
    const list = q
      ? customers.filter((c) => {
          const nameMatch = convertBengaliDigits(c.name).toLowerCase().includes(q);
          const phoneMatch = convertBengaliDigits(c.phone).toLowerCase().includes(q);
          return nameMatch || phoneMatch;
        })
      : customers;
    return q ? list : list.slice(0, 6);
  }, [customers, searchQuery]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-24 space-y-5">
      {/* Card 1: সারাংশ (Summary Card matching screenshot architecture) */}
      <section
        aria-label="হিসাবের সারাংশ"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">সারাংশ</h2>
            <button
              type="button"
              onClick={onRefreshSummary}
              aria-label="তথ্য রিফ্রেশ করুন"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loadingAllTx ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Segmented Time Filter: দিন | মাস | বছর | এই পর্যন্ত */}
          <div
            role="tablist"
            aria-label="সময় অনুযায়ী সারাংশ"
            className="inline-flex items-center rounded-full bg-slate-100 p-1"
          >
            {(
              [
                { id: 'day', label: 'দিন' },
                { id: 'month', label: 'মাস' },
                { id: 'year', label: 'বছর' },
                { id: 'all', label: 'এই পর্যন্ত' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={timeRange === tab.id}
                onClick={() => setTimeRange(tab.id)}
                className={`min-h-[34px] rounded-full px-3 py-1 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  timeRange === tab.id
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hairline-divided 4x2 / 2x4 Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
          <div className="p-3 text-center">
            <p className="text-[11px] sm:text-xs text-slate-500">বাকি দেওয়া</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-red-600 tabular-nums">
              {formatTaka(periodStats.dueGiven)}
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[11px] sm:text-xs text-slate-500">বাকি আদায়</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-blue-600 tabular-nums">
              {formatTaka(periodStats.paymentCollected)}
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[11px] sm:text-xs text-slate-500">অবশিষ্ট বাকি</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-red-600 tabular-nums">
              {formatTaka(ledgerSummary.totalRemainingDue)}
            </p>
          </div>
          <div className="p-3 text-center">
            <p className="text-[11px] sm:text-xs text-slate-500">মোট অগ্রিম</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-emerald-600 tabular-nums">
              {formatTaka(ledgerSummary.totalAdvance)}
            </p>
          </div>

          <div className="p-3 text-center bg-slate-50/40">
            <p className="text-[11px] sm:text-xs text-slate-500">মোট গ্রাহক</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-slate-900 tabular-nums">
              {formatNumberBn(ledgerSummary.totalCustomers)}
            </p>
          </div>
          <div className="p-3 text-center bg-slate-50/40">
            <p className="text-[11px] sm:text-xs text-slate-500">বাকি গ্রাহক</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-red-600 tabular-nums">
              {formatNumberBn(ledgerSummary.dueCustomers)}
            </p>
          </div>
          <div className="p-3 text-center bg-slate-50/40">
            <p className="text-[11px] sm:text-xs text-slate-500">অগ্রিম গ্রাহক</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-emerald-600 tabular-nums">
              {formatNumberBn(ledgerSummary.advanceCustomers)}
            </p>
          </div>
          <div className="p-3 text-center bg-slate-50/40">
            <p className="text-[11px] sm:text-xs text-slate-500">আদায়ের হার</p>
            <p className="mt-1 text-sm sm:text-base font-bold text-slate-800 tabular-nums">
              {formatNumberBn(ledgerSummary.collectionRate)}%
            </p>
          </div>
        </div>
      </section>

      {/* Card 2: দ্রুত হিসাব ও পরিচালনা (Circular Icon Grid matching screenshot) */}
      <section aria-label="দ্রুত কার্যক্রম" className="space-y-2.5">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 px-1">হিসাব পরিচালনা</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            <button
              type="button"
              onClick={onGoToCustomersTab}
              className="group flex flex-col items-center gap-2 rounded-xl py-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-sky-100 text-sky-600 group-hover:scale-105 transition-transform">
                <Users className="h-6 w-6" />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
                কাস্টমার
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="group flex flex-col items-center gap-2 rounded-xl py-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 group-hover:scale-105 transition-transform">
                <UserPlus className="h-6 w-6" />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
                নতুন গ্রাহক
              </span>
            </button>

            <button
              type="button"
              onClick={() => onQuickActionTransaction('due')}
              className="group flex flex-col items-center gap-2 rounded-xl py-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-red-100 text-red-600 group-hover:scale-105 transition-transform">
                <PlusCircle className="h-6 w-6" />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
                বাকি যোগ
              </span>
            </button>

            <button
              type="button"
              onClick={() => onQuickActionTransaction('payment')}
              className="group flex flex-col items-center gap-2 rounded-xl py-2 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:scale-105 transition-transform">
                <Wallet className="h-6 w-6" />
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-800 text-center">
                জমা যোগ
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Search & Recent Customer Cards */}
      <section aria-label="সাম্প্রতিক গ্রাহক" className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">সাম্প্রতিক গ্রাহক</h2>
          {customers.length > 0 && (
            <button
              type="button"
              onClick={onGoToCustomersTab}
              className="text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 cursor-pointer"
            >
              সব দেখুন ({formatNumberBn(customers.length)}) →
            </button>
          )}
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম বা মোবাইল নম্বর দিয়ে গ্রাহক খুঁজুন..."
            aria-label="গ্রাহক খুঁজুন"
            className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="অনুসন্ধান মুছুন"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse"
              >
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
            <p className="text-sm sm:text-base font-semibold text-slate-800">
              এখনো কোনো গ্রাহক যোগ করা হয়নি
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              উপরের “নতুন গ্রাহক” আইকনে ক্লিক করে প্রথম গ্রাহক যোগ করুন।
            </p>
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ নতুন গ্রাহক যোগ করুন</span>
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-xs">
            <p className="text-sm font-medium text-slate-700">
              “{searchQuery}” নামে বা নম্বরে কোনো গ্রাহক পাওয়া যায়নি।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCustomers.map((customer) => {
              const balance = computeBalance(customer.totalDue, customer.totalPayment);
              return (
                <div
                  key={customer.id}
                  onClick={() => onSelectCustomer(customer.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectCustomer(customer.id);
                    }
                  }}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-red-700 transition-colors">
                        {customer.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {customer.phone || 'মোবাইল নম্বর নেই'}
                      </p>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-red-500"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    {balance.status === 'due' && (
                      <>
                        <span className="text-slate-600">মোট বাকি:</span>
                        <span className="font-bold text-red-600 tabular-nums">
                          {formatTaka(balance.absAmount)}
                        </span>
                      </>
                    )}
                    {balance.status === 'advance' && (
                      <>
                        <span className="text-slate-600">মোট অগ্রিম:</span>
                        <span className="font-bold text-emerald-600 tabular-nums">
                          {formatTaka(balance.absAmount)}
                        </span>
                      </>
                    )}
                    {balance.status === 'settled' && (
                      <span className="text-slate-500">কোনো বাকি বা অগ্রিম নেই</span>
                    )}
                  </div>

                  <div
                    className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onQuickActionTransaction('due', customer)}
                      className="min-h-[36px] inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>বাকি যোগ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickActionTransaction('payment', customer)}
                      className="min-h-[36px] inline-flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Wallet className="h-3.5 w-3.5 shrink-0" />
                      <span>জমা যোগ</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
