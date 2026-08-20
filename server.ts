import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb, saveDb, Person, Transaction, TransactionType } from './server/db.js';
import { parseVoiceCommandWithGemini } from './server/gemini.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to extract SQL query results into array of objects
function queryAll<T>(db: any, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper to calculate ledger balance for a person
// Receivable increases what customer owes (+).
// Payment Received decreases what customer owes (-).
// Payable increases what shopkeeper owes to supplier (+).
// Payment Made decreases what shopkeeper owes to supplier (-).
// Status 'REVERSED' transactions are excluded from net balance or offset by their REVERSAL entries.
function calculatePersonBalance(db: any, personId: number) {
  const txs = queryAll<Transaction>(
    db,
    `SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date ASC, id ASC`,
    [personId]
  );

  let totalGiven = 0; // RECEIVABLE
  let totalReceived = 0; // PAYMENT_RECEIVED
  let totalPayable = 0; // PAYABLE
  let totalPaid = 0; // PAYMENT_MADE

  for (const tx of txs) {
    if (tx.status === 'REVERSED') continue;

    switch (tx.type) {
      case 'RECEIVABLE':
        totalGiven += tx.amount;
        break;
      case 'PAYMENT_RECEIVED':
        totalReceived += tx.amount;
        break;
      case 'PAYABLE':
        totalPayable += tx.amount;
        break;
      case 'PAYMENT_MADE':
        totalPaid += tx.amount;
        break;
      case 'REVERSAL':
        // If it's an explicit reversal entry, handle opposite effect if active
        // But our reversal marking updates the target tx status to REVERSED as well
        break;
      case 'ADJUSTMENT':
        // positive adjustment adds to receivable
        totalGiven += tx.amount;
        break;
    }
  }

  // Net Customer Balance: positive = customer owes shopkeeper (LENA HAI), negative = shopkeeper owes customer (DENA HAI)
  const customerReceivableNet = totalGiven - totalReceived;
  const supplierPayableNet = totalPayable - totalPaid;

  let netBalance = 0;
  let balanceType: 'LENA_HAI' | 'DENA_HAI' | 'SETTLED' = 'SETTLED';

  if (customerReceivableNet !== 0) {
    netBalance = customerReceivableNet;
    balanceType = netBalance > 0 ? 'LENA_HAI' : 'DENA_HAI';
  } else if (supplierPayableNet !== 0) {
    netBalance = supplierPayableNet;
    balanceType = netBalance > 0 ? 'DENA_HAI' : 'LENA_HAI';
  }

  return {
    netBalance: Math.abs(netBalance),
    rawBalance: netBalance,
    balanceType,
    totalGiven,
    totalReceived,
    totalPayable,
    totalPaid,
    transactionCount: txs.length,
  };
}

// ---------------- API ROUTES ----------------

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Hisab Kitab API', timestamp: new Date().toISOString() });
});

// 2. Voice Parser
app.post('/api/voice/parse', async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({ error: 'Voice transcript is required.' });
      return;
    }

    const db = await getDb();
    const people = queryAll<Person>(db, `SELECT name FROM people WHERE status = 'ACTIVE'`);
    const knownNames = people.map((p) => p.name);

    const parsed = await parseVoiceCommandWithGemini(transcript, knownNames);

    // If intent references a person, check if existing person exists or match fuzzy
    let matchedPerson: Person | null = null;
    if (parsed.person) {
      const pRows = queryAll<Person>(
        db,
        `SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) LIKE LOWER(?)`,
        [`%${parsed.person}%`]
      );
      if (pRows.length > 0) {
        matchedPerson = pRows[0];
      }
    }

    res.json({
      success: true,
      transcript,
      parsed,
      matchedPerson,
    });
  } catch (err: any) {
    console.error('Error in /api/voice/parse:', err);
    res.status(500).json({ error: err.message || 'Internal voice parsing error' });
  }
});

