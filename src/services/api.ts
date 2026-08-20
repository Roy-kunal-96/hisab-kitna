import { DashboardData, Person, Transaction, VoiceParseResponse, StatementData } from '../types';

export const API_BASE = '/api';

// Cache keys for offline friendliness
const CACHE_DASHBOARD = 'hisab_kitab_dashboard_cache';
const CACHE_PEOPLE = 'hisab_kitab_people_cache';

export async function fetchDashboard(): Promise<{ data: DashboardData; isOffline: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    try {
      localStorage.setItem(CACHE_DASHBOARD, JSON.stringify(data));
    } catch {}
    return { data, isOffline: false };
  } catch (err) {
    console.warn('Dashboard fetch failed, loading local cache:', err);
    const cached = localStorage.getItem(CACHE_DASHBOARD);
    if (cached) {
      return { data: JSON.parse(cached), isOffline: true };
    }
    throw err;
  }
}

export async function fetchPeople(search: string = ''): Promise<{ data: Person[]; isOffline: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/people?search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    try {
      localStorage.setItem(CACHE_PEOPLE, JSON.stringify(data));
    } catch {}
    return { data, isOffline: false };
  } catch (err) {
    console.warn('People fetch failed, loading local cache:', err);
    const cached = localStorage.getItem(CACHE_PEOPLE);
    if (cached) {
      let list: Person[] = JSON.parse(cached);
      if (search) {
        list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
      }
      return { data: list, isOffline: true };
    }
    throw err;
  }
}

export async function fetchPersonTransactions(
  personId: number,
  filter: string = 'all',
  search: string = '',
  startDate: string = '',
  endDate: string = ''
): Promise<{ person: Person; balance: any; transactions: Transaction[] }> {
  const url = `${API_BASE}/people/${personId}/transactions?filter=${filter}&search=${encodeURIComponent(
    search
  )}&startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load transactions: HTTP ${res.status}`);
  return await res.json();
}

export async function parseVoice(transcript: string): Promise<VoiceParseResponse> {
  const res = await fetch(`${API_BASE}/voice/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Voice parse failed: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function createPerson(payload: {
  name: string;
  phone?: string;
  initialBalance?: number;
  initialType?: string;
}): Promise<{ person: Person }> {
  const res = await fetch(`${API_BASE}/people`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create person: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function updatePerson(
  id: number,
  payload: { name?: string; phone?: string }
): Promise<{ person: Person }> {
  const res = await fetch(`${API_BASE}/people/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update customer: HTTP ${res.status}`);
  return await res.json();
}

export async function archivePerson(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/people/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to archive customer: HTTP ${res.status}`);
}

export async function createTransaction(payload: {
  person_id?: number;
  person_name?: string;
  amount: number;
  type: string;
  description?: string;
  transaction_date?: string;
}): Promise<{ transaction: Transaction; balance: any; person: Person }> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create transaction: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function reverseTransaction(
  transactionId: number,
  reason?: string
): Promise<{ success: boolean; reversedTransactionId: number; person: Person; balance: any }> {
  const res = await fetch(`${API_BASE}/transactions/${transactionId}/reverse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to reverse transaction: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function fetchStatement(personId: number, period: string = 'all'): Promise<StatementData> {
  const res = await fetch(`${API_BASE}/people/${personId}/statement?period=${period}`);
  if (!res.ok) throw new Error(`Failed to generate statement: HTTP ${res.status}`);
  return await res.json();
}

export async function fetchDaybook(
  filter: string = 'all',
  search: string = '',
  startDate: string = '',
  endDate: string = ''
): Promise<{
  transactions: (Transaction & { person_name: string; person_phone?: string })[];
  totalGiven: number;
  totalReceived: number;
  netTotal: number;
  count: number;
}> {
  const url = `${API_BASE}/daybook?filter=${filter}&search=${encodeURIComponent(
    search
  )}&startDate=${startDate}&endDate=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch daybook: HTTP ${res.status}`);
  return await res.json();
}
