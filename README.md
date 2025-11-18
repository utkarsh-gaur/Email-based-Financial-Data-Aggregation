# Email Parser (Hybrid) — Starter

Structure:
- extractors/: bank-specific static parsers (deterministic extractions)
- gmail/: Gmail integration + PDF extraction
- utils/: helpers (cleaning, decryption, regex patterns)
- ai/: Gemini wrapper for insights
- processors/: main pipeline
- models/: pydantic models

Run:
1. Create virtualenv, install requirements
2. Set environment var GEMINI_API_KEY or update `ai/ai_parser.py`
3. Run server:
   uvicorn main:app --reload --port 8000

Endpoint:
POST /parse-statement with multipart form:
 - file (pdf)
 - email_subject (optional)
 - email_sender (optional)
