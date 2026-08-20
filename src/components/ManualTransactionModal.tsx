import React, { useState } from 'react';
import { X, Check, Plus, Minus, Tag, Calendar, User, DollarSign } from 'lucide-react';
import { Person, TransactionType } from '../types';
import { createTransaction } from '../services/api';

interface ManualTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId?: number;
  people: Person[];
  defaultType?: 'RECEIVABLE' | 'PAYMENT_RECEIVED';
  onSuccess: (msg: string) => void;
}

const AMOUNT_PRESETS = [50, 100, 200, 500, 1000, 2000];
const TAG_PRESETS = [
  'Ration',
  'Doodh',
  'Cheeni & Chai',
  'Tel & Masala',
  'Kirana Samaan',
  'Cash Payment',
  'UPI GPay',
  'Purana Baqi',
];

export const ManualTransactionModal: React.FC<ManualTransactionModalProps> = ({
  isOpen,
  onClose,
  personId,
  people,
  defaultType = 'RECEIVABLE',
  onSuccess,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<number>(personId || (people[0]?.id ?? 1));
  const [txType, setTxType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Sahi rupaye (amount) likhein.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await createTransaction({
        person_id: selectedPersonId,
        amount: numAmount,
        type: txType,
        description: description.trim() || (txType === 'RECEIVABLE' ? 'Samaan Diya' : 'Payment Received'),
        transaction_date: date,
      });

      const pName = res.person?.name || 'Grahak';
      onSuccess(`✅ ${pName} ke khate mein ₹${numAmount} darj ho gaye!`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Transaction save nahi ho paya.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200">
        {/* Header with Type Selector */}
        <div
          className={`px-4 py-3.5 text-white flex items-center justify-between transition-colors ${
            txType === 'RECEIVABLE' ? 'bg-emerald-800' : 'bg-amber-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {txType === 'RECEIVABLE' ? <Plus className="w-5 h-5 text-amber-300" /> : <Minus className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                {txType === 'RECEIVABLE' ? 'Maine Diye (Lena Hai)' : 'Maine Liye (Jama / Payment)'}
              </h3>
              <p className="text-[11px] text-white/80">Khate mein entry karein</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-full text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Type Toggle Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
            <button
              type="button"
              onClick={() => setTxType('RECEIVABLE')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                txType === 'RECEIVABLE'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              + Maine Diye (Udhar)
            </button>

            <button
              type="button"
              onClick={() => setTxType('PAYMENT_RECEIVED')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                txType === 'PAYMENT_RECEIVED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              - Maine Liye (Jama)
            </button>
          </div>

          {/* Customer Selection if multiple */}
          {!personId && (
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-stone-500" />
                <span>Grahak Chunein *</span>
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(parseInt(e.target.value, 10))}
                className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl bg-white font-semibold focus:ring-2 focus:ring-emerald-500"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `(${p.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount Input with big numbers */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-stone-500" />
              <span>Rupaye (Amount) *</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-black text-stone-500">
                ₹
              </span>
              <input
                type="number"
                step="any"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full text-lg font-black pl-8 pr-4 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-stone-900"
              />
            </div>

            {/* Quick preset amount chips */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="px-2.5 py-1 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg cursor-pointer transition-all"
                >
                  +₹{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Description with quick chips */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-stone-500" />
              <span>Vivaran / Samaan (Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ration, Chawal, Cash..."
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex flex-wrap gap-1 mt-1.5">
              {TAG_PRESETS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setDescription(tag)}
                  className="text-[10px] font-semibold bg-stone-50 hover:bg-stone-100 text-stone-600 px-2 py-0.5 rounded border border-stone-200 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <span>Tarikh (Date)</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
            >
              Radd Karein
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 flex items-center justify-center gap-1.5 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md cursor-pointer disabled:opacity-50 transition-all ${
                txType === 'RECEIVABLE' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Save ho raha hai...' : 'Hisaab Save Karein'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
