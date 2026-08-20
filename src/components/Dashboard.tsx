import React from 'react';
import {
  Mic,
  ArrowUpRight,
  ArrowDownLeft,
  UserPlus,
  ChevronRight,
  TrendingUp,
  Clock,
  Search,
  BookOpen,
} from 'lucide-react';
import { DashboardData, Person } from '../types';

interface DashboardProps {
  data: DashboardData | null;
  loading: boolean;
  onOpenVoice: () => void;
  onSelectCustomer: (personId: number) => void;
  onAddCustomer: () => void;
  onNavigateTab: (tab: 'home' | 'customers' | 'ledger') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  loading,
  onOpenVoice,
  onSelectCustomer,
  onAddCustomer,
  onNavigateTab,
}) => {
  const totalLenaHai = data?.totalLenaHai || 0;
  const totalDenaHai = data?.totalDenaHai || 0;
  const todayNet = data?.todayNet || 0;
  const recentPeople = data?.recentPeople || [];

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto px-4 pt-3">
      {/* 1. Hero Voice CTA Section */}
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-teal-950 text-white rounded-3xl p-5 text-center shadow-lg relative overflow-hidden border border-emerald-700/50">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-400/10 pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-emerald-500/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <span className="text-[11px] font-bold tracking-widest text-amber-300 uppercase px-2.5 py-0.5 bg-emerald-950/60 rounded-full mb-1">
            DIGITAL BAHI-KHATA
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">Hisab Kitab</h2>
          <p className="text-xs text-emerald-200 font-medium mt-0.5">“Bolkar hisaab rakho.”</p>

          {/* Big Center Mic Button */}
          <button
            onClick={onOpenVoice}
            className="mt-4 w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-300 text-emerald-950 flex flex-col items-center justify-center shadow-xl shadow-amber-500/20 border-4 border-emerald-950/40 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            aria-label="Bolkar hisaab jodein"
          >
            <Mic className="w-9 h-9 text-emerald-950 group-hover:scale-110 transition-transform" />
          </button>

          <p className="mt-2 text-xs font-bold text-amber-200">🎙️ Boliye...</p>
          <p className="text-[11px] text-emerald-300/80">“Ramesh se 500 lene hain”</p>
        </div>
      </div>

      {/* 2. LENA HAI / DENA HAI Main Balance Tiles */}
      <div className="grid grid-cols-2 gap-3">
        {/* LENA HAI (Receivables from Customers) */}
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
              LENA HAI
            </span>
            <div className="w-6 h-6 rounded-full bg-emerald-200/70 text-emerald-800 flex items-center justify-center">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-emerald-950">
              ₹{totalLenaHai.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-emerald-700 font-medium">Grahakon se aane hain</p>
          </div>
        </div>

        {/* DENA HAI (Payables to Suppliers / Advances) */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">
              DENA HAI
            </span>
            <div className="w-6 h-6 rounded-full bg-amber-200/70 text-amber-800 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2">
            <h3 className="text-xl font-extrabold text-amber-950">
              ₹{totalDenaHai.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-amber-700 font-medium">Vyapari ko dene hain</p>
          </div>
        </div>
      </div>

      {/* 3. TODAY'S NET SUMMARY */}
      <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
              TODAY (Aaj Ka Hisaab)
            </span>
            <div className="flex items-center gap-2">
              <p className="text-base font-black text-stone-900">
                {todayNet >= 0 ? `+ ₹${todayNet.toLocaleString('en-IN')}` : `- ₹${Math.abs(todayNet).toLocaleString('en-IN')}`}
              </p>
              <span className="text-[11px] text-stone-500 font-medium">
                (Diye: ₹{data?.todayGiven || 0} | Aaye: ₹{data?.todayReceived || 0})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={onAddCustomer}
          className="flex items-center justify-center gap-2 bg-white hover:bg-stone-50 active:scale-98 border border-stone-300 text-stone-800 font-bold py-2.5 px-3 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-emerald-700" />
          <span>+ Naya Grahak</span>
        </button>

        <button
          onClick={() => onNavigateTab('customers')}
          className="flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 active:scale-98 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-xs transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-amber-300" />
          <span>Sabhi Khate ({data?.customerCount || 0})</span>
        </button>
      </div>

      {/* 5. Recent Hisaab (Customer Balance Cards) */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-sm text-stone-900">Recent Hisaab</h3>
            <span className="text-[10px] text-stone-500 font-semibold bg-stone-100 px-1.5 py-0.5 rounded">
              Haal hi ke grahak
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('customers')}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center cursor-pointer"
          >
            <span>Sabhi Dekhein</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentPeople.length === 0 ? (
          <div className="py-6 text-center text-stone-400 text-xs">
            Abhi koi hisaab nahi hai. “Bolkar hisaab jodein”.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {recentPeople.slice(0, 6).map((person) => {
              const isLena = person.balanceType === 'LENA_HAI';
              const isDena = person.balanceType === 'DENA_HAI';
              const isSettled = person.balanceType === 'SETTLED' || !person.netBalance;

              return (
                <div
                  key={person.id}
                  onClick={() => onSelectCustomer(person.id)}
                  className="py-2.5 flex items-center justify-between hover:bg-stone-50 active:bg-stone-100 px-1 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 font-bold text-sm flex items-center justify-center border border-stone-200">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-stone-900 leading-snug">{person.name}</h4>
                      <p className="text-[11px] text-stone-500">
                        {person.phone ? `+91 ${person.phone}` : 'Grahak Khata'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {isLena && (
                      <div>
                        <p className="text-sm font-extrabold text-emerald-700">
                          ₹{person.netBalance?.toLocaleString('en-IN')}
                        </p>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">
                          lena hai
                        </span>
                      </div>
                    )}
                    {isDena && (
                      <div>
                        <p className="text-sm font-extrabold text-amber-700">
                          ₹{person.netBalance?.toLocaleString('en-IN')}
                        </p>
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">
                          dena hai
                        </span>
                      </div>
                    )}
                    {isSettled && (
                      <div>
                        <p className="text-sm font-bold text-stone-500">₹0</p>
                        <span className="text-[10px] font-medium text-stone-400">hisaab chukta</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
