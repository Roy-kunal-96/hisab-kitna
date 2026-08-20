"""
Comprehensive test suite for Hisab Kitab Python backend services.
"""

import unittest
import sqlite3
import os
import sys

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import init_db, get_db_connection, calculate_person_balance
from backend.gemini_service import fallback_parse
from backend.models import ParsedVoiceIntent


class TestHisabKitabPythonBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_database_initialization(self):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM people")
        count = cursor.fetchone()[0]
        self.assertGreaterEqual(count, 1)
        conn.close()

    def test_balance_calculation(self):
        conn = get_db_connection()
        # Ramesh (id=1) has seed entries: 500+300-400+200 = 600 net LENA_HAI
        balance = calculate_person_balance(conn, 1)
        self.assertEqual(balance["balanceType"], "LENA_HAI")
        self.assertEqual(balance["netBalance"], 600.0)
        conn.close()

    def test_voice_parser_fallback_receivable(self):
        result = fallback_parse("Ramesh se 500 lene hain", ["Ramesh Kumar", "Suresh Verma"])
        self.assertEqual(result.intent, "ADD_TRANSACTION")
        self.assertEqual(result.transaction_type, "RECEIVABLE")
        self.assertEqual(result.amount, 500.0)
        self.assertIn("Ramesh", result.person or "")
        self.assertIn("Ramesh se ₹500 lene hain", result.confirmation_prompt)

    def test_voice_parser_fallback_payable(self):
        result = fallback_parse("Suresh ko 1000 dene hain", ["Ramesh Kumar", "Suresh Verma"])
        self.assertEqual(result.intent, "ADD_TRANSACTION")
        self.assertEqual(result.transaction_type, "PAYABLE")
        self.assertEqual(result.amount, 1000.0)

    def test_voice_parser_fallback_payment_received(self):
        result = fallback_parse("Ramesh ne 200 de diye", ["Ramesh Kumar", "Suresh Verma"])
        self.assertEqual(result.intent, "RECORD_PAYMENT")
        self.assertEqual(result.transaction_type, "PAYMENT_RECEIVED")
        self.assertEqual(result.amount, 200.0)

    def test_voice_parser_fallback_statement(self):
        result = fallback_parse("Ramesh ka statement whatsapp par bhejo", ["Ramesh Kumar", "Suresh Verma"])
        self.assertEqual(result.intent, "GENERATE_STATEMENT")


if __name__ == "__main__":
    unittest.main()
