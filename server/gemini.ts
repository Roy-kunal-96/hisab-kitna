import { GoogleGenAI, Type } from '@google/genai';

export interface ParsedVoiceIntent {
  intent:
    | 'ADD_TRANSACTION'
    | 'RECORD_PAYMENT'
    | 'ADD_CUSTOMER'
    | 'GET_BALANCE'
    | 'GET_LEDGER'
    | 'GET_TRANSACTION'
    | 'GET_TOTAL'
    | 'GENERATE_STATEMENT'
    | 'CORRECT_TRANSACTION'
    | 'UNKNOWN';
  person: string | null;
  amount: number | null;
  transaction_type:
    | 'RECEIVABLE'
    | 'PAYABLE'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_MADE'
    | 'ADJUSTMENT'
    | 'REVERSAL'
    | null;
  description: string | null;
  period: string | null; // e.g. "August", "today", "this_month"
  confirmation_prompt: string; // Spoken confirmation in Hindi / Hinglish
  speech_response: string; // What the app should speak to the shopkeeper
  clarification_needed: boolean;
  clarification_question: string | null;
}

let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Fallback rule-based parser for offline / instantaneous processing
export function fallbackParse(text: string, knownPeople: string[] = []): ParsedVoiceIntent {
  const clean = text.trim().toLowerCase();

  // Extract amount
  const amountMatch = clean.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupaye|rs|inr|₹|ka|wala)?/i);
  let amount: number | null = null;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Find person from known people or pattern
  let person: string | null = null;
  for (const p of knownPeople) {
    if (clean.includes(p.toLowerCase())) {
      person = p;
      break;
    }
  }

  if (!person) {
    // Try extract person name before 'se', 'ko', 'ne', 'ka', 'ki'
    const nameMatch = text.match(/([a-zA-Z\u0900-\u097F]+(?:\s+[a-zA-Z\u0900-\u097F]+)?)\s+(?:se|ko|ne|ka|ki)\b/i);
    if (nameMatch && !['naya', 'new', 'total', 'abhi', 'aaj'].includes(nameMatch[1].toLowerCase().trim())) {
      person = nameMatch[1].trim();
    }
  }

  // Check intent types
  if (/naya customer|add customer|naye grahak|naya khata/i.test(clean)) {
    const custName = text.replace(/naya customer|add customer|naye grahak|naya khata/i, '').trim();
    return {
      intent: 'ADD_CUSTOMER',
      person: custName || person || 'Grahak',
      amount: null,
      transaction_type: null,
      description: null,
      period: null,
      confirmation_prompt: `Naya customer ${custName || person} ko hisaab mein jod doon?`,
      speech_response: `Naya customer ${custName || person} ko joda ja raha hai.`,
      clarification_needed: false,
      clarification_question: null,
    };
  }

  if (/pdf|statement|whatsapp/i.test(clean)) {
    return {
      intent: 'GENERATE_STATEMENT',
      person: person || 'Ramesh',
      amount: null,
      transaction_type: null,
      description: null,
      period: clean.includes('august') ? 'August' : 'current',
      confirmation_prompt: `${person || 'Customer'} ka statement bana doon?`,
      speech_response: `${person || 'Customer'} ka statement taiyar ho raha hai.`,
      clarification_needed: false,
      clarification_question: null,
    };
  }

  if (/galat hai|correct|reverse|hatao|wrong/i.test(clean)) {
    return {
      intent: 'CORRECT_TRANSACTION',
      person: person,
      amount: amount,
      transaction_type: 'REVERSAL',
      description: 'Transaction correction',
      period: null,
      confirmation_prompt: `${person || 'Is'} ka ${amount ? '₹' + amount + ' wala' : ''} transaction galat darj hua tha, kya reversal entry banayein?`,
      speech_response: `Theek hai, reversal hisaab me darj kiya jayega.`,
      clarification_needed: false,
      clarification_question: null,
    };
  }

  if (/kitna lena hai|kitna dena hai|hisaab batao|balance/i.test(clean) && !amount) {
    if (/total|sabka|aaj ka/i.test(clean)) {
      return {
        intent: 'GET_TOTAL',
        person: null,
        amount: null,
        transaction_type: null,
        description: null,
        period: /aaj/i.test(clean) ? 'today' : 'all',
        confirmation_prompt: 'Total hisaab dikha raha hoon.',
        speech_response: 'Aapka kul baqi hisaab screen par hai.',
        clarification_needed: false,
        clarification_question: null,
      };
    }
    return {
      intent: 'GET_BALANCE',
      person: person,
      amount: null,
      transaction_type: null,
      description: null,
      period: null,
      confirmation_prompt: `${person || 'Grahak'} ka hisaab dikha raha hoon.`,
      speech_response: `${person || 'Grahak'} ka hisaab screen par hai.`,
      clarification_needed: !person,
      clarification_question: !person ? 'Kiska hisaab dekhna hai?' : null,
    };
  }

  if (/poora hisaab|last transaction|ledger/i.test(clean)) {
    return {
      intent: 'GET_LEDGER',
      person: person,
      amount: null,
      transaction_type: null,
      description: null,
      period: /august/i.test(clean) ? 'August' : 'all',
      confirmation_prompt: `${person || 'Grahak'} ka poora khata khola ja raha hai.`,
      speech_response: `${person || 'Grahak'} ka poora ledger taiyar hai.`,
      clarification_needed: !person,
      clarification_question: !person ? 'Kiska poora hisaab dekhna hai?' : null,
    };
  }

  // Transaction patterns
  // "Ramesh se 500 lene hain" / "Ramesh ko 500 ka ration diya"
  if (/lene hain|lena hai|ka ration diya|ka samaan diya|udhari di|diye|diya/i.test(clean) && !/de diye|jama/i.test(clean)) {
    let desc = 'Samaan / Udhari';
    if (/ration/i.test(clean)) desc = 'Ration';
    if (/doodh|milk/i.test(clean)) desc = 'Doodh';
    if (/samaan|goods/i.test(clean)) desc = 'Samaan';

    const p = person || 'Grahak';
    const amt = amount || 0;
    return {
      intent: 'ADD_TRANSACTION',
      person: p,
      amount: amt,
      transaction_type: 'RECEIVABLE',
      description: desc,
      period: null,
      confirmation_prompt: `${p} se ₹${amt} lene hain. Hisaab mein jod doon?`,
      speech_response: `${p} ke khate mein ₹${amt} lena joda gaya.`,
      clarification_needed: !person || !amount,
      clarification_question: !person || !amount ? 'Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?' : null,
    };
  }

  // "Suresh ko 1000 dene hain"
  if (/dene hain|dena hai/i.test(clean) && !/de diye/i.test(clean)) {
    const p = person || 'Vyapari';
    const amt = amount || 0;
    return {
      intent: 'ADD_TRANSACTION',
      person: p,
      amount: amt,
      transaction_type: 'PAYABLE',
      description: 'Dena baqi',
      period: null,
      confirmation_prompt: `${p} ko ₹${amt} dene hain. Hisaab mein jod doon?`,
      speech_response: `${p} ke hisaab mein ₹${amt} dena darj kiya gaya.`,
      clarification_needed: !person || !amount,
      clarification_question: !person || !amount ? 'Kisko aur kitne rupaye dene hain?' : null,
    };
  }

  // "Ramesh ne 200 de diye" / "Payment mil gaya"
  if (/de diye|jama kiye|payment mila|received|jama/i.test(clean) && /se|ne|mil/i.test(clean)) {
    const p = person || 'Grahak';
    const amt = amount || 0;
    return {
      intent: 'RECORD_PAYMENT',
      person: p,
      amount: amt,
      transaction_type: 'PAYMENT_RECEIVED',
      description: 'Jama / Cash payment',
      period: null,
      confirmation_prompt: `${p} ne ₹${amt} jama kar diye. Hisaab mein darj kar doon?`,
      speech_response: `${p} se ₹${amt} jama darj kiya gaya.`,
      clarification_needed: !person || !amount,
      clarification_question: !person || !amount ? 'Kisne kitne rupaye jama kiye?' : null,
    };
  }

  // "Suresh ko 500 de diye"
  if (/de diye|chukta kiya|payment kiya/i.test(clean) && /ko/i.test(clean)) {
    const p = person || 'Vyapari';
    const amt = amount || 0;
    return {
      intent: 'RECORD_PAYMENT',
      person: p,
      amount: amt,
      transaction_type: 'PAYMENT_MADE',
      description: 'Bhugtan / Payment made',
      period: null,
      confirmation_prompt: `${p} ko ₹${amt} de diye. Hisaab mein darj kar doon?`,
      speech_response: `${p} ko ₹${amt} ka bhugtan darj kiya gaya.`,
      clarification_needed: !person || !amount,
      clarification_question: !person || !amount ? 'Kisko kitne rupaye diye?' : null,
    };
  }

  return {
    intent: 'UNKNOWN',
    person: person,
    amount: amount,
    transaction_type: null,
    description: null,
    period: null,
    confirmation_prompt: 'Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?',
    speech_response: 'Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?',
    clarification_needed: true,
    clarification_question: 'Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?',
  };
}

