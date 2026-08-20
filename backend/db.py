"""
Hisab Kitab - SQLite Database Engine in Python
Handles persistent Bahi-Khata ledger storage, double-entry balance calculations,
and immutable reversal audit trails.
"""

import sqlite3
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

DB_FILE = os.path.join(os.getcwd(), "hisab_kitab.sqlite")


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with Row factory enabled for dictionary-like access."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the database tables and seeds sample data if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
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
    """)
    conn.commit()

    # Check if empty, then seed default data
    cursor.execute("SELECT COUNT(*) FROM users")
    user_count = cursor.fetchone()[0]

    if user_count == 0:
        cursor.execute("INSERT INTO users (name) VALUES ('Sharma Kirana Store')")
        
        # Seed initial customers
        cursor.executemany(
            "INSERT INTO people (user_id, name, phone, status) VALUES (1, ?, ?, 'ACTIVE')",
            [
                ('Ramesh Kumar', '9876543210'),
                ('Suresh Verma', '9812345678'),
                ('Mohan Lal', '9765432109'),
                ('Geeta Devi', '9654321098'),
            ]
        )

        now = datetime.now()
        def date_str(days_ago: int) -> str:
            return (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")

        today_str = now.strftime("%Y-%m-%d")

        # Ramesh: owes 600 net
        cursor.executemany(
            "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
            [
                (1, 500.0, 'RECEIVABLE', 'Ration ka samaan', date_str(10)),
                (1, 300.0, 'RECEIVABLE', 'Tel aur cheeni', date_str(7)),
                (1, 400.0, 'PAYMENT_RECEIVED', 'Cash payment', date_str(4)),
                (1, 200.0, 'RECEIVABLE', 'Chawal aur daal', date_str(1)),
            ]
        )

        # Suresh: shopkeeper owes 1000 (PAYABLE)
        cursor.executemany(
            "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
            [
                (2, 1500.0, 'PAYABLE', 'Wholesale supplier invoice', date_str(7)),
                (2, 500.0, 'PAYMENT_MADE', 'UPI payment to Suresh', date_str(4)),
            ]
        )

        # Mohan: owes 250
        cursor.execute(
            "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (3, 250.0, 'RECEIVABLE', 'Daily milk & curd', ?, 'ACTIVE')",
            (today_str,)
        )

        # Geeta Devi: settled
        cursor.executemany(
            "INSERT INTO transactions (person_id, amount, type, description, transaction_date, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')",
            [
                (4, 800.0, 'RECEIVABLE', 'Monthly masala & spices', date_str(10)),
                (4, 800.0, 'PAYMENT_RECEIVED', 'Full settlement gpay', date_str(1)),
            ]
        )

        conn.commit()

    conn.close()


def calculate_person_balance(conn: sqlite3.Connection, person_id: int) -> Dict[str, Any]:
    """
    Calculates the net Bahi-Khata ledger balance for a customer/supplier.
    - RECEIVABLE (+): Amount customer owes to shopkeeper.
    - PAYMENT_RECEIVED (-): Payment received from customer.
    - PAYABLE (+): Amount shopkeeper owes to supplier.
    - PAYMENT_MADE (-): Payment made to supplier.
    - Excludes REVERSED transactions from net totals.
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM transactions WHERE person_id = ? ORDER BY transaction_date ASC, id ASC",
        (person_id,)
    )
    txs = [dict(row) for row in cursor.fetchall()]

    total_given = 0.0      # RECEIVABLE
    total_received = 0.0   # PAYMENT_RECEIVED
    total_payable = 0.0    # PAYABLE
    total_paid = 0.0       # PAYMENT_MADE

    for tx in txs:
        if tx.get("status") == "REVERSED":
            continue

        tx_type = tx.get("type")
        amt = float(tx.get("amount", 0))

        if tx_type == "RECEIVABLE":
            total_given += amt
        elif tx_type == "PAYMENT_RECEIVED":
            total_received += amt
        elif tx_type == "PAYABLE":
            total_payable += amt
        elif tx_type == "PAYMENT_MADE":
            total_paid += amt
        elif tx_type == "ADJUSTMENT":
            total_given += amt

    customer_net = total_given - total_received
    supplier_net = total_payable - total_paid

    net_balance = 0.0
    balance_type = "SETTLED"

    if customer_net != 0:
        net_balance = customer_net
        balance_type = "LENA_HAI" if net_balance > 0 else "DENA_HAI"
    elif supplier_net != 0:
        net_balance = supplier_net
        balance_type = "DENA_HAI" if net_balance > 0 else "LENA_HAI"

    return {
        "netBalance": abs(net_balance),
        "rawBalance": net_balance,
        "balanceType": balance_type,
        "totalGiven": total_given,
        "totalReceived": total_received,
        "totalPayable": total_payable,
        "totalPaid": total_paid,
        "transactionCount": len(txs),
    }
