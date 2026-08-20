"""
Gemini Voice NLP Service in Python for Hisab Kitab.
Parses natural conversational Hindi, Hinglish, and Indian English commands into
structured bahi-khata financial actions with spoken confirmations and clarifications.
"""

import os
import re
import json
import urllib.request
import urllib.error
from typing import List, Optional, Dict, Any
from backend.models import ParsedVoiceIntent


def fallback_parse(text: str, known_people: Optional[List[str]] = None) -> ParsedVoiceIntent:
    """
    Rule-based offline NLP parser for Indian retail Hinglish/Hindi phrasing.
    """
    if known_people is None:
        known_people = []

    clean = text.strip().lower()

    # Extract numerical amount
    amount_match = re.search(r'(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupaye|rs|inr|₹|ka|wala)?', clean)
    amount: Optional[float] = None
    if amount_match:
        try:
            amount = float(amount_match.group(1).replace(',', ''))
        except ValueError:
            amount = None

    # Match person from known customers
    person: Optional[str] = None
    for p in known_people:
        if p.lower() in clean:
            person = p
            break

    # If not matched, try extracting name before Hindi prepositions (se, ko, ne, ka, ki)
    if not person:
        name_match = re.search(r'([a-zA-Z\u0900-\u097F]+(?:\s+[a-zA-Z\u0900-\u097F]+)?)\s+(?:se|ko|ne|ka|ki)\b', text, re.IGNORECASE)
        if name_match:
            candidate = name_match.group(1).strip()
            if candidate.lower() not in ['naya', 'new', 'total', 'abhi', 'aaj', 'kal', 'khata']:
                person = candidate

    # 1. New Customer intent
    if re.search(r'naya customer|add customer|naye grahak|naya khata', clean):
        cust_name = re.sub(r'naya customer|add customer|naye grahak|naya khata', '', text, flags=re.IGNORECASE).strip()
        final_name = cust_name or person or 'Grahak'
        return ParsedVoiceIntent(
            intent='ADD_CUSTOMER',
            person=final_name,
            amount=None,
            transaction_type=None,
            description=None,
            period=None,
            confirmation_prompt=f"Naya customer {final_name} ko hisaab mein jod doon?",
            speech_response=f"Naya customer {final_name} ko joda ja raha hai.",
            clarification_needed=False,
            clarification_question=None,
        )

    # 2. PDF / Statement / WhatsApp share
    if re.search(r'pdf|statement|whatsapp|bill', clean):
        target_person = person or 'Customer'
        period = 'August' if 'august' in clean else 'current'
        return ParsedVoiceIntent(
            intent='GENERATE_STATEMENT',
            person=target_person,
            amount=None,
            transaction_type=None,
            description=None,
            period=period,
            confirmation_prompt=f"{target_person} ka statement bana doon?",
            speech_response=f"{target_person} ka statement taiyar ho raha hai.",
            clarification_needed=False,
            clarification_question=None,
        )

    # 3. Transaction correction / reversal
    if re.search(r'galat hai|correct|reverse|hatao|wrong|cancel', clean):
        target_person = person or 'Is'
        amt_str = f" ₹{amount} wala" if amount else ""
        return ParsedVoiceIntent(
            intent='CORRECT_TRANSACTION',
            person=person,
            amount=amount,
            transaction_type='REVERSAL',
            description='Transaction correction via voice',
            period=None,
            confirmation_prompt=f"{target_person} ka{amt_str} transaction galat darj hua tha, kya reversal entry banayein?",
            speech_response="Theek hai, reversal hisaab me darj kiya jayega.",
            clarification_needed=False,
            clarification_question=None,
        )

    # 4. Total and balance checks
    if re.search(r'kitna lena hai|kitna dena hai|hisaab batao|balance|baqi', clean) and not amount:
        if re.search(r'total|sabka|aaj ka|sab', clean):
            return ParsedVoiceIntent(
                intent='GET_TOTAL',
                person=None,
                amount=None,
                transaction_type=None,
                description=None,
                period='today' if 'aaj' in clean else 'all',
                confirmation_prompt='Total hisaab dikha raha hoon.',
                speech_response='Aapka kul baqi hisaab screen par hai.',
                clarification_needed=False,
                clarification_question=None,
            )
        return ParsedVoiceIntent(
            intent='GET_BALANCE',
            person=person,
            amount=None,
            transaction_type=None,
            description=None,
            period=None,
            confirmation_prompt=f"{person or 'Grahak'} ka hisaab dikha raha hoon.",
            speech_response=f"{person or 'Grahak'} ka hisaab screen par hai.",
            clarification_needed=person is None,
            clarification_question='Kiska hisaab dekhna hai?' if not person else None,
        )

    # 5. Full ledger history
    if re.search(r'poora hisaab|last transaction|ledger|pichla hisaab', clean):
        return ParsedVoiceIntent(
            intent='GET_LEDGER',
            person=person,
            amount=None,
            transaction_type=None,
            description=None,
            period='August' if 'august' in clean else 'all',
            confirmation_prompt=f"{person or 'Grahak'} ka poora khata khola ja raha hai.",
            speech_response=f"{person or 'Grahak'} ka poora ledger taiyar hai.",
            clarification_needed=person is None,
            clarification_question='Kiska poora hisaab dekhna hai?' if not person else None,
        )

    # 6. Giving credit / Goods sold on udhar (RECEIVABLE: customer owes shopkeeper)
    # e.g. "Ramesh se 500 lene hain", "Ramesh ko 500 ka ration diya"
    if re.search(r'lene hain|lena hai|ka ration diya|ka samaan diya|udhari di|diye|diya', clean) and not re.search(r'de diye|jama', clean):
        desc = 'Samaan / Udhari'
        if 'ration' in clean: desc = 'Ration'
        elif 'doodh' in clean or 'milk' in clean: desc = 'Doodh'
        elif 'tel' in clean or 'oil' in clean: desc = 'Tel / Grocery'

        p = person or 'Grahak'
        amt = amount or 0.0
        needs_clarification = (person is None) or (amount is None or amount <= 0)

        return ParsedVoiceIntent(
            intent='ADD_TRANSACTION',
            person=p if person else None,
            amount=amt if amount else None,
            transaction_type='RECEIVABLE',
            description=desc,
            period=None,
            confirmation_prompt=f"{p} se ₹{amt:g} lene hain. Hisaab mein jod doon?",
            speech_response=f"{p} ke khate mein ₹{amt:g} lena joda gaya.",
            clarification_needed=needs_clarification,
            clarification_question="Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?" if needs_clarification else None,
        )

    # 7. Shopkeeper owes money to supplier (PAYABLE)
    # e.g. "Suresh ko 1000 dene hain"
    if re.search(r'dene hain|dena hai', clean) and not re.search(r'de diye', clean):
        p = person or 'Vyapari'
        amt = amount or 0.0
        needs_clarification = (person is None) or (amount is None or amount <= 0)

        return ParsedVoiceIntent(
            intent='ADD_TRANSACTION',
            person=p if person else None,
            amount=amt if amount else None,
            transaction_type='PAYABLE',
            description='Dena baqi',
            period=None,
            confirmation_prompt=f"{p} ko ₹{amt:g} dene hain. Hisaab mein jod doon?",
            speech_response=f"{p} ke hisaab mein ₹{amt:g} dena darj kiya gaya.",
            clarification_needed=needs_clarification,
            clarification_question="Kisko aur kitne rupaye dene hain?" if needs_clarification else None,
        )

    # 8. Payment received from customer (PAYMENT_RECEIVED)
    # e.g. "Ramesh ne 200 de diye", "Payment mil gaya"
    if re.search(r'de diye|jama kiye|payment mila|received|jama', clean) and re.search(r'se|ne|mil', clean):
        p = person or 'Grahak'
        amt = amount or 0.0
        needs_clarification = (person is None) or (amount is None or amount <= 0)

        return ParsedVoiceIntent(
            intent='RECORD_PAYMENT',
            person=p if person else None,
            amount=amt if amount else None,
            transaction_type='PAYMENT_RECEIVED',
            description='Jama / Cash payment',
            period=None,
            confirmation_prompt=f"{p} ne ₹{amt:g} jama kar diye. Hisaab mein darj kar doon?",
            speech_response=f"{p} se ₹{amt:g} jama darj kiya gaya.",
            clarification_needed=needs_clarification,
            clarification_question="Kisne kitne rupaye jama kiye?" if needs_clarification else None,
        )

    # 9. Payment made by shopkeeper to supplier (PAYMENT_MADE)
    # e.g. "Suresh ko 500 de diye"
    if re.search(r'de diye|chukta kiya|payment kiya', clean) and re.search(r'ko', clean):
        p = person or 'Vyapari'
        amt = amount or 0.0
        needs_clarification = (person is None) or (amount is None or amount <= 0)

        return ParsedVoiceIntent(
            intent='RECORD_PAYMENT',
            person=p if person else None,
            amount=amt if amount else None,
            transaction_type='PAYMENT_MADE',
            description='Bhugtan / Payment made',
            period=None,
            confirmation_prompt=f"{p} ko ₹{amt:g} de diye. Hisaab mein darj kar doon?",
            speech_response=f"{p} ko ₹{amt:g} ka bhugtan darj kiya gaya.",
            clarification_needed=needs_clarification,
            clarification_question="Kisko kitne rupaye diye?" if needs_clarification else None,
        )

    # Unknown
    return ParsedVoiceIntent(
        intent='UNKNOWN',
        person=person,
        amount=amount,
        transaction_type=None,
        description=None,
        period=None,
        confirmation_prompt='Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?',
        speech_response='Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?',
        clarification_needed=True,
        clarification_question='Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?',
    )


