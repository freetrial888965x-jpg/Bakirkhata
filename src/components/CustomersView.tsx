import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronRight,
  Plus,
  PlusCircle,
  Search,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Customer, TransactionType } from '../types/ledger';
import { computeBalance, convertBengaliDigits, formatNumberBn, formatTaka } from '../utils/format';

interface CustomersViewProps {
  customers: Customer[];
  loading: boolean;
  onSelectCustomer: (customerId: string) => void;
  onOpenAddCustomer: () => void;
  onQuickTransaction: (customer: Customer, type: TransactionType) => void;
}

type StatusFilter = 'all' | 'due' | 'advance' | 'settled';
type SortOption = 'recent' | 'due_desc' | 'advance_desc' | 'name_asc';

export function CustomersView({
  customers,
  loading,
  onSelectCustomer,
  onOpenAddCustomer,
  onQuickTransaction,
}: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const counts = useMemo(() => {
    let due = 0;
    let advance = 0;
    let settled = 0;
    for (const c of customers) {
      const bal = computeBalance(c.totalDue, c.totalPayment);
      if (bal.status === 'due') due += 1;
      else if (bal.status === 'advance') advance += 1;
      else settled += 1;
    }
    return { all: customers.length, due, advance, settled };
  }, [customers]);

  const filteredAndSortedCustomers = useMemo(() => {
    const q = convertBengaliDigits(searchQuery.trim()).toLowerCase();

    const filtered = customers.filter((c) => {
      if (q) {
        const nameMatch = convertBengaliDigits(c.name).toLowerCase().includes(q);
        const phoneMatch = convertBengaliDigits(c.phone).toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch) return false;
      }
      if (statusFilter !== 'all') {
        const bal = computeBalance(c.totalDue, c.totalPayment);
        if (bal.status !== statusFilter) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'bn');
      if (sortBy === 'due_desc') {
        return (
          computeBalance(b.totalDue, b.totalPayment).net -
          computeBalance(a.totalDue, a.totalPayment).net
        );
      }
      if (sortBy === 'advance_desc') {
        return (
          computeBalance(a.totalDue, a.totalPayment).net -
          computeBalance(b.totalDue, b.totalPayment).net
        );
      }
      const timeA = (a.updatedAt ?? a.createdAt)?.getTime() ?? 0;
      const timeB = (b.updatedAt ?? b.createdAt)?.getTime() ?? 0;
      return timeB - timeA;
    });

    return sorted;
  }, [customers, searchQuery, statusFilter, sortBy]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">গ্রাহক তালিকা</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            মোট {formatNumberBn(counts.all)} জন গ্রাহক
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddCustomer}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন গ্রাহক যোগ</span>
        </button>
      </div>

      {/* Search & Filters */}
      <section className="space-y-3">
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
            className="w-full min-h-[46px] rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-600/15"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="অনুসন্ধান মুছুন"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="গ্রাহক ফিল্টার"
            className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              সবাই ({formatNumberBn(counts.all)})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'due'}
              onClick={() => setStatusFilter('due')}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                statusFilter === 'due'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-red-600'
              }`}
            >
              বাকি ({formatNumberBn(counts.due)})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'advance'}
              onClick={() => setStatusFilter('advance')}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                statusFilter === 'advance'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-emerald-600'
              }`}
            >
              অগ্রিম ({formatNumberBn(counts.advance)})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'settled'}
              onClick={() => setStatusFilter('settled')}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                statusFilter === 'settled'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              পরিশোধিত ({formatNumberBn(counts.settled)})
            </button>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <ArrowUpDown className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="তালিকা সাজান"
              className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-xs focus:border-red-600 focus:outline-none cursor-pointer"
            >
              <option value="recent">সাম্প্রতিক লেনদেন</option>
              <option value="due_desc">বেশি বাকি আগে</option>
              <option value="advance_desc">বেশি অগ্রিম আগে</option>
              <option value="name_asc">নাম অনুযায়ী (ক-হ)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-36 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse"
            >
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
              <div className="mt-6 h-8 w-full rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            এখনো কোনো গ্রাহক যোগ করা হয়নি
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
            বাকি ও জমার হিসাব রাখতে আপনার প্রথম গ্রাহক যোগ করুন।
          </p>
          <button
            type="button"
            onClick={onOpenAddCustomer}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ নতুন গ্রাহক যোগ করুন</span>
          </button>
        </div>
      ) : filteredAndSortedCustomers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xs">
          <p className="text-sm sm:text-base font-medium text-slate-700">
            নির্বাচিত ফিল্টার বা অনুসন্ধানে কোনো গ্রাহক পাওয়া যায়নি।
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-3 text-sm font-semibold text-red-600 hover:text-red-700 cursor-pointer"
          >
            সব গ্রাহক দেখুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAndSortedCustomers.map((customer) => {
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
                className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs hover:border-red-300 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between gap-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-red-700 transition-colors">
                      {customer.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {customer.phone || 'মোবাইল নম্বর নেই'}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-red-500 transition-colors mt-0.5"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    {balance.status === 'due' && (
                      <>
                        <span className="text-slate-600">মোট বাকি:</span>
                        <span className="text-base font-bold text-red-600 tabular-nums">
                          {formatTaka(balance.absAmount)}
                        </span>
                      </>
                    )}
                    {balance.status === 'advance' && (
                      <>
                        <span className="text-slate-600">মোট অগ্রিম:</span>
                        <span className="text-base font-bold text-emerald-600 tabular-nums">
                          {formatTaka(balance.absAmount)}
                        </span>
                      </>
                    )}
                    {balance.status === 'settled' && (
                      <>
                        <span className="text-slate-500">হিসাব পরিশোধিত</span>
                        <span className="text-base font-semibold text-slate-500 tabular-nums">
                          ৳ ০
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 tabular-nums">
                    বাকি: {formatTaka(customer.totalDue)} · জমা: {formatTaka(customer.totalPayment)}
                  </p>
                </div>

                <div
                  className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onQuickTransaction(customer, 'due')}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>বাকি যোগ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickTransaction(customer, 'payment')}
                    className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap cursor-pointer"
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
    </main>
  );
}
