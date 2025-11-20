from fastapi import FastAPI, Request, Query
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# NEW IMPORTS --------------------------------------------------
import base64
import os
import uuid
import redis
import shutil
# --------------------------------------------------------------

app = FastAPI(title="Email Statement Parser")

# --------------------------
# Redis + Temp Folder Setup
# --------------------------
r = redis.StrictRedis(host="localhost", port=6379, db=0)

TEMP_DIR = "temp_pdfs"
os.makedirs(TEMP_DIR, exist_ok=True)

# --------------------------
# Auto-clear temp folder on startup
# --------------------------
def clear_folder(path):
    if os.path.exists(path):
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            if os.path.isfile(item_path) or os.path.islink(item_path):
                os.unlink(item_path)
            else:
                shutil.rmtree(item_path)

@app.on_event("startup")
def wipe_temp_dir():
    clear_folder(TEMP_DIR)


# --------------------------
# Gmail OAuth Config
# --------------------------
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


# --------------------------
# Phase 1: OAuth Endpoints
# --------------------------
@app.get("/auth")
def auth():
    flow = Flow.from_client_secrets_file(
        "credentials.json",
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/oauth/callback"
    )
    auth_url, _ = flow.authorization_url(prompt="consent")
    return RedirectResponse(auth_url)

@app.get("/oauth/callback")
def oauth_callback(request: Request):
    code = request.query_params.get("code")
    flow = Flow.from_client_secrets_file(
        "credentials.json",
        scopes=SCOPES,
        redirect_uri="http://localhost:8000/oauth/callback"
    )
    flow.fetch_token(code=code)

    creds = flow.credentials
    return {
        "access_token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret
    }


# --------------------------
# Phase 2: Helper Functions
# --------------------------
def get_bank_from_subject(msg):
    headers = msg.get("payload", {}).get("headers", [])
    subject = ""
    for h in headers:
        if h["name"].lower() == "subject":
            subject = h["value"].lower()
            break

    if "hdfc" in subject:
        return "HDFC"
    elif "sbi" in subject:
        return "SBI"
    elif "icici" in subject:
        return "ICICI"
    elif "kotak" in subject:
        return "KOTAK"
    elif "bob" in subject:
        return "BOB"
    else:
        snippet = msg.get("snippet", "").lower()
        for bank in ["hdfc", "sbi", "icici", "kotak"]:
            if bank in snippet:
                return bank.upper()
    return "UNKNOWN"


# --------------------------
# PDF Download + Redis store
# --------------------------
def get_pdf_info_only(service, msg):
    info = []
    bank = get_bank_from_subject(msg)

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


# --------------------------
# Phase 3: Detect Statements
# --------------------------
@app.get("/detect-statements")
def detect_statements(
    access_token: str = Query(...),
    refresh_token: str = Query(None),
    client_id: str = Query(...),
    client_secret: str = Query(...),
    subject: str = Query(...)
):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.readonly"]
    )
    service = build("gmail", "v1", credentials=creds)

    messages_result = service.users().messages().list(
        userId='me', q=f'subject:"{subject}" has:attachment'
    ).execute()
    messages = messages_result.get("messages", [])

    results = []
    for msg_info in messages:
        msg_id = msg_info["id"]
        msg = service.users().messages().get(userId='me', id=msg_id).execute()
        pdfs = get_pdf_info_only(service, msg)
        results.extend(pdfs)

    return {"count": len(results), "data": results}
