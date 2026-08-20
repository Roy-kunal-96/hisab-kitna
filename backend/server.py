"""
Hisab Kitab - Python Backend HTTP Server
Provides REST API endpoints for customer management, bahi-khata ledger transactions,
double-entry balance tracking, daybook queries, immutable reversals, and voice parsing.
Runs using pure Python standard library (no external pip dependencies required).
"""

import sys
import os
import json
import sqlite3
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import init_db, get_db_connection, calculate_person_balance
from backend.gemini_service import parse_voice_command

PORT = int(os.environ.get("PYTHON_PORT", "8000"))


class HisabKitabRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[Python API] {self.command} {self.path} -> {args[1]}\n")

    def _set_headers(self, status_code=200, content_type="application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(body)
            except json.JSONDecodeError:
                return {}
        return {}

    def _send_json(self, data, status_code=200):
        self._set_headers(status_code, "application/json")
        self.wfile.write(json.dumps(data, default=str).encode("utf-8"))

    def _send_error(self, message, status_code=400):
        self._send_json({"error": message}, status_code)

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # 1. Health check
            if path == "/api/health":
                self._send_json({
                    "status": "ok",
                    "service": "Hisab Kitab Python Backend",
                    "runtime": f"Python {sys.version.split()[0]}",
                    "timestamp": datetime.now().isoformat()
                })
                return

            # 2. Dashboard
            elif path == "/api/dashboard":
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

                # Today's summary
                today_str = datetime.now().strftime("%Y-%m-%d")
                cursor.execute(
                    "SELECT * FROM transactions WHERE transaction_date = ? AND status = 'ACTIVE'",
                    (today_str,)
                )
                today_txs = [dict(row) for row in cursor.fetchall()]

                today_given = sum(t["amount"] for t in today_txs if t["type"] == "RECEIVABLE")
                today_received = sum(t["amount"] for t in today_txs if t["type"] == "PAYMENT_RECEIVED")
                today_net = today_given - today_received

                # Recent transactions across all people
                cursor.execute("""
                    SELECT t.*, p.name as person_name 
                    FROM transactions t 
                    JOIN people p ON t.person_id = p.id 
                    ORDER BY t.transaction_date DESC, t.id DESC 
                    LIMIT 10
                """)
                recent_transactions = [dict(row) for row in cursor.fetchall()]

                self._send_json({
                    "totalLenaHai": total_lena_hai,
                    "totalDenaHai": total_dena_hai,
                    "todayNet": today_net,
                    "todayGiven": today_given,
                    "todayReceived": today_received,
                    "customerCount": len(people),
                    "recentPeople": enriched_people[:10],
                    "recentTransactions": recent_transactions,
                })
                return

            # 3. People list
            elif path == "/api/people":
                search = query_params.get("search", [""])[0].strip()
                if search:
                    cursor.execute(
                        "SELECT * FROM people WHERE status = 'ACTIVE' AND (LOWER(name) LIKE ? OR phone LIKE ?) ORDER BY updated_at DESC",
                        (f"%{search.lower()}%", f"%{search}%")
                    )
                else:
                    cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' ORDER BY updated_at DESC")

                people = [dict(row) for row in cursor.fetchall()]
                enriched = []
                for p in people:
                    balance = calculate_person_balance(conn, p["id"])
                    enriched.append({**p, **balance})

                self._send_json(enriched)
                return

            # 4. Daybook (Roznamcha)
            elif path == "/api/daybook":
                filter_val = query_params.get("filter", ["all"])[0]
                search = query_params.get("search", [""])[0].lower()
                start_date = query_params.get("startDate", [""])[0]
                end_date = query_params.get("endDate", [""])[0]

                cursor.execute("""
                    SELECT t.*, p.name as person_name, p.phone as person_phone 
                    FROM transactions t 
                    JOIN people p ON t.person_id = p.id 
                    ORDER BY t.transaction_date DESC, t.id DESC
                """)
                txs = [dict(row) for row in cursor.fetchall()]

                now = datetime.now()
                today_str = now.strftime("%Y-%m-%d")

                # Filter by period
                if filter_val == "today":
                    txs = [t for t in txs if t["transaction_date"] == today_str]
                elif filter_val == "week":
                    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
                    txs = [t for t in txs if t["transaction_date"] >= week_ago]
                elif filter_val == "month":
                    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
                    txs = [t for t in txs if t["transaction_date"] >= month_ago]
                elif filter_val == "custom" and start_date and end_date:
                    txs = [t for t in txs if start_date <= t["transaction_date"] <= end_date]

                # Filter by search
                if search:
                    txs = [
                        t for t in txs
                        if (t.get("description") and search in t["description"].lower())
                        or search in t["person_name"].lower()
                        or (t.get("person_phone") and search in t["person_phone"])
                        or search in str(t["amount"])
                    ]

                total_given = sum(t["amount"] for t in txs if t["status"] == "ACTIVE" and t["type"] == "RECEIVABLE")
                total_received = sum(t["amount"] for t in txs if t["status"] == "ACTIVE" and t["type"] == "PAYMENT_RECEIVED")

                self._send_json({
                    "transactions": txs,
                    "totalGiven": total_given,
                    "totalReceived": total_received,
                    "netTotal": total_given - total_received,
                    "count": len(txs),
                })
                return

            # 5. Customer Transactions (/api/people/<id>/transactions)
            m_tx = re.match(r"^/api/people/(\d+)/transactions$", path)
            if m_tx:
                person_id = int(m_tx.group(1))
                filter_val = query_params.get("filter", ["all"])[0]
                search = query_params.get("search", [""])[0].lower()
                start_date = query_params.get("startDate", [""])[0]
                end_date = query_params.get("endDate", [""])[0]

                cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                person_row = cursor.fetchone()
                if not person_row:
                    self._send_error("Person not found", 404)
                    return
                person = dict(person_row)

                cursor.execute(
                    "SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date DESC, id DESC",
                    (person_id,)
                )
                txs = [dict(row) for row in cursor.fetchall()]

                now = datetime.now()
                today_str = now.strftime("%Y-%m-%d")

                if filter_val == "today":
                    txs = [t for t in txs if t["transaction_date"] == today_str]
                elif filter_val == "week":
                    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
                    txs = [t for t in txs if week_ago <= t["transaction_date"] <= today_str]
                elif filter_val == "month":
                    month_prefix = today_str[:7]
                    txs = [t for t in txs if t["transaction_date"].startswith(month_prefix)]
                elif filter_val == "custom" and start_date and end_date:
                    txs = [t for t in txs if start_date <= t["transaction_date"] <= end_date]

                if search:
                    txs = [
                        t for t in txs
                        if (t.get("description") and search in t["description"].lower())
                        or search in str(t["amount"])
                        or search in t["type"].lower()
                    ]

                balance_info = calculate_person_balance(conn, person_id)

                self._send_json({
                    "person": person,
                    "balance": balance_info,
                    "transactions": txs,
                })
                return

            # 6. Customer Statement (/api/people/<id>/statement)
            m_stmt = re.match(r"^/api/people/(\d+)/statement$", path)
            if m_stmt:
                person_id = int(m_stmt.group(1))
                period = query_params.get("period", ["all"])[0]

                cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                person_row = cursor.fetchone()
                if not person_row:
                    self._send_error("Person not found", 404)
                    return
                person = dict(person_row)

                cursor.execute(
                    "SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date ASC, id ASC",
                    (person_id,)
                )
                txs = [dict(row) for row in cursor.fetchall()]
                balance_info = calculate_person_balance(conn, person_id)

                cursor.execute("SELECT * FROM users LIMIT 1")
                shop_row = cursor.fetchone()
                shop_name = shop_row["name"] if shop_row else "Sharma Kirana Store"

                self._send_json({
                    "shopName": shop_name,
                    "tagline": "Bolkar hisaab rakho",
                    "person": person,
                    "period": period,
                    "generatedAt": datetime.now().isoformat(),
                    "balance": balance_info,
                    "transactions": txs,
                })
                return

            # 7. Customer by ID (/api/people/<id>)
            m_person = re.match(r"^/api/people/(\d+)$", path)
            if m_person:
                person_id = int(m_person.group(1))
                cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                person_row = cursor.fetchone()
                if not person_row:
                    self._send_error("Person not found", 404)
                    return

                person = dict(person_row)
                balance_info = calculate_person_balance(conn, person_id)
                self._send_json({**person, **balance_info})
                return

            self._send_error(f"Endpoint GET {path} not found", 404)

        except Exception as e:
            self._send_error(str(e), 500)
        finally:
            conn.close()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        body = self._read_json_body()

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            # 1. Voice Parse (/api/voice/parse)
            if path == "/api/voice/parse":
                transcript = body.get("transcript")
                if not transcript or not isinstance(transcript, str):
                    self._send_error("Voice transcript is required.", 400)
                    return

                cursor.execute("SELECT name FROM people WHERE status = 'ACTIVE'")
                known_names = [row["name"] for row in cursor.fetchall()]

                parsed_intent = parse_voice_command(transcript, known_names)

                matched_person = None
                if parsed_intent.person:
                    cursor.execute(
                        "SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) LIKE ?",
                        (f"%{parsed_intent.person.lower()}%",)
                    )
                    m_row = cursor.fetchone()
                    if m_row:
                        matched_person = dict(m_row)

                self._send_json({
                    "success": True,
                    "transcript": transcript,
                    "parsed": parsed_intent.to_dict(),
                    "matchedPerson": matched_person,
                })
                return

            # 2. Add Person (/api/people)
            elif path == "/api/people":
                name = body.get("name", "").strip()
                phone = body.get("phone", "").strip() or None
                initial_balance = body.get("initialBalance")
                initial_type = body.get("initialType", "RECEIVABLE")

                if not name:
                    self._send_error("Customer name is required.", 400)
                    return

                # Duplicate check
                cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) = LOWER(?)", (name,))
                existing_row = cursor.fetchone()
                if existing_row:
                    self._send_json({
                        "error": "A customer with this name already exists.",
                        "existingPerson": dict(existing_row)
                    }, 409)
                    return

                cursor.execute(
                    "INSERT INTO people (user_id, name, phone, status) VALUES (1, ?, ?, 'ACTIVE')",
                    (name, phone)
                )
                person_id = cursor.lastrowid

                if initial_balance and isinstance(initial_balance, (int, float)) and initial_balance > 0:
                    tx_type = "PAYABLE" if initial_type == "PAYABLE" else "RECEIVABLE"
                    today_str = datetime.now().strftime("%Y-%m-%d")
                    cursor.execute(
                        "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
                        (person_id, float(initial_balance), tx_type, "Purana baqi hisaab (Opening Balance)", today_str)
                    )

                conn.commit()

                cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                created_person = dict(cursor.fetchone())
                balance_info = calculate_person_balance(conn, person_id)

                self._send_json({
                    "success": True,
                    "person": {**created_person, **balance_info}
                }, 201)
                return

            # 3. Add Transaction (/api/transactions)
            elif path == "/api/transactions":
                person_id = body.get("person_id")
                person_name = body.get("person_name")
                amount = body.get("amount")
                tx_type = body.get("type", "RECEIVABLE")
                description = body.get("description", "").strip() or None
                tx_date = body.get("transaction_date") or datetime.now().strftime("%Y-%m-%d")

                if not amount or not isinstance(amount, (int, float)) or amount <= 0:
                    self._send_error("Valid amount greater than 0 is required.", 400)
                    return

                target_person_id = person_id
                if not target_person_id and person_name:
                    cursor.execute(
                        "SELECT * FROM people WHERE status = 'ACTIVE' AND LOWER(name) = LOWER(?)",
                        (person_name.strip(),)
                    )
                    existing = cursor.fetchone()
                    if existing:
                        target_person_id = existing["id"]
                    else:
                        cursor.execute(
                            "INSERT INTO people (user_id, name, status) VALUES (1, ?, 'ACTIVE')",
                            (person_name.strip(),)
                        )
                        target_person_id = cursor.lastrowid

                if not target_person_id:
                    self._send_error("Customer is required.", 400)
                    return

                valid_types = ['RECEIVABLE', 'PAYABLE', 'PAYMENT_RECEIVED', 'PAYMENT_MADE', 'ADJUSTMENT', 'REVERSAL']
                final_type = tx_type if tx_type in valid_types else 'RECEIVABLE'

                cursor.execute(
                    "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
                    (target_person_id, float(amount), final_type, description, tx_date)
                )
                tx_id = cursor.lastrowid

                cursor.execute(
                    "UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (target_person_id,)
                )
                conn.commit()

                cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
                created_tx = dict(cursor.fetchone())
                cursor.execute("SELECT * FROM people WHERE id = ?", (target_person_id,))
                person = dict(cursor.fetchone())
                balance_info = calculate_person_balance(conn, target_person_id)

                self._send_json({
                    "success": True,
                    "transaction": created_tx,
                    "balance": balance_info,
                    "person": person,
                }, 201)
                return

            # 4. Reverse Transaction (/api/transactions/<id>/reverse)
            m_rev = re.match(r"^/api/transactions/(\d+)/reverse$", path)
            if m_rev:
                tx_id = int(m_rev.group(1))
                reason = body.get("reason", "").strip()

                cursor.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,))
                original_tx_row = cursor.fetchone()
                if not original_tx_row:
                    self._send_error("Transaction not found", 404)
                    return

                original_tx = dict(original_tx_row)
                if original_tx["status"] == "REVERSED":
                    self._send_error("This transaction is already reversed.", 400)
                    return

                # Mark original as REVERSED
                cursor.execute("UPDATE transactions SET status = 'REVERSED' WHERE id = ?", (tx_id,))

                # Insert counter-entry
                today_str = datetime.now().strftime("%Y-%m-%d")
                reversal_desc = f"Reversal entry for #{original_tx['id']} ({original_tx['type']} ₹{original_tx['amount']})"
                if reason:
                    reversal_desc += f": {reason}"

                cursor.execute(
                    "INSERT INTO transactions (person_id, amount, type, description, transaction_date, reference_id, status) VALUES (?, ?, 'REVERSAL', ?, ?, ?, 'ACTIVE')",
                    (original_tx["person_id"], original_tx["amount"], reversal_desc, today_str, original_tx["id"])
                )

                cursor.execute(
                    "UPDATE people SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (original_tx["person_id"],)
                )
                conn.commit()

                cursor.execute("SELECT * FROM people WHERE id = ?", (original_tx["person_id"],))
                person = dict(cursor.fetchone())
                balance_info = calculate_person_balance(conn, original_tx["person_id"])

                self._send_json({
                    "success": True,
                    "message": "Transaction successfully reversed and audit log created.",
                    "reversedTransactionId": tx_id,
                    "person": person,
                    "balance": balance_info,
                })
                return

            self._send_error(f"Endpoint POST {path} not found", 404)

        except Exception as e:
            self._send_error(str(e), 500)
        finally:
            conn.close()

    def do_PUT(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        body = self._read_json_body()

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            m_person = re.match(r"^/api/people/(\d+)$", path)
            if m_person:
                person_id = int(m_person.group(1))
                cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                person_row = cursor.fetchone()
                if not person_row:
                    self._send_error("Person not found", 404)
                    return

                person = dict(person_row)
                new_name = body.get("name", person["name"]).strip()
                new_phone = body.get("phone", person["phone"])
                if new_phone:
                    new_phone = str(new_phone).strip()

                cursor.execute(
                    "UPDATE people SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (new_name, new_phone, person_id)
                )
                conn.commit()

                cursor.execute("SELECT * FROM people WHERE id = ?", (person_id,))
                updated_person = dict(cursor.fetchone())

                self._send_json({
                    "success": True,
                    "person": updated_person
                })
                return

            self._send_error(f"Endpoint PUT {path} not found", 404)

        except Exception as e:
            self._send_error(str(e), 500)
        finally:
            conn.close()

    def do_DELETE(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            m_person = re.match(r"^/api/people/(\d+)$", path)
            if m_person:
                person_id = int(m_person.group(1))
                cursor.execute(
                    "UPDATE people SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (person_id,)
                )
                conn.commit()
                self._send_json({
                    "success": True,
                    "message": "Person archived"
                })
                return

            self._send_error(f"Endpoint DELETE {path} not found", 404)

        except Exception as e:
            self._send_error(str(e), 500)
        finally:
            conn.close()


def run(server_class=HTTPServer, handler_class=HisabKitabRequestHandler, port=PORT):
    init_db()
    server_address = ("127.0.0.1", port)
    httpd = server_class(server_address, handler_class)
    print(f"🚀 Hisab Kitab Python Backend running on http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Python backend...")
        httpd.server_close()


if __name__ == "__main__":
    run()
