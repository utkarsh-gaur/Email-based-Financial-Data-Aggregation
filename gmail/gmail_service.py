# gmail/gmail_service.py
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import base64
import os

def get_gmail_service(token_info: dict):
    """
    token_info is the dict returned by OAuth flow on frontend (serialized credentials)
    """
    creds = Credentials.from_authorized_user_info(token_info)
    return build("gmail", "v1", credentials=creds)

def search_messages(service, query: str):
    resp = service.users().messages().list(userId="me", q=query).execute()
    return resp.get("messages", [])

def get_message(service, msg_id: str, full=False):
    fmt = "raw" if not full else "full"
    return service.users().messages().get(userId="me", id=msg_id, format=fmt).execute()

def download_pdf_attachments(service, msg_id: str, save_dir="/tmp"):
    msg = get_message(service, msg_id, full=True)
    parts = msg.get("payload", {}).get("parts", []) or []
    files = []
    for p in parts:
        fn = p.get("filename")
        if not fn or not fn.lower().endswith(".pdf"):
            continue
        body = p.get("body", {})
        att_id = body.get("attachmentId")
        if not att_id:
            continue
        att = service.users().messages().attachments().get(userId="me", messageId=msg_id, id=att_id).execute()
        data = base64.urlsafe_b64decode(att.get("data", ""))
        path = os.path.join(save_dir, fn)
        with open(path, "wb") as f:
            f.write(data)
        files.append(path)
    return files
