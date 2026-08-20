import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  Printer,
  FileText,
  Loader2,
  Calendar,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';
import { StatementData } from '../types';
import { fetchStatement } from '../services/api';
import { generateCustomerStatementPDF } from '../services/pdfGenerator';
import { shareOnWhatsApp, formatWhatsAppMessage } from '../services/whatsapp';

interface StatementModalProps {
  personId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const StatementModal: React.FC<StatementModalProps> = ({
  personId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && personId) {
      loadStatement(selectedPeriod);
    }
  }, [isOpen, personId, selectedPeriod]);

  const loadStatement = async (period: string) => {
    setLoading(true);
    try {
      const data = await fetchStatement(personId, period);
      setStatement(data);
    } catch (err) {
      console.error('Error fetching statement:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    if (!statement) return;
    const { doc, filename } = generateCustomerStatementPDF(statement);
    doc.save(filename);
    onSuccess(`📄 ${filename} download ho gaya!`);
  };

  const handleShareWhatsApp = () => {
    if (!statement) return;
    shareOnWhatsApp(statement);
    onSuccess(`💬 WhatsApp par bheja ja raha hai...`);
  };

  const handleCopyText = () => {
    if (!statement) return;
    const text = formatWhatsAppMessage(statement);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onSuccess(`📋 Message copy kar liya gaya!`);
  };

  const isLena = statement?.balance.balanceType === 'LENA_HAI';
  const isDena = statement?.balance.balanceType === 'DENA_HAI';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
        {/* Top bar */}
        <div className="bg-emerald-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-sm text-amber-300">Grahak Statement / Bill</h3>
              <p className="text-[11px] text-emerald-200">{statement?.person.name || 'Statement'}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-full text-emerald-300 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Period Selector Tabs */}
        <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Avadhi:</span>
          </span>
          <button
            onClick={() => setSelectedPeriod('all')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedPeriod === 'all' ? 'bg-emerald-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            Poora (All)
          </button>
          <button
            onClick={() => setSelectedPeriod('August 2026')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedPeriod === 'August 2026' ? 'bg-emerald-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            August 2026
          </button>
          <button
            onClick={() => setSelectedPeriod('This Month')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedPeriod === 'This Month' ? 'bg-emerald-800 text-white' : 'bg-stone-200 text-stone-700'
            }`}
          >
            Is Mahine
          </button>
        </div>

        {/* Preview Container */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {loading || !statement ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-stone-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
              <p>Statement banaya ja raha hai...</p>
            </div>
          ) : (
            <div className="bg-amber-50/40 border-2 border-dashed border-stone-300 rounded-2xl p-4 font-mono text-xs text-stone-800 space-y-3 shadow-inner">
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-stone-300">
                <h4 className="font-black text-sm text-emerald-950 uppercase tracking-wide">
                  {statement.shopName}
                </h4>
                <p className="text-[10px] text-stone-600 italic">{statement.tagline}</p>
                <p className="text-[10px] font-bold text-stone-700 mt-1">
                  Customer: {statement.person.name} {statement.person.phone ? `(+91 ${statement.person.phone})` : ''}
                </p>
                <p className="text-[9px] text-stone-500">
                  Period: {selectedPeriod === 'all' ? '01 Aug 2026 – 31 Aug 2026' : selectedPeriod}
                </p>
              </div>

              {/* Transactions Table Header */}
              <div className="flex justify-between font-bold text-[10px] text-stone-500 uppercase border-b border-stone-300 pb-1">
                <span className="w-16">Date</span>
                <span className="flex-1">Description</span>
                <span className="text-right w-20">Amount</span>
              </div>

              {/* Transaction list */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {statement.transactions.map((tx) => {
                  const isRec = tx.type === 'PAYMENT_RECEIVED' || tx.type === 'PAYMENT_MADE';
                  const d = new Date(tx.transaction_date);
                  const dateShort = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

                  return (
                    <div key={tx.id} className="flex justify-between items-center text-[11px]">
                      <span className="w-16 text-stone-500">{dateShort}</span>
                      <span className="flex-1 truncate pr-2">
                        {tx.description || (isRec ? 'Payment' : 'Goods')}
                      </span>
                      <span
                        className={`text-right w-20 font-bold ${
                          isRec ? 'text-amber-700' : 'text-emerald-800'
                        }`}
                      >
                        {isRec ? `- ₹${tx.amount}` : `+ ₹${tx.amount}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Summary Totals */}
              <div className="pt-2 border-t border-stone-300 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Total Given (Kul Diya):</span>
                  <span className="font-bold">₹{statement.balance.totalGiven.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Received (Kul Prapt):</span>
                  <span className="font-bold">₹{statement.balance.totalReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-stone-400 font-extrabold text-sm text-stone-950">
                  <span>BALANCE:</span>
                  <span className={isLena ? 'text-emerald-800' : 'text-amber-800'}>
                    ₹{statement.balance.netBalance.toLocaleString('en-IN')}{' '}
                    {isLena ? 'LENA HAI' : isDena ? 'DENA HAI' : 'CHUKTA'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* WhatsApp Share Button */}
            <button
              onClick={handleShareWhatsApp}
              disabled={loading || !statement}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-50 transition-all"
            >
              <MessageCircle className="w-4 h-4 text-emerald-100" />
              <span>WhatsApp Bhejein</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={loading || !statement}
              className="flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs shadow-sm cursor-pointer disabled:opacity-50 transition-all"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>PDF Download</span>
            </button>
          </div>

          <button
            onClick={handleCopyText}
            disabled={loading || !statement}
            className="w-full flex items-center justify-center gap-1.5 text-stone-700 hover:text-stone-900 font-semibold py-1.5 text-xs cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-400" />}
            <span>{copied ? 'Copied to clipboard!' : 'Copy Statement Text for SMS/Chat'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
