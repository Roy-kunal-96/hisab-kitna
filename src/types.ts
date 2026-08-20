export type TransactionType =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_MADE'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export interface Person {
  id: number;
  user_id: number;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  status: 'ACTIVE' | 'ARCHIVED';
  netBalance?: number;
  rawBalance?: number;
  balanceType?: 'LENA_HAI' | 'DENA_HAI' | 'SETTLED';
  totalGiven?: number;
  totalReceived?: number;
  totalPayable?: number;
  totalPaid?: number;
  transactionCount?: number;
  lastTransaction?: Transaction | null;
}

export interface Transaction {
  id: number;
  person_id: number;
  amount: number;
  type: TransactionType;
  description: string | null;
  transaction_date: string;
  created_at: string;
  reference_id: number | null;
  status: 'ACTIVE' | 'REVERSED';
  person_name?: string;
}

export interface BalanceInfo {
  netBalance: number;
  rawBalance: number;
  balanceType: 'LENA_HAI' | 'DENA_HAI' | 'SETTLED';
  totalGiven: number;
  totalReceived: number;
  totalPayable: number;
  totalPaid: number;
  transactionCount: number;
}

export interface DashboardData {
  totalLenaHai: number;
  totalDenaHai: number;
  todayNet: number;
  todayGiven: number;
  todayReceived: number;
  customerCount: number;
  recentPeople: Person[];
  recentTransactions: (Transaction & { person_name: string })[];
}

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
  transaction_type: TransactionType | null;
  description: string | null;
  period: string | null;
  confirmation_prompt: string;
  speech_response: string;
  clarification_needed: boolean;
  clarification_question: string | null;
}

export interface VoiceParseResponse {
  success: boolean;
  transcript: string;
  parsed: ParsedVoiceIntent;
  matchedPerson: Person | null;
}

export interface StatementData {
  shopName: string;
  tagline: string;
  person: Person;
  period: string;
  generatedAt: string;
  balance: BalanceInfo;
  transactions: Transaction[];
}
