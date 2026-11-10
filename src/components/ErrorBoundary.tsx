import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">দুঃখিত, একটি সমস্যা হয়েছে</h2>
            <p className="mt-2 text-sm text-slate-600">
              তথ্য লোড বা সংরক্ষণ করতে সমস্যা দেখা দিয়েছে। অনুগ্রহ করে পেজটি রিলোড করে আবার চেষ্টা করুন।
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              পেজ রিলোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
