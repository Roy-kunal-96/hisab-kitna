"""
Hisab Kitab - Interactive Terminal CLI in Python
Allows shopkeepers to manage customer balances, record transactions, and parse voice/text commands.
"""

import sys
import os

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import init_db, get_db_connection, calculate_person_balance
from backend.gemini_service import parse_voice_command


def print_banner():
    print("=" * 60)
    print("      📖 HISAB KITAB (हिसाब किताब) - PYTHON CLI")
    print("             'Bolkar Hisaab Rakho'")
    print("=" * 60)


def show_dashboard():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM people WHERE status = 'ACTIVE' ORDER BY name ASC")
    people = cursor.fetchall()

    print("\n--- 📊 DASHBOARD SUMMARY ---")
    total_lena = 0.0
    total_dena = 0.0

    print(f"{'ID':<4} | {'Customer Name':<18} | {'Phone':<12} | {'Balance':<18}")
    print("-" * 60)

    for p in people:
        bal = calculate_person_balance(conn, p["id"])
        bal_str = f"₹{bal['netBalance']:,.2f} ({bal['balanceType']})"
        if bal["balanceType"] == "LENA_HAI":
            total_lena += bal["netBalance"]
        elif bal["balanceType"] == "DENA_HAI":
            total_dena += bal["netBalance"]

        print(f"{p['id']:<4} | {p['name']:<18} | {p['phone'] or '-':<12} | {bal_str:<18}")

    print("-" * 60)
    print(f"💰 TOTAL LENA HAI (Receivable): ₹{total_lena:,.2f}")
    print(f"💸 TOTAL DENA HAI (Payable):   ₹{total_dena:,.2f}")
    conn.close()


def parse_voice_interactive():
    text = input("\n🎙️ Enter Hindi/Hinglish Voice Command (e.g. 'Ramesh se 500 lene hain'): ").strip()
    if not text:
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM people WHERE status = 'ACTIVE'")
    known_names = [row["name"] for row in cursor.fetchall()]
    conn.close()

    result = parse_voice_command(text, known_names)
    print("\n--- 🧠 PARSED RESULT ---")
    print(f"Intent:         {result.intent}")
    print(f"Person:         {result.person}")
    print(f"Amount:         ₹{result.amount}" if result.amount else "Amount:         None")
    print(f"Tx Type:        {result.transaction_type}")
    print(f"Prompt (Hindi): {result.confirmation_prompt}")
    print(f"Speech Audio:   {result.speech_response}")


def main():
    init_db()
    print_banner()

    while True:
        print("\n1. 📊 View Dashboard & Customer Balances")
        print("2. 🎙️ Test Voice Parser (Hindi / Hinglish)")
        print("3. ❌ Exit")

        choice = input("\nSelect an option (1-3): ").strip()
        if choice == "1":
            show_dashboard()
        elif choice == "2":
            parse_voice_interactive()
        elif choice == "3" or choice.lower() == "exit":
            print("\nDhanyawad! Hisab Kitab band ho raha hai.\n")
            break
        else:
            print("Invalid option. Please try again.")


if __name__ == "__main__":
    main()
