import React, { useState } from 'react';
import { Search, UserPlus, Phone, ArrowUpRight, ArrowDownLeft, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { Person } from '../types';
import { createPerson } from '../services/api';

interface CustomerListProps {
  people: Person[];
  loading: boolean;
  onSelectCustomer: (personId: number) => void;
  onRefresh: () => void;
  onOpenVoice: () => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  people,
  loading,
  onSelectCustomer,
  onRefresh,
  onOpenVoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LENA_HAI' | 'DENA_HAI' | 'SETTLED'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [initialType, setInitialType] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredPeople = people.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.phone && p.phone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (filterType === 'LENA_HAI') return p.balanceType === 'LENA_HAI' && (p.netBalance || 0) > 0;
    if (filterType === 'DENA_HAI') return p.balanceType === 'DENA_HAI' && (p.netBalance || 0) > 0;
    if (filterType === 'SETTLED') return p.balanceType === 'SETTLED' || !p.netBalance;

    return true;
  });

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('Grahak ka naam zaroori hai.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await createPerson({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        initialBalance: initialBalance ? parseFloat(initialBalance) : undefined,
        initialType: initialType,
      });

      setNewName('');
      setNewPhone('');
      setInitialBalance('');
      setShowAddModal(false);
      onRefresh();
      if (res.person?.id) {
        onSelectCustomer(res.person.id);
      }
    } catch (err: any) {
      setFormError(err.message || 'Customer jodte samay truti hui.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pb-24 max-w-md mx-auto px-4 pt-3">
      {/* Search & Top Action Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Grahak ka naam ya phone khojein..."
            className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4 text-amber-300" />
          <span>+ Grahak</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            filterType === 'ALL'
              ? 'bg-stone-900 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Sabhi ({people.length})
        </button>

        <button
          onClick={() => setFilterType('LENA_HAI')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            filterType === 'LENA_HAI'
              ? 'bg-emerald-700 text-white'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          Lena Hai
        </button>

        <button
          onClick={() => setFilterType('DENA_HAI')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            filterType === 'DENA_HAI'
              ? 'bg-amber-700 text-white'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          Dena Hai
        </button>

        <button
          onClick={() => setFilterType('SETTLED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            filterType === 'SETTLED'
              ? 'bg-stone-600 text-white'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          Chukta (0)
        </button>
      </div>

      {/* Customer Cards List */}
      <div className="space-y-2">
        {filteredPeople.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-stone-600">Koi grahak nahi mila</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>Naya Grahak Jodein</span>
            </button>
          </div>
        ) : (
          filteredPeople.map((person) => {
            const isLena = person.balanceType === 'LENA_HAI';
            const isDena = person.balanceType === 'DENA_HAI';
            const isSettled = person.balanceType === 'SETTLED' || !person.netBalance;

            return (
              <div
                key={person.id}
                onClick={() => onSelectCustomer(person.id)}
                className="bg-white hover:bg-stone-50 active:bg-stone-100 border border-stone-200 rounded-2xl p-3.5 flex items-center justify-between shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100/70 text-emerald-900 font-black text-base flex items-center justify-center border border-emerald-200">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">{person.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                      {person.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{person.phone}</span>
                        </span>
                      )}
                      <span>•</span>
                      <span>{person.transactionCount || 0} entries</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div>
                    {isLena && (
                      <div>
                        <p className="text-base font-black text-emerald-700">
                          ₹{person.netBalance?.toLocaleString('en-IN')}
                        </p>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">
                          LENA HAI
                        </span>
                      </div>
                    )}
                    {isDena && (
                      <div>
                        <p className="text-base font-black text-amber-700">
                          ₹{person.netBalance?.toLocaleString('en-IN')}
                        </p>
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">
                          DENA HAI
                        </span>
                      </div>
                    )}
                    {isSettled && (
                      <div>
                        <p className="text-base font-bold text-stone-400">₹0</p>
                        <span className="text-[10px] font-medium text-stone-400">CHUKTA</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-200">
            <div className="bg-emerald-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm text-amber-300">Naya Grahak Jodein</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-emerald-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-4 space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Grahak Ka Naam *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mobile Number (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Purana Baqi Hisaab (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="₹ 0"
                    className="flex-1 text-xs px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                  <select
                    value={initialType}
                    onChange={(e: any) => setInitialType(e.target.value)}
                    className="text-xs px-2 py-2 border border-stone-300 rounded-xl bg-stone-50 font-bold"
                  >
                    <option value="RECEIVABLE">Lena Hai</option>
                    <option value="PAYABLE">Dena Hai</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100"
                >
                  Radd Karein
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-5 py-2 rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Jod rahe hain...' : 'Grahak Jodein'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
