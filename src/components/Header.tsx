import { ChevronDown, LogOut, Store } from 'lucide-react';

interface HeaderProps {
  userName: string;
  onGoHome: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function Header({ userName, onGoHome, onOpenProfile, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b-2 border-red-600/85 shadow-xs rounded-b-2xl">
      <div className="mx-auto flex h-15 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Shop / Account Selector Chip */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="inline-flex min-h-[42px] max-w-[200px] sm:max-w-[260px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="truncate">{userName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>

        {/* Center/Right Brand & Logout */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onGoHome}
            className="text-base sm:text-lg font-bold tracking-tight text-red-600 whitespace-nowrap shrink-0 hover:text-red-700 transition-colors cursor-pointer"
          >
            📒 বাকির খাতা
          </button>

          <button
            type="button"
            onClick={onLogout}
            aria-label="লগআউট"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">লগআউট</span>
          </button>
        </div>
      </div>
    </header>
  );
}
