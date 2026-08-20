import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scale,
  RotateCcw,
  AlertCircle,
  X,
  FileText,
  Share2,
} from 'lucide-react';
import { Transaction } from '../types';
import { fetchDaybook, reverseTransaction } from '../services/api';

interface GeneralLedgerProps {
  onSelectCustomer: (personId: number) => void;
  onOpenVoice: () => void;
  onSuccess: (msg: string) => void;
}

export const GeneralLedger: React.FC<GeneralLedgerProps> = ({
  onSelectCustomer,
  onOpenVoice,
  onSuccess,
}) => {
  const [transactions, setTransactions] = useState<
    (Transaction & { person_name: string; person_phone?: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Metrics
  const [totalGiven, setTotalGiven] = useState(0);
  const [totalReceived, setTotalReceived] = useState(0);
  const [netTotal, setNetTotal] = useState(0);

  // Reversal target modal
  const [reversalTarget, setReversalTarget] = useState<Transaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await fetchDaybook(filterPeriod, searchTerm, startDate, endDate);
      setTransactions(res.transactions);
      setTotalGiven(res.totalGiven);
      setTotalReceived(res.totalReceived);
      setNetTotal(res.netTotal);
    } catch (err) {
      console.error('Failed to load daybook:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [filterPeriod, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTransactions();
  };

  const handleConfirmReversal = async () => {
    if (!reversalTarget) return;
    try {
      setReversing(true);
      await reverseTransaction(reversalTarget.id, reversalReason);
      setReversalTarget(null);
      setReversalReason('');
      onSuccess(`Entry #${reversalTarget.id} successfully reverse ho gayi!`);
      loadTransactions();
    } catch (err: any) {
      alert(`Reversal failed: ${err.message}`);
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* 1. Header Title & Quick Voice */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-stone-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-800" />
            Roznamcha (Daybook)
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Sabhi grahakon ka pura hisaab aur len-den
          </p>
        </div>
        <button
          onClick={onOpenVoice}
          className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-emerald-100 cursor-pointer shadow-xs transition-all"
        >
          <span>🎙️ Boliye</span>
        </button>
      </div>

      {/* 2. Consolidated Balance Card */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-5 shadow-lg border border-stone-800 relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider uppercase text-stone-400">
              Total Daybook Summary
            </span>
            <span className="text-[10px] font-bold bg-stone-700/80 px-2 py-0.5 rounded-full text-stone-300">
              {transactions.length} Entries
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-emerald-950/60 border border-emerald-500/30 rounded-2xl p-3">
              <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span>Diye (Receivable)</span>
              </div>
              <p className="text-lg font-black text-emerald-300">
                + ₹{totalGiven.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-amber-950/60 border border-amber-500/30 rounded-2xl p-3">
              <div className="flex items-center gap-1 text-amber-400 text-xs font-bold mb-1">
                <ArrowDownLeft className="w-4 h-4" />
                <span>Liye (Received)</span>
              </div>
              <p className="text-lg font-black text-amber-300">
                - ₹{totalReceived.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-stone-700/60 flex items-center justify-between text-xs">
            <span className="text-stone-300 font-medium">Net Daybook Balance:</span>
            <span className={`font-black text-sm ${netTotal >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {netTotal >= 0 ? `+ ₹${netTotal.toLocaleString('en-IN')} (Lena)` : `- ₹${Math.abs(netTotal).toLocaleString('en-IN')} (Dena)`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search */}
      <div className="bg-white border border-stone-200 rounded-2xl p-3 space-y-3 shadow-xs">
        {/* Period Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Sabhi (All)' },
            { id: 'today', label: 'Aaj (Today)' },
            { id: 'week', label: 'Is Hafte (7 Days)' },
            { id: 'month', label: 'Is Mahine (30 Days)' },
            { id: 'custom', label: 'Custom Date' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterPeriod(tab.id as any);
                if (tab.id === 'custom') {
                  setShowCustomDates(true);
                } else {
                  setShowCustomDates(false);
                }
              }}
              className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterPeriod === tab.id
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {showCustomDates && (
          <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-xl border border-stone-200 text-xs">
            <div className="flex-1">
              <span className="block text-[10px] text-stone-500 font-bold mb-0.5">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg px-2 py-1"
              />
            </div>
            <div className="flex-1">
              <span className="block text-[10px] text-stone-500 font-bold mb-0.5">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg px-2 py-1"
              />
            </div>
          </div>
        )}

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Grahak ka naam ya vivaran khojein..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-16 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-emerald-800 text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-emerald-900"
          >
            Khojein
          </button>
        </form>
      </div>

      {/* 4. Transactions Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Hisaab Soochi ({transactions.length})
          </h2>
          <span className="text-[10px] text-stone-400 font-medium">Tarikha ke anusaar</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-stone-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-500 text-xs">
            <BookOpen className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="font-bold text-stone-700">Koi transaction nahi mila</p>
            <p className="text-stone-400 text-[11px] mt-1">
              Mic button daba kar naya hisaab bolein.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isReceived = tx.type === 'PAYMENT_RECEIVED' || tx.type === 'PAYMENT_MADE';
              const isReversed = tx.status === 'REVERSED';
              const isReversalEntry = tx.type === 'REVERSAL';

              const d = new Date(tx.transaction_date);
              const dateStr = d.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div
                  key={tx.id}
                  className={`border rounded-2xl p-3 flex items-center justify-between transition-all ${
                    isReversed
                      ? 'bg-stone-100/70 border-stone-300 opacity-60'
                      : isReversalEntry
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-white border-stone-200 shadow-xs hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      onClick={() => onSelectCustomer(tx.person_id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer ${
                        isReversed
                          ? 'bg-stone-200 text-stone-500'
                          : isReversalEntry
                          ? 'bg-rose-100 text-rose-700'
                          : isReceived
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                      title="Grahak ka hisaab dekhein"
                    >
                      {tx.person_name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          onClick={() => onSelectCustomer(tx.person_id)}
                          className="font-black text-xs text-stone-900 hover:text-emerald-800 truncate cursor-pointer"
                        >
                          {tx.person_name}
                        </span>
                        {isReversed && (
                          <span className="bg-stone-200 text-stone-600 text-[9px] px-1.5 py-0.2 rounded font-bold">
                            REVERSED
                          </span>
                        )}
                        {isReversalEntry && (
                          <span className="bg-rose-200 text-rose-800 text-[9px] px-1.5 py-0.2 rounded font-bold">
                            CORRECTION
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-stone-500 truncate mt-0.5">
                        {tx.description || (isReceived ? 'Bhugtan mila' : 'Udhar saman')}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                        <span>{dateStr}</span>
                        <span>•</span>
                        <span className="font-semibold text-stone-500">#{tx.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      <p
                        className={`text-sm font-black ${
                          isReversed
                            ? 'line-through text-stone-400'
                            : isReceived
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {isReceived
                          ? `- ₹${tx.amount.toLocaleString('en-IN')}`
                          : `+ ₹${tx.amount.toLocaleString('en-IN')}`}
                      </p>
                      <button
                        onClick={() => onSelectCustomer(tx.person_id)}
                        className="text-[10px] text-emerald-800 font-bold hover:underline flex items-center justify-end gap-0.5 cursor-pointer mt-0.5"
                      >
                        <span>Khata</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Correction / Reversal Action */}
                    {!isReversed && !isReversalEntry && (
                      <button
                        onClick={() => setReversalTarget(tx)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Galat entry reverse karein"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Reversal Confirmation Modal */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200">
            <div className="bg-rose-700 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Transaction Reverse Karein</h3>
              </div>
              <button
                onClick={() => setReversalTarget(null)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-1">
                <p className="text-stone-500">Target Transaction:</p>
                <p className="font-bold text-stone-900">
                  #{reversalTarget.id} — ₹{reversalTarget.amount.toLocaleString('en-IN')} (
                  {reversalTarget.type})
                </p>
                <p className="text-stone-600">{reversalTarget.description || 'No description'}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">
                  Reversal ka Karan / Reason (Optional):
                </label>
                <input
                  type="text"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Galat amount daala tha..."
                  className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                💡 <strong>Double-entry audit guarantee:</strong> Purani entry delete nahi hogi.
                Uska status REVERSED ho jayega aur ek nayi counter-entry banegi.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Radd Karein
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReversal}
                  disabled={reversing}
                  className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md disabled:opacity-50"
                >
                  {reversing ? 'Reversing...' : 'Haan, Reverse Karein'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