export async function parseVoiceCommandWithGemini(
  voiceTranscript: string,
  existingCustomerNames: string[] = []
): Promise<ParsedVoiceIntent> {
  const ai = getAi();
  if (!ai) {
    return fallbackParse(voiceTranscript, existingCustomerNames);
  }

  const prompt = `You are the voice parser for "Hisab Kitab" - a rural and small-business Bahi-Khata ledger app in India.
The user speaks in Hindi, Hinglish, or Indian English.

User transcript: "${voiceTranscript}"
Existing registered customers in store: ${JSON.stringify(existingCustomerNames)}

Map this speech to one of the following structured intents:
- ADD_TRANSACTION: User gave goods on credit / owes money or customer owes money. (e.g. "Ramesh se 500 lene hain" -> RECEIVABLE, "Suresh ko 1000 dene hain" -> PAYABLE, "Ramesh ko 500 ka ration diya" -> RECEIVABLE)
- RECORD_PAYMENT: Customer paid shopkeeper or shopkeeper paid supplier. (e.g. "Ramesh ne 200 de diye" -> PAYMENT_RECEIVED, "Suresh ko 500 de diye" -> PAYMENT_MADE)
- ADD_CUSTOMER: Creating a new person (e.g. "Naya customer Ramesh Kumar")
- GET_BALANCE: Querying how much money is owed/pending (e.g. "Ramesh ka hisaab batao", "Ramesh se kitna lena hai?", "Suresh ko kitna dena hai?")
- GET_LEDGER: Showing full history/ledger (e.g. "Ramesh ka poora hisaab dikhao", "Ramesh ka August ka hisaab dikhao")
- GET_TRANSACTION: Querying specific recent transaction (e.g. "Ramesh ka last transaction batao")
- GET_TOTAL: Total receivables or payables (e.g. "Abhi total kitna lena hai?", "Total kitna dena hai?", "Aaj ka hisaab batao")
- GENERATE_STATEMENT: Requesting PDF or WhatsApp statement (e.g. "Ramesh ka hisaab PDF bana do", "Ramesh ka statement WhatsApp par bhejna hai")
- CORRECT_TRANSACTION: Reversing/correcting a wrong entry (e.g. "Ramesh ka 500 wala transaction galat hai")
- UNKNOWN: Cannot confidently understand or missing key parameters.

CRITICAL INSTRUCTIONS:
1. If the person name closely matches an existing customer in the store, use the existing customer's canonical name.
2. In confirmation_prompt, craft a concise, natural Hindi sentence asking for confirmation before saving. (e.g. "Ramesh se ₹500 lene hain. Hisaab mein jod doon?").
3. In speech_response, craft a polite Hindi/Hinglish sentence informing the shopkeeper.
4. If missing essential parameters for financial changes (person or amount), set clarification_needed to true and provide clarification_question in friendly Hindi ("Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?").
5. Never silently invent amounts or random people.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              enum: [
                'ADD_TRANSACTION',
                'RECORD_PAYMENT',
                'ADD_CUSTOMER',
                'GET_BALANCE',
                'GET_LEDGER',
                'GET_TRANSACTION',
                'GET_TOTAL',
                'GENERATE_STATEMENT',
                'CORRECT_TRANSACTION',
                'UNKNOWN',
              ],
            },
            person: { type: Type.STRING, nullable: true },
            amount: { type: Type.NUMBER, nullable: true },
            transaction_type: {
              type: Type.STRING,
              enum: [
                'RECEIVABLE',
                'PAYABLE',
                'PAYMENT_RECEIVED',
                'PAYMENT_MADE',
                'ADJUSTMENT',
                'REVERSAL',
              ],
              nullable: true,
            },
            description: { type: Type.STRING, nullable: true },
            period: { type: Type.STRING, nullable: true },
            confirmation_prompt: { type: Type.STRING },
            speech_response: { type: Type.STRING },
            clarification_needed: { type: Type.BOOLEAN },
            clarification_question: { type: Type.STRING, nullable: true },
          },
          required: ['intent', 'confirmation_prompt', 'speech_response', 'clarification_needed'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}') as ParsedVoiceIntent;
    return parsed;
  } catch (error) {
    console.error('Gemini Voice parse failed, falling back to rule-based engine:', error);
    return fallbackParse(voiceTranscript, existingCustomerNames);
  }
}