// 3. Dashboard Totals & Recent
app.get('/api/dashboard', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const people = queryAll<Person>(db, `SELECT * FROM people WHERE status = 'ACTIVE' ORDER BY updated_at DESC`);

    let totalLenaHai = 0;
    let totalDenaHai = 0;

    const enrichedPeople = people.map((p) => {
      const balanceInfo = calculatePersonBalance(db, p.id);
      if (balanceInfo.balanceType === 'LENA_HAI') {
        totalLenaHai += balanceInfo.netBalance;
      } else if (balanceInfo.balanceType === 'DENA_HAI') {
        totalDenaHai += balanceInfo.netBalance;
      }

      // Get last transaction
      const lastTx = queryAll<Transaction>(
        db,
        `SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date DESC, id DESC LIMIT 1`,
        [p.id]
      )[0] || null;

      return {
        ...p,
        ...balanceInfo,
        lastTransaction: lastTx,
      };
    });

    // Today's summary
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = queryAll<Transaction>(
      db,
      `SELECT * FROM transactions WHERE transaction_date = ? AND status = 'ACTIVE'`,
      [todayStr]
    );

    let todayGiven = 0;
    let todayReceived = 0;
    for (const tx of todayTxs) {
      if (tx.type === 'RECEIVABLE') todayGiven += tx.amount;
      if (tx.type === 'PAYMENT_RECEIVED') todayReceived += tx.amount;
    }
    const todayNet = todayGiven - todayReceived;

    // Recent transactions across all people
    const recentTransactions = queryAll<Transaction & { person_name: string }>(
      db,
      `SELECT t.*, p.name as person_name 
       FROM transactions t 
       JOIN people p ON t.person_id = p.id 
       ORDER BY t.transaction_date DESC, t.id DESC 
       LIMIT 10`
    );

    res.json({
      totalLenaHai,
      totalDenaHai,
      todayNet,
      todayGiven,
      todayReceived,
      customerCount: people.length,
      recentPeople: enrichedPeople.slice(0, 10),
      recentTransactions,
    });
  } catch (err: any) {
    console.error('Error in /api/dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. People (Customers / Suppliers)
app.get('/api/people', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const search = req.query.search ? String(req.query.search).trim() : '';

    let sql = `SELECT * FROM people WHERE status = 'ACTIVE'`;
    const params: any[] = [];
    if (search) {
      sql += ` AND (LOWER(name) LIKE LOWER(?) OR phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY updated_at DESC`;

    const people = queryAll<Person>(db, sql, params);
    const enriched = people.map((p) => ({
      ...p,
      ...calculatePersonBalance(db, p.id),
    }));

    res.json(enriched);
  } catch (err: any) {
    console.error('Error in GET /api/people:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/people', async (req: Request, res: Response) => {
  try {
    const { name, phone, initialBalance, initialType } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Customer name is required.' });
      return;
    }

    const db = await getDb();

    // Check duplicate
    const existing = queryAll<Person>(
      db,
      `SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) = LOWER(?)`,
      [name.trim()]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: 'A customer with this name already exists.', existingPerson: existing[0] });
      return;
    }

    db.run(`INSERT INTO people (user_id, name, phone, status) VALUES (1, ?, ?, 'ACTIVE')`, [
      name.trim(),
      phone ? phone.trim() : null,
    ]);

    const created = queryAll<Person>(db, `SELECT * FROM people ORDER BY id DESC LIMIT 1`)[0];

    // If initial balance provided
    if (initialBalance && typeof initialBalance === 'number' && initialBalance > 0) {
      const type = initialType === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE';
      const todayStr = new Date().toISOString().split('T')[0];
      db.run(
        `INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [created.id, initialBalance, type, 'Purana baqi hisaab (Opening Balance)', todayStr]
      );
    }

    saveDb();

    res.status(201).json({
      success: true,
      person: {
        ...created,
        ...calculatePersonBalance(db, created.id),
      },
    });
  } catch (err: any) {
    console.error('Error in POST /api/people:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/people/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = await getDb();
    const person = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [id])[0];
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    const balanceInfo = calculatePersonBalance(db, id);
    res.json({
      ...person,
      ...balanceInfo,
    });
  } catch (err: any) {
    console.error('Error in GET /api/people/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/people/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone } = req.body;
    const db = await getDb();

    const person = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [id])[0];
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    db.run(
      `UPDATE people SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name?.trim() || person.name, phone !== undefined ? phone?.trim() : person.phone, id]
    );

    saveDb();
    const updated = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [id])[0];
    res.json({ success: true, person: updated });
  } catch (err: any) {
    console.error('Error in PUT /api/people/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/people/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = await getDb();
    db.run(`UPDATE people SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    saveDb();
    res.json({ success: true, message: 'Person archived' });
  } catch (err: any) {
    console.error('Error in DELETE /api/people/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Transactions & Ledger
app.get('/api/people/:id/transactions', async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id, 10);
    const filter = req.query.filter ? String(req.query.filter) : 'all';
    const search = req.query.search ? String(req.query.search).toLowerCase() : '';
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

    const db = await getDb();
    let txs = queryAll<Transaction>(
      db,
      `SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date DESC, id DESC`,
      [personId]
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Apply date filtering
    if (filter === 'today') {
      txs = txs.filter((t) => t.transaction_date === todayStr);
    } else if (filter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      txs = txs.filter((t) => t.transaction_date >= oneWeekAgo && t.transaction_date <= todayStr);
    } else if (filter === 'month') {
      const monthPrefix = todayStr.substring(0, 7); // 'YYYY-MM'
      txs = txs.filter((t) => t.transaction_date.startsWith(monthPrefix));
    } else if (filter === 'custom' && startDate && endDate) {
      txs = txs.filter((t) => t.transaction_date >= startDate && t.transaction_date <= endDate);
    }

    // Apply search filter
    if (search) {
      txs = txs.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(search)) ||
          t.amount.toString().includes(search) ||
          t.type.toLowerCase().includes(search)
      );
    }

    const person = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [personId])[0];
    const balanceInfo = calculatePersonBalance(db, personId);

    res.json({
      person,
      balance: balanceInfo,
      transactions: txs,
    });
  } catch (err: any) {
    console.error('Error in GET /api/people/:id/transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/daybook (All transactions across all customers with filtering and metrics)
app.get('/api/daybook', async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter ? String(req.query.filter) : 'all';
    const search = req.query.search ? String(req.query.search).toLowerCase() : '';
    const startDate = req.query.startDate ? String(req.query.startDate) : '';
    const endDate = req.query.endDate ? String(req.query.endDate) : '';

    const db = await getDb();
    let txs = queryAll<Transaction & { person_name: string; person_phone?: string }>(
      db,
      `SELECT t.*, p.name as person_name, p.phone as person_phone 
       FROM transactions t 
       JOIN people p ON t.person_id = p.id 
       ORDER BY t.transaction_date DESC, t.id DESC`
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Apply date filtering
    if (filter === 'today') {
      txs = txs.filter((t) => t.transaction_date === todayStr);
    } else if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      const weekStr = oneWeekAgo.toISOString().split('T')[0];
      txs = txs.filter((t) => t.transaction_date >= weekStr);
    } else if (filter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      const monthStr = oneMonthAgo.toISOString().split('T')[0];
      txs = txs.filter((t) => t.transaction_date >= monthStr);
    } else if (filter === 'custom' && startDate && endDate) {
      txs = txs.filter((t) => t.transaction_date >= startDate && t.transaction_date <= endDate);
    }

    // Apply text search
    if (search) {
      txs = txs.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(search)) ||
          t.person_name.toLowerCase().includes(search) ||
          (t.person_phone && t.person_phone.includes(search)) ||
          t.amount.toString().includes(search)
      );
    }

    let totalGiven = 0;
    let totalReceived = 0;
    for (const t of txs) {
      if (t.status === 'ACTIVE') {
        if (t.type === 'RECEIVABLE') totalGiven += t.amount;
        if (t.type === 'PAYMENT_RECEIVED') totalReceived += t.amount;
      }
    }

    res.json({
      transactions: txs,
      totalGiven,
      totalReceived,
      netTotal: totalGiven - totalReceived,
      count: txs.length,
    });
  } catch (err: any) {
    console.error('Error in GET /api/daybook:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add transaction
app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    const { person_id, person_name, amount, type, description, transaction_date } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Valid amount greater than 0 is required.' });
      return;
    }

    const db = await getDb();

    let targetPersonId = person_id;

    // If person_id not supplied but person_name supplied, find or create
    if (!targetPersonId && person_name) {
      const existing = queryAll<Person>(
        db,
        `SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) = LOWER(?)`,
        [person_name.trim()]
      );
      if (existing.length > 0) {
        targetPersonId = existing[0].id;
      } else {
        // Create new customer
        db.run(`INSERT INTO people (user_id, name, status) VALUES (1, ?, 'ACTIVE')`, [person_name.trim()]);
        const created = queryAll<Person>(db, `SELECT * FROM people ORDER BY id DESC LIMIT 1`)[0];
        targetPersonId = created.id;
      }
    }

    if (!targetPersonId) {
      res.status(400).json({ error: 'Customer is required.' });
      return;
    }

    const validTypes: TransactionType[] = [
      'RECEIVABLE',
      'PAYABLE',
      'PAYMENT_RECEIVED',
      'PAYMENT_MADE',
      'ADJUSTMENT',
      'REVERSAL',
    ];
    const txType = validTypes.includes(type) ? type : 'RECEIVABLE';
    const txDate = transaction_date || new Date().toISOString().split('T')[0];

    db.run(
      `INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [targetPersonId, amount, txType, description ? description.trim() : null, txDate]
    );

    // Update person updated_at
    db.run(`UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [targetPersonId]);

    saveDb();

    const createdTx = queryAll<Transaction>(db, `SELECT * FROM transactions ORDER BY id DESC LIMIT 1`)[0];
    const updatedBalance = calculatePersonBalance(db, targetPersonId);
    const person = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [targetPersonId])[0];

    res.status(201).json({
      success: true,
      transaction: createdTx,
      balance: updatedBalance,
      person,
    });
  } catch (err: any) {
    console.error('Error in POST /api/transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Transaction Reversal / Correction (IMMUTABLE AUDIT TRAIL)
app.post('/api/transactions/:id/reverse', async (req: Request, res: Response) => {
  try {
    const txId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const db = await getDb();

    const originalTx = queryAll<Transaction>(db, `SELECT * FROM transactions WHERE id = ?`, [txId])[0];
    if (!originalTx) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (originalTx.status === 'REVERSED') {
      res.status(400).json({ error: 'This transaction is already reversed.' });
      return;
    }

    // Step 1: Mark original transaction as REVERSED
    db.run(`UPDATE transactions SET status = 'REVERSED' WHERE id = ?`, [txId]);

    // Step 2: Insert an explicit REVERSAL entry with reference_id linking to the original
    const todayStr = new Date().toISOString().split('T')[0];
    const reversalDesc = `Reversal entry for #${originalTx.id} (${originalTx.type} ₹${originalTx.amount})${reason ? ': ' + reason : ''}`;

    db.run(
      `INSERT INTO transactions (person_id, amount, type, description, transaction_date, reference_id, status) 
       VALUES (?, ?, 'REVERSAL', ?, ?, ?, 'ACTIVE')`,
      [originalTx.person_id, originalTx.amount, reversalDesc, todayStr, originalTx.id]
    );

    db.run(`UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [originalTx.person_id]);

    saveDb();

    const newBalance = calculatePersonBalance(db, originalTx.person_id);
    const person = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [originalTx.person_id])[0];

    res.json({
      success: true,
      message: 'Transaction successfully reversed and audit log created.',
      reversedTransactionId: txId,
      person,
      balance: newBalance,
    });
  } catch (err: any) {
    console.error('Error in /api/transactions/:id/reverse:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Statement generation data
app.get('/api/people/:id/statement', async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.params.id, 10);
    const period = req.query.period ? String(req.query.period) : 'all';
    const db = await getDb();

    const person = queryAll<Person>(db, `SELECT * FROM people WHERE id = ?`, [personId])[0];
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    const txs = queryAll<Transaction>(
      db,
      `SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date ASC, id ASC`,
      [personId]
    );

    const balanceInfo = calculatePersonBalance(db, personId);
    const shop = queryAll<{ id: number; name: string }>(db, `SELECT * FROM users LIMIT 1`)[0] || {
      id: 1,
      name: 'Sharma Kirana Store',
    };

    res.json({
      shopName: shop.name,
      tagline: 'Bolkar hisaab rakho',
      person,
      period,
      generatedAt: new Date().toISOString(),
      balance: balanceInfo,
      transactions: txs,
    });
  } catch (err: any) {
    console.error('Error in /api/people/:id/statement:', err);
    res.status(500).json({ error: err.message });
  }
});

// Vite middleware & Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hisab Kitab Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
