import json
import base64
import os
import uuid
import redis
import shutil
import sqlite3
from fastapi import FastAPI, Request, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

app = FastAPI(title="Email Statement Parser")

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Redis
r = redis.StrictRedis(host="localhost", port=6379, db=0)

# Temp folder for PDFs
TEMP_DIR = "temp_pdfs"

# SQLite path (absolute)
DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


# ----------------------------------------------------------
# DB SETUP
# ----------------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS user_banks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            bank_name TEXT NOT NULL,
            UNIQUE(user_id, bank_name)
        )
    """)

    conn.commit()
    conn.close()


# ----------------------------------------------------------
# STARTUP CLEAN + DB INIT
# ----------------------------------------------------------
@app.on_event("startup")
def startup_tasks():
    # Clean temp folder
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR)
    os.makedirs(TEMP_DIR, exist_ok=True)

    # Initialize SQLite
    init_db()


# ----------------------------------------------------------
# STEP 1: Frontend calls /auth?user_id=<uuid>
# ----------------------------------------------------------
@app.get("/auth")
def auth(user_id: str):
    r.setex("current_user_id", 600, user_id)

    flow = Flow.from_client_secrets_file(
        "credentials.json",
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/oauth/callback"
    )
    auth_url, _ = flow.authorization_url(prompt="consent")
    return RedirectResponse(auth_url)


# ----------------------------------------------------------
# STEP 2: OAuth callback → process Gmail
# ----------------------------------------------------------
@app.get("/oauth/callback")
def oauth_callback(request: Request):
    user_id_bytes = r.get("current_user_id")
    if not user_id_bytes:
        return {"error": "User ID expired or missing"}

    user_id = user_id_bytes.decode()

    flow = Flow.from_client_secrets_file(
        "credentials.json",
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/oauth/callback"
    )

    flow.fetch_token(authorization_response=str(request.url))
    creds = flow.credentials

    token_data = {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret
    }
    r.set("gmail_tokens", json.dumps(token_data))

    results = auto_process_statements(creds, user_id)

    return {
        "status": "success",
        "processed": len(results),
        "data": results
    }


# ----------------------------------------------------------
# BANK DETECTION
# ----------------------------------------------------------
def get_bank_from_subject(msg):
    headers = msg.get("payload", {}).get("headers", [])

    subject = ""
    sender_email = ""

    for h in headers:
        name = h["name"].lower()
        value = h["value"].lower()

        if name == "subject":
            subject = value
        elif name == "from":
            sender_email = value

    bank_keywords = {
        "hdfc bank": ["hdfc", "hdfcbank"],
        "state bank of india": ["sbi", "statebank"],
        "icici bank": ["icici"],
        "kotak mahindra bank": ["kotak"],
        "bank of baroda": ["bankofbaroda", "barodabank", "baroda"],
        "axis bank": ["axis"],
        "yes bank": ["yesbank"],
        "union bank of india": ["unionbank"],
        "punjab national bank": ["pnb", "punjabnationalbank"],
        "idfc first bank": ["idfc", "idfcbank", "idfcfirst"],
        "indusind bank": ["indusind"],
        "canara bank": ["canara"],
        "bank of india": ["boi", "bankofindia"]
    }

    def match_bank(text):
        for bank_name, keywords in bank_keywords.items():
            for kw in keywords:
                if kw in text:
                    return bank_name
        return None

    found = match_bank(subject)
    if found:
        return found

    found = match_bank(sender_email)
    if found:
        return found

    snippet = msg.get("snippet", "").lower()
    found = match_bank(snippet)
    if found:
        return found

    return "UNKNOWN"


# ----------------------------------------------------------
# SAVE PDFs + INSERT BANK NAME
# ----------------------------------------------------------
def save_pdf_and_cache(service, msg, user_id):
    info = []
    bank = get_bank_from_subject(msg)

    if bank == "UNKNOWN":
        return info

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT OR IGNORE INTO user_banks (user_id, bank_name) VALUES (?, ?)",
        (user_id, bank.lower())
    )
    conn.commit()
    conn.close()

    parts = msg.get("payload", {}).get("parts", [])

    for part in parts:
        filename = part.get("filename", "")
        if filename.endswith(".pdf"):

            attachment_id = part["body"].get("attachmentId")
            if attachment_id:
                attach = service.users().messages().attachments().get(
                    userId="me",
                    messageId=msg["id"],
                    id=attachment_id
                ).execute()

                pdf_data = base64.urlsafe_b64decode(attach["data"])

                unique_id = str(uuid.uuid4())
                local_path = os.path.join(TEMP_DIR, f"{unique_id}_{filename}")

                with open(local_path, "wb") as f:
                    f.write(pdf_data)

                r.setex(f"pdf:{unique_id}", 900, local_path)

                info.append({
                    "uuid": unique_id,
                    "filename": filename,
                    "bank": bank,
                    "path": local_path
                })

    return info


# ----------------------------------------------------------
# PROCESS GMAIL FOR USER
# ----------------------------------------------------------
def auto_process_statements(creds, user_id):
    service = build("gmail", "v1", credentials=creds)

    messages_result = service.users().messages().list(
        userId='me',
        q='has:attachment "statement" newer_than:180d'
    ).execute()

    messages = messages_result.get("messages", [])
    results = []

    for msg_info in messages:
        msg = service.users().messages().get(
            userId='me',
            id=msg_info["id"]
        ).execute()

        pdfs = save_pdf_and_cache(service, msg, user_id)
        results.extend(pdfs)

    return results
