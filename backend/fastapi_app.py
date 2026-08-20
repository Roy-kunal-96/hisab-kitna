"""
Hisab Kitab - FastAPI Backend Implementation
Modern asynchronous Python API with automatic OpenAPI Swagger docs and Pydantic validation.
"""

from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.db import init_db, get_db_connection, calculate_person_balance
from backend.gemini_service import parse_voice_command

app = FastAPI(
    title="Hisab Kitab API (Python)",
    description="Voice-First Digital Bahi-Khata Ledger API in Python",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# Pydantic Request Models
class VoiceParseRequest(BaseModel):
    transcript: str = Field(..., description="Spoken Hindi/Hinglish phrase")

class CreatePersonRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    initialBalance: Optional[float] = None
    initialType: Optional[str] = "RECEIVABLE"

class UpdatePersonRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class CreateTransactionRequest(BaseModel):
    person_id: Optional[int] = None
    person_name: Optional[str] = None
    amount: float
    type: str = "RECEIVABLE"
    description: Optional[str] = None
    transaction_date: Optional[str] = None

class ReversalRequest(BaseModel):
    reason: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "Hisab Kitab FastAPI Backend",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/voice/parse")
def parse_voice(req: VoiceParseRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM people WHERE status = 'ACTIVE'")
    known_names = [row["name"] for row in cursor.fetchall()]

    parsed = parse_voice_command(req.transcript, known_names)
    matched_person = None
    if parsed.person:
        cursor.execute(
            "SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) LIKE ?",
            (f"%{parsed.person.lower()}%",)
        )
        row = cursor.fetchone()
        if row:
            matched_person = dict(row)
    conn.close()

    return {
        "success": True,
        "transcript": req.transcript,
        "parsed": parsed.to_dict(),
        "matchedPerson": matched_person
    }

@app.get("/api/dashboard")
def get_dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' ORDER BY updated_at DESC")
    people = [dict(row) for row in cursor.fetchall()]

    total_lena_hai = 0.0
    total_dena_hai = 0.0
    enriched_people = []

    for p in people:
        balance_info = calculate_person_balance(conn, p["id"])
        if balance_info["balanceType"] == "LENA_HAI":
            total_lena_hai += balance_info["netBalance"]
        elif balance_info["balanceType"] == "DENA_HAI":
            total_dena_hai += balance_info["netBalance"]

        cursor.execute(
            "SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date DESC, id DESC LIMIT 1",
            (p["id"],)
        )
        last_tx_row = cursor.fetchone()
        last_tx = dict(last_tx_row) if last_tx_row else None

        enriched_people.append({
            **p,
            **balance_info,
            "lastTransaction": last_tx
        })

    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute(
        "SELECT * FROM transactions WHERE transaction_date = ? AND status = 'ACTIVE'",
        (today_str,)
    )
    today_txs = [dict(row) for row in cursor.fetchall()]
    today_given = sum(t["amount"] for t in today_txs if t["type"] == "RECEIVABLE")
    today_received = sum(t["amount"] for t in today_txs if t["type"] == "PAYMENT_RECEIVED")

    cursor.execute("""
        SELECT t.*, p.name as person_name 
        FROM transactions t 
        JOIN people p ON t.person_id = p.id 
        ORDER BY t.transaction_date DESC, t.id DESC 
        LIMIT 10
    """)
    recent_transactions = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return {
        "totalLenaHai": total_lena_hai,
        "totalDenaHai": total_dena_hai,
        "todayNet": today_given - today_received,
        "todayGiven": today_given,
        "todayReceived": today_received,
        "customerCount": len(people),
        "recentPeople": enriched_people[:10],
        "recentTransactions": recent_transactions,
    }

@app.get("/api/people")
def get_people(search: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    if search:
        cursor.execute(
            "SELECT * FROM people WHERE status = 'ACTIVE' AND (LOWER(name) LIKE ? OR phone LIKE ?) ORDER BY updated_at DESC",
            (f"%{search.lower()}%", f"%{search}%")
        )
    else:
        cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' ORDER BY updated_at DESC")

    people = [dict(row) for row in cursor.fetchall()]
    enriched = [{**p, **calculate_person_balance(conn, p["id"])} for p in people]
    conn.close()
    return enriched

@app.post("/api/people", status_code=201)
def create_person(req: CreatePersonRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    name = req.name.strip()
    if not name:
        conn.close()
        raise HTTPException(status_code=400, detail="Customer name is required.")

    cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) = LOWER(?)", (name,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="A customer with this name already exists.")

    cursor.execute("INSERT INTO people (user_id, name, phone, status) VALUES (1, ?, ?, 'ACTIVE')", (name, req.phone))
    person_id = cursor.lastrowid

    if req.initialBalance and req.initialBalance > 0:
        tx_type = "PAYABLE" if req.initialType == "PAYABLE" else "RECEIVABLE"
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute(
            "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
            (person_id, req.initialBalance, tx_type, "Purana baqi hisaab (Opening Balance)", today_str)
        )

    conn.commit()
    cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
    created = dict(cursor.fetchone())
    balance = calculate_person_balance(conn, person_id)
    conn.close()

    return {"success": True, "person": {**created, **balance}}

@app.get("/api/daybook")
def get_daybook(filter: str = "all", search: str = "", startDate: str = "", endDate: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, p.name as person_name, p.phone as person_phone 
        FROM transactions t 
        JOIN people p ON t.person_id = p.id 
        ORDER BY t.transaction_date DESC, t.id DESC
    """)
    txs = [dict(row) for row in cursor.fetchall()]

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    if filter == "today":
        txs = [t for t in txs if t["transaction_date"] == today_str]
    elif filter == "week":
        week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        txs = [t for t in txs if t["transaction_date"] >= week_ago]
    elif filter == "month":
        month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
        txs = [t for t in txs if t["transaction_date"] >= month_ago]
    elif filter == "custom" and startDate and endDate:
        txs = [t for t in txs if startDate <= t["transaction_date"] <= endDate]

    if search:
        s = search.lower()
        txs = [
            t for t in txs
            if (t.get("description") and s in t["description"].lower())
            or s in t["person_name"].lower()
            or (t.get("person_phone") and s in t["person_phone"])
            or s in str(t["amount"])
        ]

    total_given = sum(t["amount"] for t in txs if t["status"] == "ACTIVE" and t["type"] == "RECEIVABLE")
    total_received = sum(t["amount"] for t in txs if t["status"] == "ACTIVE" and t["type"] == "PAYMENT_RECEIVED")
    conn.close()

    return {
        "transactions": txs,
        "totalGiven": total_given,
        "totalReceived": total_received,
        "netTotal": total_given - total_received,
        "count": len(txs),
    }

@app.post("/api/transactions", status_code=201)
def create_transaction(req: CreateTransactionRequest):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Valid amount greater than 0 is required.")

    conn = get_db_connection()
    cursor = conn.cursor()
    target_id = req.person_id

    if not target_id and req.person_name:
        cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) = LOWER(?)", (req.person_name.strip(),))
        row = cursor.fetchone()
        if row:
            target_id = row["id"]
        else:
            cursor.execute("INSERT INTO people (user_id, name, status) VALUES (1, ?, 'ACTIVE')", (req.person_name.strip(),))
            target_id = cursor.lastrowid

    if not target_id:
        conn.close()
        raise HTTPException(status_code=400, detail="Customer is required.")

    tx_date = req.transaction_date or datetime.now().strftime("%Y-%m-%d")
    cursor.execute(
        "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
        (target_id, req.amount, req.type, req.description, tx_date)
    )
    tx_id = cursor.lastrowid
    cursor.execute("UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (target_id,))
    conn.commit()

    cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
    created_tx = dict(cursor.fetchone())
    cursor.execute("SELECT * FROM people WHERE id = ?", (target_id,))
    person = dict(cursor.fetchone())
    balance = calculate_person_balance(conn, target_id)
    conn.close()

    return {
        "success": True,
        "transaction": created_tx,
        "balance": balance,
        "person": person
    }

@app.post("/api/transactions/{tx_id}/reverse")
def reverse_transaction(tx_id: int, req: ReversalRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
    original = cursor.fetchone()
    if not original:
        conn.close()
        raise HTTPException(status_code=404, detail="Transaction not found")

    orig_dict = dict(original)
    if orig_dict["status"] == "REVERSED":
        conn.close()
        raise HTTPException(status_code=400, detail="This transaction is already reversed.")

    cursor.execute("UPDATE transactions SET status = 'REVERSED' WHERE id = ?", (tx_id,))
    today_str = datetime.now().strftime("%Y-%m-%d")
    reversal_desc = f"Reversal entry for #{orig_dict['id']} ({orig_dict['type']} ₹{orig_dict['amount']})"
    if req.reason:
        reversal_desc += f": {req.reason}"

    cursor.execute(
        "INSERT INTO transactions (person_id, amount, type, description, transaction_date, reference_id, status) VALUES (?, ?, 'REVERSAL', ?, ?, ?, 'ACTIVE')",
        (orig_dict["person_id"], orig_dict["amount"], reversal_desc, today_str, orig_dict["id"])
    )
    cursor.execute("UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (orig_dict["person_id"],))
    conn.commit()

    cursor.execute("SELECT * FROM people WHERE id = ?", (orig_dict["person_id"],))
    person = dict(cursor.fetchone())
    balance = calculate_person_balance(conn, orig_dict["person_id"])
    conn.close()

    return {
        "success": True,
        "message": "Transaction successfully reversed and audit log created.",
        "reversedTransactionId": tx_id,
        "person": person,
        "balance": balance,
    }
