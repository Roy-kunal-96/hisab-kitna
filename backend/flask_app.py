"""
Hisab Kitab - Flask Backend Implementation
Alternative synchronous WSGI microframework implementation.
"""

from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

from backend.db import init_db, get_db_connection, calculate_person_balance
from backend.gemini_service import parse_voice_command

app = Flask(__name__)
CORS(app)

init_db()

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "Hisab Kitab Flask Backend",
        "timestamp": datetime.now().isoformat()
    })

@app.route("/api/voice/parse", methods=["POST"])
def voice_parse():
    data = request.get_json() or {}
    transcript = data.get("transcript", "")
    if not transcript:
        return jsonify({"error": "Voice transcript is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM people WHERE status = 'ACTIVE'")
    known_names = [row["name"] for row in cursor.fetchall()]

    parsed = parse_voice_command(transcript, known_names)
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

    return jsonify({
        "success": True,
        "transcript": transcript,
        "parsed": parsed.to_dict(),
        "matchedPerson": matched_person
    })

@app.route("/api/dashboard", methods=["GET"])
def dashboard():
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

        enriched_people.append({**p, **balance_info, "lastTransaction": last_tx})

    today_str = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT * FROM transactions WHERE transaction_date = ? AND status = 'ACTIVE'", (today_str,))
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

    return jsonify({
        "totalLenaHai": total_lena_hai,
        "totalDenaHai": total_dena_hai,
        "todayNet": today_given - today_received,
        "todayGiven": today_given,
        "todayReceived": today_received,
        "customerCount": len(people),
        "recentPeople": enriched_people[:10],
        "recentTransactions": recent_transactions,
    })

if __name__ == "__main__":
    app.run(port=8000, debug=True)
