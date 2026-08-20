import React from 'react';
import { Mic, Wifi, WifiOff, Sparkles, BookOpen } from 'lucide-react';

interface HeaderProps {
  isOffline: boolean;
  onOpenVoice: () => void;
  onNavigate: (tab: 'home' | 'customers' | 'ledger') => void;
}

export const Header: React.FC<HeaderProps> = ({ isOffline, onOpenVoice, onNavigate }) => {
  return (
    <header className="sticky top-0 z-30 bg-emerald-900 text-white shadow-md border-b border-emerald-800">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => onNavigate('home')}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-xl shadow-sm border border-amber-300">
            <BookOpen className="w-5 h-5 text-emerald-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-lg leading-tight tracking-tight text-amber-300">Hisab Kitab</h1>
              <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-1.5 py-0.5 rounded font-medium">
                Bahi-Khata
              </span>
            </div>
            <p className="text-[11px] text-emerald-200 font-medium">Bolkar hisaab rakho</p>
          </div>
        </div>

        {/* Right Status & Quick Mic */}
        <div className="flex items-center gap-2">
          {/* Offline / Online indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${
              isOffline
                ? 'bg-amber-900/60 text-amber-300 border-amber-600/50'
                : 'bg-emerald-800/60 text-emerald-200 border-emerald-700/50'
            }`}
            title={isOffline ? 'Offline Mode (Local Cache Active)' : 'Online Synced'}
          >
            {isOffline ? <WifiOff className="w-3 h-3 text-amber-400" /> : <Wifi className="w-3 h-3 text-emerald-400" />}
            <span className="hidden xs:inline">{isOffline ? 'Offline' : 'Online'}</span>
          </div>

          {/* Prominent Voice Trigger */}
          <button
            onClick={onOpenVoice}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-emerald-950 font-bold px-3 py-1.5 rounded-full text-xs shadow-md transition-all cursor-pointer"
            aria-label="Open Voice Recorder"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Boliye</span>
          </button>
        </div>
      </div>
    </header>
  );
};
