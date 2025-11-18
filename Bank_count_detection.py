from fastapi import FastAPI, Request, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

app = FastAPI(title="Email Statement Parser")

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
    # Return tokens to client
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
    """Detect bank name from email subject line or snippet."""
    # Get subject from headers
    headers = msg.get("payload", {}).get("headers", [])
    subject = ""
    for h in headers:
        if h["name"].lower() == "subject":
            subject = h["value"].lower()
            break

    # Detect bank from subject
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
        # fallback: check snippet
        snippet = msg.get("snippet", "").lower()
        for bank in ["hdfc", "sbi", "icici", "kotak"]:
            if bank in snippet:
                return bank.upper()
    return "UNKNOWN"

def get_pdf_info_only(service, msg):
    """Return list of PDFs and detected bank based on email subject."""
    info = []
    bank = get_bank_from_subject(msg)
    parts = msg.get("payload", {}).get("parts", [])
    for part in parts:
        filename = part.get("filename", "")
        if filename.endswith(".pdf"):
            info.append({
                "filename": filename,
                "bank": bank
            })
    return info

# --------------------------
# Phase 2: Detect Statements Endpoint
# --------------------------

@app.get("/detect-statements")
def detect_statements(
    access_token: str = Query(...),
    refresh_token: str = Query(None),
    client_id: str = Query(...),
    client_secret: str = Query(...),
    subject: str = Query(...)
):
    # Create Gmail API service
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.readonly"]
    )
    service = build("gmail", "v1", credentials=creds)

    # Search emails with attachments and given subject
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
