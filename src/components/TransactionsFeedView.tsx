import { useMemo, useState } from 'react';
import { ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import { Customer, LedgerTransaction } from '../types/ledger';
import { formatDateTimeBn, formatNumberBn, formatTaka } from '../utils/format';

interface TransactionsFeedViewProps {
  customers: Customer[];
  transactions: LedgerTransaction[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCustomer: (customerId: string) => void;
}

type TxFilter = 'all' | 'due' | 'payment';

export function TransactionsFeedView({
  customers,
  transactions,
  loading,
  onRefresh,
  onSelectCustomer,
}: TransactionsFeedViewProps) {
  const [filter, setFilter] = useState<TxFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.id, c);
    return map;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filter !== 'all' && tx.type !== filter) return false;
      if (q) {
        const cust = customerMap.get(tx.customerId);
        const nameMatch = (cust?.name ?? '').toLowerCase().includes(q);
        const noteMatch = tx.note.toLowerCase().includes(q);
        if (!nameMatch && !noteMatch) return false;
      }
      return true;
    });
  }, [transactions, filter, searchQuery, customerMap]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">সকল লেনদেন</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            মোট {formatNumberBn(transactions.length)} টি লেনদেন
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ</span>
        </button>
      </div>

      {/* Search & Type Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="গ্রাহকের নাম বা নোট দিয়ে খুঁজুন..."
            aria-label="লেনদেন খুঁজুন"
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

        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            সব
          </button>
          <button
            type="button"
            onClick={() => setFilter('due')}
            className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              filter === 'due' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-red-600'
            }`}
          >
            বাকি
          </button>
          <button
            type="button"
            onClick={() => setFilter('payment')}
            className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              filter === 'payment'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            জমা
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="mt-2.5 h-3.5 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xs">
          <p className="text-sm sm:text-base font-medium text-slate-700">
            কোনো লেনদেন পাওয়া যায়নি।
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((tx) => {
            const cust = customerMap.get(tx.customerId);
            const isDue = tx.type === 'due';
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => onSelectCustomer(tx.customerId)}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 shadow-xs hover:border-red-300 transition-all flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 truncate">
                      {cust?.name || 'গ্রাহক'}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        isDue ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      {isDue ? 'বাকি' : 'জমা'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTimeBn(tx.transactionDate)}</p>
                  {tx.note && (
                    <p className="text-xs sm:text-sm text-slate-600 truncate">নোট: {tx.note}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-base sm:text-lg font-bold tabular-nums ${
                      isDue ? 'text-red-600' : 'text-blue-600'
                    }`}
                  >
                    {formatTaka(tx.amount)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
