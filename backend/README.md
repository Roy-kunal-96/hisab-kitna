# 🐍 Hisab Kitab - Python Backend Services

Production-grade Python backend for **Hisab Kitab (हिसाब किताब)** — the Voice-First Digital Bahi-Khata Ledger application.

---

## 🌟 Key Features

1. **Native SQLite Bahi-Khata Engine (`db.py`)**:
   - Double-entry ledger logic: **Lena Hai** (+), **Dena Hai** (-), and **Settled**.
   - Immutable audit trail: Deleted/wrong entries are marked `REVERSED` with linked counter-entries.
   - Comprehensive Daybook (Roznamcha) metrics and date filtering.

2. **Gemini Voice NLP Engine (`gemini_service.py`)**:
   - Parses conversational Hindi, Hinglish, and Indian English phrases (*"Ramesh se 500 lene hain"*, *"Suresh ne 200 de diye"*).
   - Generates natural Hindi audio confirmation prompts (*"Ramesh se ₹500 lene hain. Hisaab mein jod doon?"*).
   - Instant offline fallback rule-based NLP parser.

3. **Multiple Server Framework Options**:
   - **`server.py`**: Pure Python Standard Library HTTP server (Zero pip dependencies required!).
   - **`fastapi_app.py`**: High-performance asynchronous FastAPI server with OpenAPI Swagger docs.
   - **`flask_app.py`**: Lightweight synchronous Flask microservice.
   - **`cli.py`**: Interactive command-line interface for terminal operations.

---

## 🚀 Running the Python Backend

### 1. Standard Library Mode (Zero Dependencies)
```bash
python3 backend/server.py
```
Starts the REST API server at `http://127.0.0.1:8000`.

### 2. FastAPI Mode (With Uvicorn & Swagger)
```bash
pip install -r backend/requirements.txt
uvicorn backend.fastapi_app:app --reload --port 8000
```
Interactive Swagger docs available at `http://127.0.0.1:8000/docs`.

### 3. Interactive CLI Mode
```bash
python3 backend/cli.py
```

### 4. Running Unit & Integration Tests
```bash
python3 backend/test_backend.py
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check and runtime information |
| `POST` | `/api/voice/parse` | Parse natural speech transcript into structured financial intent |
| `GET` | `/api/dashboard` | Aggregated Lena Hai / Dena Hai totals, today's metrics, and customer list |
| `GET` | `/api/people` | Search and list active customers with calculated balances |
| `POST` | `/api/people` | Register new customer or supplier with opening balance |
| `GET` | `/api/people/<id>` | Fetch customer details and real-time net balance |
| `PUT` | `/api/people/<id>` | Update customer name or phone number |
| `DELETE` | `/api/people/<id>` | Archive customer account |
| `GET` | `/api/people/<id>/transactions` | Fetch itemized ledger history with date filters |
| `GET` | `/api/daybook` | Fetch global Daybook (Roznamcha) across all store customers |
| `POST` | `/api/transactions` | Record new transaction (Receivable, Payable, Cash Received/Paid) |
| `POST` | `/api/transactions/<id>/reverse` | Revert wrong entry with immutable counter-entry |
| `GET` | `/api/people/<id>/statement` | Generate comprehensive bahi-khata statement data |
