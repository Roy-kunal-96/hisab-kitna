import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface User {
  id: number;
  name: string;
  created_at: string;
}

export interface Person {
  id: number;
  user_id: number;
  name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

export type TransactionType =
  | 'RECEIVABLE'
  | 'PAYABLE'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_MADE'
  | 'ADJUSTMENT'
  | 'REVERSAL';

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
}

const DB_FILE = path.join(process.cwd(), 'hisab_kitab.sqlite');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables if they do not exist
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      transaction_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reference_id INTEGER,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      FOREIGN KEY (person_id) REFERENCES people(id),
      FOREIGN KEY (reference_id) REFERENCES transactions(id)
    );
  `);

  // Seed default user and sample realistic bahi-khata entries if empty
  const userCheck = dbInstance.exec("SELECT COUNT(*) as count FROM users");
  const count = userCheck[0]?.values[0]?.[0] as number;
  if (!count || count === 0) {
    dbInstance.run(`INSERT INTO users (name) VALUES ('Sharma Kirana Store');`);
    
    // Seed sample customers
    dbInstance.run(`
      INSERT INTO people (user_id, name, phone, status) VALUES
      (1, 'Ramesh Kumar', '9876543210', 'ACTIVE'),
      (1, 'Suresh Verma', '9812345678', 'ACTIVE'),
      (1, 'Mohan Lal', '9765432109', 'ACTIVE'),
      (1, 'Geeta Devi', '9654321098', 'ACTIVE');
    `);

    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const d1 = new Date(now.getTime() - 10 * 86400000);
    const d2 = new Date(now.getTime() - 7 * 86400000);
    const d3 = new Date(now.getTime() - 4 * 86400000);
    const d4 = new Date(now.getTime() - 1 * 86400000);
    const todayStr = formatDate(now);

    // Ramesh: owes 600
    dbInstance.run(`
      INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES
      (1, 500, 'RECEIVABLE', 'Ration ka samaan', '${formatDate(d1)}', 'ACTIVE'),
      (1, 300, 'RECEIVABLE', 'Tel aur cheeni', '${formatDate(d2)}', 'ACTIVE'),
      (1, 400, 'PAYMENT_RECEIVED', 'Cash payment', '${formatDate(d3)}', 'ACTIVE'),
      (1, 200, 'RECEIVABLE', 'Chawal aur daal', '${formatDate(d4)}', 'ACTIVE');
    `);

    // Suresh: shopkeeper owes 1000 (PAYABLE)
    dbInstance.run(`
      INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES
      (2, 1500, 'PAYABLE', 'Wholesale supplier invoice', '${formatDate(d2)}', 'ACTIVE'),
      (2, 500, 'PAYMENT_MADE', 'UPI payment to Suresh', '${formatDate(d3)}', 'ACTIVE');
    `);

    // Mohan: owes 250
    dbInstance.run(`
      INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES
      (3, 250, 'RECEIVABLE', 'Daily milk & curd', '${todayStr}', 'ACTIVE');
    `);

    // Geeta Devi: settled 0
    dbInstance.run(`
      INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES
      (4, 800, 'RECEIVABLE', 'Monthly masala & spices', '${formatDate(d1)}', 'ACTIVE'),
      (4, 800, 'PAYMENT_RECEIVED', 'Full settlement gpay', '${formatDate(d4)}', 'ACTIVE');
    `);

    saveDb();
  }

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite to file:', err);
  }
}