def parse_voice_command(transcript: str, existing_customer_names: Optional[List[str]] = None) -> ParsedVoiceIntent:
    """
    Parses voice transcript using Gemini 3.7 Flash API (via direct REST endpoint)
    or falls back gracefully to rule-based parser.
    """
    if existing_customer_names is None:
        existing_customer_names = []

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return fallback_parse(transcript, existing_customer_names)

    prompt = f"""You are the voice parser for "Hisab Kitab" - a rural and small-business Bahi-Khata ledger app in India.
The user speaks in Hindi, Hinglish, or Indian English.

User transcript: "{transcript}"
Existing registered customers in store: {json.dumps(existing_customer_names)}

Map this speech to one of the following structured intents:
- ADD_TRANSACTION: User gave goods on credit / owes money or customer owes money. (e.g. "Ramesh se 500 lene hain" -> RECEIVABLE, "Suresh ko 1000 dene hain" -> PAYABLE, "Ramesh ko 500 ka ration diya" -> RECEIVABLE)
- RECORD_PAYMENT: Customer paid shopkeeper or shopkeeper paid supplier. (e.g. "Ramesh ne 200 de diye" -> PAYMENT_RECEIVED, "Suresh ko 500 de diye" -> PAYMENT_MADE)
- ADD_CUSTOMER: Creating a new person (e.g. "Naya customer Ramesh Kumar")
- GET_BALANCE: Querying how much money is owed/pending (e.g. "Ramesh ka hisaab batao", "Ramesh se kitna lena hai?", "Suresh ko kitna dena hai?")
- GET_LEDGER: Showing full history/ledger (e.g. "Ramesh ka poora hisaab dikhao", "Ramesh ka August ka hisaab dikhao")
- GET_TRANSACTION: Querying specific recent transaction (e.g. "Ramesh ka last transaction batao")
- GET_TOTAL: Total receivables or payables (e.g. "Abhi total kitna lena hai?", "Total kitna dena hai?", "Aaj ka hisaab batao")
- GENERATE_STATEMENT: Requesting PDF or WhatsApp statement (e.g. "Ramesh ka hisaab PDF bana do", "Ramesh ka statement WhatsApp par bhejna hai")
- CORRECT_TRANSACTION: Reversing/correcting a wrong entry (e.g. "Ramesh ka 500 wala transaction galat hai")
- UNKNOWN: Cannot confidently understand or missing key parameters.

CRITICAL INSTRUCTIONS:
1. If the person name closely matches an existing customer in the store, use the existing customer's canonical name.
2. In confirmation_prompt, craft a concise, natural Hindi sentence asking for confirmation before saving. (e.g. "Ramesh se ₹500 lene hain. Hisaab mein jod doon?").
3. In speech_response, craft a polite Hindi/Hinglish sentence informing the shopkeeper.
4. If missing essential parameters for financial changes (person or amount), set clarification_needed to true and provide clarification_question in friendly Hindi ("Thoda aur clearly boliye. Kiska hisaab aur kitne rupaye?").
5. Return strictly a JSON object with fields: intent, person, amount, transaction_type, description, period, confirmation_prompt, speech_response, clarification_needed, clarification_question.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
        }
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "aistudio-build-python"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidates = res_data.get("candidates", [])
            if candidates:
                text_content = candidates[0]["content"]["parts"][0]["text"]
                parsed_json = json.loads(text_content.strip())
                return ParsedVoiceIntent(
                    intent=parsed_json.get("intent", "UNKNOWN"),
                    person=parsed_json.get("person"),
                    amount=float(parsed_json["amount"]) if parsed_json.get("amount") is not None else None,
                    transaction_type=parsed_json.get("transaction_type"),
                    description=parsed_json.get("description"),
                    period=parsed_json.get("period"),
                    confirmation_prompt=parsed_json.get("confirmation_prompt", "Hisaab mein jod doon?"),
                    speech_response=parsed_json.get("speech_response", "Hisaab darj kiya gaya."),
                    clarification_needed=bool(parsed_json.get("clarification_needed", False)),
                    clarification_question=parsed_json.get("clarification_question"),
                )
    except Exception as e:
        print(f"[Python Gemini Service] Fallback due to error: {e}")

    return fallback_parse(transcript, existing_customer_names)
