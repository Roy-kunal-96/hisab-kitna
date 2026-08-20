import React from 'react';
import { Home, Users, Mic, BookOpen } from 'lucide-react';

interface NavigationProps {
  activeTab: 'home' | 'customers' | 'ledger';
  onTabChange: (tab: 'home' | 'customers' | 'ledger') => void;
  onOpenVoice: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, onOpenVoice }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-2xl pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto px-3 py-1.5 flex items-center justify-around relative">
        {/* 1. Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'home'
              ? 'text-emerald-900 font-extrabold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'home' ? 'bg-emerald-100/80 text-emerald-900 shadow-xs' : ''
            }`}
          >
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Home</span>
        </button>

        {/* 2. Customers */}
        <button
          onClick={() => onTabChange('customers')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'customers'
              ? 'text-emerald-900 font-extrabold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'customers' ? 'bg-emerald-100/80 text-emerald-900 shadow-xs' : ''
            }`}
          >
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Customers</span>
        </button>

        {/* 3. Central Prominent Voice Mic CTA */}
        <div className="flex-1 flex flex-col items-center justify-center relative -top-3.5 px-1">
          <button
            onClick={onOpenVoice}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-800 via-emerald-700 to-emerald-600 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-900/35 border-4 border-white hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-amber-400/50"
            aria-label="Bolkar Hisaab Rakho"
          >
            <Mic className="w-6 h-6 text-amber-300 animate-bounce" />
          </button>
          <span className="text-[10px] font-black text-emerald-950 mt-0.5 bg-amber-200/90 text-amber-950 px-2 py-0.2 rounded-full border border-amber-300/80 shadow-2xs whitespace-nowrap">
            🎙️ Voice
          </span>
        </div>

        {/* 4. Ledger */}
        <button
          onClick={() => onTabChange('ledger')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'ledger'
              ? 'text-emerald-900 font-extrabold'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activeTab === 'ledger' ? 'bg-emerald-100/80 text-emerald-900 shadow-xs' : ''
            }`}
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Ledger</span>
        </button>
      </div>
    </nav>
  );
};
