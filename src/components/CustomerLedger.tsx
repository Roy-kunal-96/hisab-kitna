import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Search,
  Plus,
  Minus,
  Share2,
  FileText,
  RotateCcw,
  Mic,
  MessageCircle,
  AlertCircle,
  X,
  Clock,
  Filter,
} from 'lucide-react';
import { Person, Transaction, BalanceInfo } from '../types';
import { fetchPersonTransactions, reverseTransaction } from '../services/api';
import { shareOnWhatsApp } from '../services/whatsapp';

interface CustomerLedgerProps {
  personId: number;
  onBack: () => void;
  onOpenVoice: () => void;
  onOpenStatement: (personId: number) => void;
  onOpenManualTransaction: (personId: number, defaultType: 'RECEIVABLE' | 'PAYMENT_RECEIVED') => void;
  onSuccess: (message: string) => void;
}

export const CustomerLedger: React.FC<CustomerLedgerProps> = ({
  personId,
  onBack,
  onOpenVoice,
  onOpenStatement,
  onOpenManualTransaction,
  onSuccess,
}) => {
  const [person, setPerson] = useState<Person | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);

  // Reversal Confirmation state
  const [reversalTarget, setReversalTarget] = useState<Transaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchPersonTransactions(
        personId,
        filterPeriod,
        searchTerm,
        startDate,
        endDate
      );
      setPerson(res.person);
      setBalance(res.balance);
      setTransactions(res.transactions);
    } catch (err) {
      console.error('Error loading ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [personId, filterPeriod, searchTerm, startDate, endDate]);

  const handleReverse = async () => {
    if (!reversalTarget) return;
    setReversing(true);
    try {
      await reverseTransaction(
        reversalTarget.id,
        reversalReason || 'Galat transaction ki reversal entry'
      );
      onSuccess(`✅ Transaction #${reversalTarget.id} successfully reversed.`);
      setReversalTarget(null);
      setReversalReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Reversal failed');
    } finally {
      setReversing(false);
    }
  };

  const isLena = balance?.balanceType === 'LENA_HAI';
  const isDena = balance?.balanceType === 'DENA_HAI';
  const isSettled = balance?.balanceType === 'SETTLED' || !balance?.netBalance;

  return (
    <div className="space-y-4 pb-28 max-w-md mx-auto px-4 pt-3">
      {/* 1. Header with Back Button & WhatsApp Share */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Wapas</span>
        </button>

        <div className="flex items-center gap-2">
          {/* WhatsApp Direct Share */}
          <button
            onClick={() => onOpenStatement(personId)}
            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 2. Customer Profile & Big Balance Card */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-5 shadow-lg border border-stone-700">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-amber-300 uppercase px-2 py-0.5 bg-stone-800 rounded">
              GRAHAK LEDGER
            </span>
            <h2 className="text-xl font-black mt-1 text-white">{person?.name || 'Grahak'}</h2>
            {person?.phone && (
              <p className="text-xs text-stone-300 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-amber-300" />
                <span>+91 {person.phone}</span>
              </p>
            )}
          </div>

          <button
            onClick={onOpenVoice}
            className="w-10 h-10 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Bolkar entry karein"
          >
            <Mic className="w-5 h-5 text-emerald-950" />
          </button>
        </div>

        {/* Big Balance Box */}
        <div className="mt-4 pt-4 border-t border-stone-700/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Current Balance
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-2xl font-black">
                ₹{balance?.netBalance?.toLocaleString('en-IN') || 0}
              </h3>
              <span
                className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded ${
                  isLena
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : isDena
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : 'bg-stone-700 text-stone-300'
                }`}
              >
                {isLena ? 'LENA HAI' : isDena ? 'DENA HAI' : 'CHUKTA'}
              </span>
            </div>
          </div>

          {/* Statement & PDF Shortcut */}
          <button
            onClick={() => onOpenStatement(personId)}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl border border-stone-600 cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>PDF Bill</span>
          </button>
        </div>
      </div>

      {/* 3. Total Given vs Total Received Balance Strip */}
      <div className="grid grid-cols-3 gap-2 bg-stone-50 border border-stone-200 rounded-2xl p-3 text-center">
        <div>
          <span className="text-[10px] font-bold text-stone-500 uppercase">Total Given</span>
          <p className="text-sm font-bold text-emerald-800 mt-0.5">
            ₹{balance?.totalGiven?.toLocaleString('en-IN') || 0}
          </p>
        </div>
        <div className="border-x border-stone-200">
          <span className="text-[10px] font-bold text-stone-500 uppercase">Total Received</span>
          <p className="text-sm font-bold text-amber-800 mt-0.5">
            ₹{balance?.totalReceived?.toLocaleString('en-IN') || 0}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold text-stone-500 uppercase">Balance</span>
          <p className="text-sm font-black text-stone-900 mt-0.5">
            ₹{balance?.netBalance?.toLocaleString('en-IN') || 0}
          </p>
        </div>
      </div>

      {/* 4. Filters & Search */}
      <div className="space-y-2">
        {/* Period tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => {
              setFilterPeriod('all');
              setShowCustomDates(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              filterPeriod === 'all' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setFilterPeriod('today');
              setShowCustomDates(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              filterPeriod === 'today' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => {
              setFilterPeriod('week');
              setShowCustomDates(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              filterPeriod === 'week' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => {
              setFilterPeriod('month');
              setShowCustomDates(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              filterPeriod === 'month' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => {
              setFilterPeriod('custom');
              setShowCustomDates(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              filterPeriod === 'custom' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Custom Date Inputs if selected */}
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

        {/* Search within transactions */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Vivaran / Description khojein (e.g. Ration)..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 5. Transactions History List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 px-1">
          Hisaab Vivaran ({transactions.length})
        </h3>

        {transactions.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center text-stone-400 text-xs">
            Koi transaction nahi mila. Niche diye button se entry karein.
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
                  className={`border rounded-2xl p-3.5 flex items-center justify-between transition-all ${
                    isReversed
                      ? 'bg-stone-100/70 border-stone-300 opacity-60'
                      : isReversalEntry
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-white border-stone-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs mt-0.5 ${
                        isReversed
                          ? 'bg-stone-200 text-stone-500'
                          : isReceived
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {isReceived ? 'Liye' : 'Diye'}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4
                          className={`font-bold text-sm ${
                            isReversed ? 'line-through text-stone-500' : 'text-stone-900'
                          }`}
                        >
                          {tx.description || (isReceived ? 'Payment Received' : 'Samaan Diya')}
                        </h4>
                        {isReversed && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                            REVERSED
                          </span>
                        )}
                        {isReversalEntry && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            AUDIT CORRECTION
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                        <span>{dateStr}</span>
                        <span>•</span>
                        <span className="uppercase text-[10px] font-semibold">{tx.type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p
                        className={`text-base font-black ${
                          isReversed
                            ? 'line-through text-stone-400'
                            : isReceived
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {isReceived ? `- ₹${tx.amount.toLocaleString('en-IN')}` : `+ ₹${tx.amount.toLocaleString('en-IN')}`}
                      </p>
                    </div>

                    {/* Correction / Reversal Action (IMMUTABLE AUDIT TRAIL) */}
                    {!isReversed && !isReversalEntry && (
                      <button
                        onClick={() => setReversalTarget(tx)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        title="Galat entry ko reverse karein"
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

      {/* 6. Fixed Bottom Action Bar for Customer (Maine Diye / Boliye / Maine Liye) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <button
            onClick={() => onOpenManualTransaction(personId, 'RECEIVABLE')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-black py-3 px-3 rounded-2xl text-xs shadow-md transition-all cursor-pointer min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">MAINE DIYE (₹ +)</span>
          </button>

          <button
            onClick={onOpenVoice}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white flex flex-col items-center justify-center shadow-lg shadow-emerald-800/40 border-2 border-amber-300 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Bolkar hisaab jodein"
          >
            <Mic className="w-5 h-5 text-amber-300" />
          </button>

          <button
            onClick={() => onOpenManualTransaction(personId, 'PAYMENT_RECEIVED')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-black py-3 px-3 rounded-2xl text-xs shadow-md transition-all cursor-pointer min-h-[44px]"
          >
            <Minus className="w-4 h-4 text-white shrink-0" />
            <span className="truncate">MAINE LIYE (₹ -)</span>
          </button>
        </div>
      </div>

      {/* 7. Reversal Confirmation Modal (Immutability guarantee) */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200">
            <div className="bg-rose-700 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">Transaction Reverse Karein</h3>
              </div>
              <button onClick={() => setReversalTarget(null)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1">
                <p className="text-stone-500 font-medium">Target Entry:</p>
                <p className="font-bold text-stone-900">
                  {reversalTarget.description || 'Transaction'} - ₹{reversalTarget.amount} ({reversalTarget.type})
                </p>
                <p className="text-[11px] text-stone-400">Date: {reversalTarget.transaction_date}</p>
              </div>

              <p className="text-xs text-stone-600">
                ⚠️ <strong className="text-stone-900">Bahi-Khata Niyam:</strong> Purana record delete nahi hota. Ek naya <strong>Reversal Record</strong> banta hai jisse audit trail surakshit rahe.
              </p>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Karan / Reason for reversal (Optional):
                </label>
                <input
                  type="text"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Galti se 500 likh diya tha..."
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Radd Karein
                </button>
                <button
                  type="button"
                  onClick={handleReverse}
                  disabled={reversing}
                  className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow cursor-pointer disabled:opacity-50"
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
