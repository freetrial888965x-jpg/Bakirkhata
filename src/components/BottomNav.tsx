import { Home, ReceiptText, UserCircle, Users } from 'lucide-react';

export type NavTab = 'home' | 'customers' | 'transactions' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'হোম', icon: Home },
  { id: 'customers', label: 'গ্রাহক', icon: Users },
  { id: 'transactions', label: 'লেনদেন', icon: ReceiptText },
  { id: 'profile', label: 'প্রোফাইল', icon: UserCircle },
];

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  return (
    <nav
      aria-label="প্রধান নেভিগেশন"
      className="fixed bottom-0 left-0 right-0 z-40 bg-red-600 text-white shadow-[0_-4px_16px_rgba(220,38,38,0.18)]"
    >
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-4 items-center px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-full min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-white' : 'text-red-100/80 hover:text-white'
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                  isActive ? 'bg-white/20' : 'bg-transparent'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.9} />
              </span>
              <span
                className={`text-[11px] leading-none whitespace-nowrap ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
