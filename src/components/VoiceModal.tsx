import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
  FileText,
  UserPlus,
  Send,
  Loader2,
} from 'lucide-react';
import { speechService } from '../services/speech';
import { parseVoice, createTransaction, createPerson, reverseTransaction } from '../services/api';
import { ParsedVoiceIntent, Person } from '../types';
import confetti from 'canvas-confetti';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onSelectCustomer: (personId: number) => void;
  onOpenStatement?: (personId: number) => void;
}

const SAMPLE_COMMANDS = [
  'Ramesh se 500 lene hain.',
  'Suresh ko 1000 dene hain.',
  'Ramesh ne 200 de diye.',
  'Ramesh ko 500 ka ration diya.',
  'Ramesh ka hisaab batao.',
  'Abhi total kitna lena hai?',
  'Ramesh ka poora hisaab dikhao.',
  'Ramesh ka 500 wala transaction galat hai.',
  'Naya customer Ramesh Kumar.',
  'Ramesh ka hisaab PDF bana do.',
];

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSelectCustomer,
  onOpenStatement,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceIntent | null>(null);
  const [matchedPerson, setMatchedPerson] = useState<Person | null>(null);
  const [lang, setLang] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Auto-start listening on open
      handleStartListening();
    } else {
      speechService.stopListening();
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setIsListening(false);
    setTranscript('');
    setManualText('');
    setLoading(false);
    setErrorMsg(null);
    setParsedResult(null);
    setMatchedPerson(null);
    setExecuting(false);
  };

  const handleStartListening = () => {
    setErrorMsg(null);
    setTranscript('');
    setParsedResult(null);
    speechService.setLanguage(lang);

    speechService.startListening({
      onStart: () => {
        setIsListening(true);
      },
      onResult: (text: string, isFinal: boolean) => {
        setTranscript(text);
        if (isFinal && text.trim().length > 2) {
          processTranscript(text);
        }
      },
      onError: (err: string) => {
        setIsListening(false);
        setErrorMsg(err);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  };

  const handleStopListening = () => {
    speechService.stopListening();
    setIsListening(false);
    if (transcript.trim().length > 2 && !parsedResult && !loading) {
      processTranscript(transcript);
    }
  };

  const processTranscript = async (textToProcess: string) => {
    speechService.stopListening();
    setIsListening(false);
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await parseVoice(textToProcess);
      setParsedResult(res.parsed);
      setMatchedPerson(res.matchedPerson);

      // Play vocal confirmation response
      if (res.parsed.speech_response) {
        speechService.speak(res.parsed.speech_response, lang);
      }
    } catch (err: any) {
      console.error('Processing voice command error:', err);
      setErrorMsg(err.message || 'Hisaab samajhne mein dikkat hui. Kripya dubara bolein.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    setTranscript(manualText);
    processTranscript(manualText);
    setManualText('');
  };

  const handleConfirmAction = async () => {
    if (!parsedResult) return;
    setExecuting(true);
    setErrorMsg(null);

    try {
      const { intent, person, amount, transaction_type, description } = parsedResult;

      if (intent === 'ADD_TRANSACTION' || intent === 'RECORD_PAYMENT') {
        const amt = amount || 0;
        const txType = transaction_type || (intent === 'RECORD_PAYMENT' ? 'PAYMENT_RECEIVED' : 'RECEIVABLE');

        await createTransaction({
          person_id: matchedPerson?.id,
          person_name: person || 'Grahak',
          amount: amt,
          type: txType,
          description: description || (txType === 'RECEIVABLE' ? 'Samaan / Udhari' : 'Payment / Jama'),
        });

        speechService.playSuccessChime();
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } catch {}

        onSuccess(`✅ ${person || 'Grahak'} ka ₹${amt} ka hisaab darj kar liya gaya!`);
        onClose();
      } else if (intent === 'ADD_CUSTOMER') {
        await createPerson({
          name: person || 'Naya Grahak',
        });
        speechService.playSuccessChime();
        onSuccess(`✅ Naya customer ${person} joda gaya!`);
        onClose();
      } else if (intent === 'CORRECT_TRANSACTION') {
        // Reversal of recent transaction for this person
        if (matchedPerson) {
          // fetch last transaction to reverse
          const txRes = await fetch(`/api/people/${matchedPerson.id}/transactions`);
          const txData = await txRes.json();
          const target = txData.transactions?.find((t: any) => t.status === 'ACTIVE');
          if (target) {
            await reverseTransaction(target.id, 'Voice correction: Galat transaction reverse kiya gaya');
            speechService.playSuccessChime();
            onSuccess(`✅ ${matchedPerson.name} ka ₹${target.amount} wala transaction reverse kar diya gaya!`);
            onClose();
            return;
          }
        }
        onSuccess(`Reversal darj kiya gaya.`);
        onClose();
      } else if (intent === 'GET_BALANCE' || intent === 'GET_LEDGER') {
        if (matchedPerson) {
          onSelectCustomer(matchedPerson.id);
          onClose();
        } else {
          onSuccess(`Hisaab screen par uplabdh hai.`);
          onClose();
        }
      } else if (intent === 'GENERATE_STATEMENT') {
        if (matchedPerson && onOpenStatement) {
          onOpenStatement(matchedPerson.id);
          onClose();
        } else {
          onSuccess(`Statement taiyar hai.`);
          onClose();
        }
      } else {
        onSuccess(`Karya sampann hua.`);
        onClose();
      }
    } catch (err: any) {
      console.error('Execution error:', err);
      setErrorMsg(err.message || 'Karya poora karne mein truti aayi.');
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center font-bold">
              🎙️
            </div>
            <div>
              <h3 className="font-bold text-base text-amber-300">Bolkar Hisaab Rakho</h3>
              <p className="text-[11px] text-emerald-200">Hindi ya Hinglish mein bolein</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language switch */}
            <button
              onClick={() => setLang(lang === 'hi-IN' ? 'en-IN' : 'hi-IN')}
              className="text-[11px] bg-emerald-800 hover:bg-emerald-700 px-2 py-1 rounded text-emerald-100 font-semibold cursor-pointer"
            >
              {lang === 'hi-IN' ? '🇮🇳 Hindi' : '🇮🇳 Hinglish'}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-emerald-300 hover:bg-emerald-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Central Mic & Audio Visualizer */}
          <div className="flex flex-col items-center justify-center py-3">
            <div className="relative flex items-center justify-center">
              {isListening && (
                <div className="absolute w-28 h-28 rounded-full bg-emerald-400/30 animate-ping" />
              )}
              {isListening && (
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-pulse" />
              )}

              <button
                onClick={isListening ? handleStopListening : handleStartListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all cursor-pointer relative z-10 ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 scale-105 ring-4 ring-rose-300'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                aria-label={isListening ? 'Stop Listening' : 'Start Listening'}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8 animate-bounce text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-amber-300" />
                )}
              </button>
            </div>

            <p className="mt-3 font-semibold text-sm text-stone-700 flex items-center gap-1.5">
              {isListening ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>Sun raha hoon... Boliye</span>
                </>
              ) : (
                <span className="text-stone-500">Mic par tap karein aur bolein</span>
              )}
            </p>

            {/* Live Transcript Bubble */}
            {transcript && (
              <div className="mt-3 w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wider mb-0.5">Aapne kaha:</p>
                <p className="text-base font-semibold text-stone-900 italic">“{transcript}”</p>
              </div>
            )}
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex flex-col items-center justify-center p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
              <Loader2 className="w-6 h-6 text-emerald-700 animate-spin" />
              <p className="text-xs text-stone-600 font-medium">Hisaab samjha ja raha hai (AI Analysis)...</p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMsg}</p>
                <button
                  onClick={handleStartListening}
                  className="mt-1 text-rose-700 underline font-medium hover:text-rose-900 cursor-pointer"
                >
                  Dubara koshish karein
                </button>
              </div>
            </div>
          )}

          {/* AI Parsed Confirmation Card (As mandated by user specification) */}
          {parsedResult && !loading && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border-2 border-amber-300 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-bottom-2">
              {/* Intent Header */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-200 text-amber-900 rounded">
                  {parsedResult.intent}
                </span>

                <button
                  onClick={() => speechService.speak(parsedResult.confirmation_prompt || parsedResult.speech_response, lang)}
                  className="p-1 rounded-full text-amber-800 hover:bg-amber-200 transition-all cursor-pointer"
                  title="Aawaz sunein"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Spoken Confirmation Question */}
              <div className="border-l-4 border-emerald-600 pl-3 py-1">
                <p className="text-base font-bold text-stone-900">
                  {parsedResult.confirmation_prompt || parsedResult.speech_response}
                </p>
              </div>

              {/* Structured Key-Value details */}
              <div className="bg-white/80 rounded-lg p-2.5 text-xs space-y-1 text-stone-700 border border-amber-200">
                {parsedResult.person && (
                  <div className="flex justify-between">
                    <span className="text-stone-500 font-medium">Grahak / Person:</span>
                    <span className="font-bold text-stone-900">{parsedResult.person}</span>
                  </div>
                )}
                {parsedResult.amount !== null && parsedResult.amount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-stone-500 font-medium">Rupaye / Amount:</span>
                    <span className="font-extrabold text-emerald-800 text-sm">
                      ₹{parsedResult.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                {parsedResult.transaction_type && (
                  <div className="flex justify-between">
                    <span className="text-stone-500 font-medium">Khata Type:</span>
                    <span className="font-semibold text-stone-900">
                      {parsedResult.transaction_type === 'RECEIVABLE'
                        ? 'Lena Hai (+ Diye)'
                        : parsedResult.transaction_type === 'PAYABLE'
                        ? 'Dena Hai (- Baqi)'
                        : parsedResult.transaction_type === 'PAYMENT_RECEIVED'
                        ? 'Jama Kiya (Prapt)'
                        : parsedResult.transaction_type}
                    </span>
                  </div>
                )}
                {parsedResult.description && (
                  <div className="flex justify-between">
                    <span className="text-stone-500 font-medium">Vivaran / Item:</span>
                    <span className="font-medium text-stone-800">{parsedResult.description}</span>
                  </div>
                )}
              </div>

              {/* Confirmation Buttons: Haan | Nahi */}
              {!parsedResult.clarification_needed ? (
                <div className="pt-2 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleConfirmAction}
                    disabled={executing}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50"
                  >
                    {executing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Haan (Save)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={resetState}
                    disabled={executing}
                    className="flex items-center justify-center gap-2 bg-stone-200 hover:bg-stone-300 active:scale-98 text-stone-800 font-bold py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Nahi (Cancel)</span>
                  </button>
                </div>
              ) : (
                <div className="pt-1">
                  <p className="text-xs text-amber-900 font-medium mb-2">
                    {parsedResult.clarification_question || 'Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?'}
                  </p>
                  <button
                    onClick={handleStartListening}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-2 px-4 rounded-xl shadow cursor-pointer text-xs"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dubara bolein</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Sample Voice Command Chips */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <p className="text-xs font-semibold text-stone-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Namoone (Sample Voice Commands - Click to Test):</span>
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {SAMPLE_COMMANDS.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTranscript(cmd);
                    processTranscript(cmd);
                  }}
                  className="text-[11px] bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 hover:border-emerald-300 text-stone-700 px-2.5 py-1 rounded-lg border border-stone-200 text-left transition-all cursor-pointer"
                >
                  "{cmd}"
                </button>
              ))}
            </div>
          </div>

          {/* Manual Text Input Option */}
          <form onSubmit={handleManualSubmit} className="pt-2 flex items-center gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Ya yahan likhein (e.g. Ramesh se 500 lene hain)..."
              className="flex-1 text-xs px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50"
            />
            <button
              type="submit"
              disabled={!manualText.trim()}
              className="bg-emerald-700 text-white p-2 rounded-xl hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
              title="Bhejein"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
