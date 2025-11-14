# gmail_parser_poc.py
import os
import base64
import re
import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from dateutil import parser as dateparser
from bs4 import BeautifulSoup

# ---- CONFIG ----
CLIENT_SECRET_FILE = 'client_secret.json'  # downloaded from Google Cloud Console
TOKEN_FILE = 'token.json'                  # will be created automatically
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
FETCH_QUERY = 'subject:(receipt OR invoice OR payment OR "order confirmation") newer_than:365d'
MAX_MESSAGES = 50  # limit for testing

# ---- Parser patterns ----
patterns = {
    "order_id": re.compile(r'\bOrder\s*(?:#|number|no\.?)\s*[:\-]?\s*([A-Z0-9\-]+)', re.I),
    "order_date": re.compile(r'\bOrder\s*date\s*[:\-]?\s*([0-9]{1,2}\s+\w+\s+[0-9]{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})', re.I),
    "payment_method": re.compile(r'\bPayment\s*method\s*[:\-]?\s*([A-Za-z ]+?(?:ending in|ending with)?\s*\d{0,4})', re.I),
    "card_last4": re.compile(r'(?:ending in|ending with|card\s*ending\s*in)\s*(\d{4})', re.I),
    "amount_any": re.compile(r'(?P<label>(?:Total|Subtotal|Amount charged|Amount|Paid|Total \(inclusive of taxes\)|Total amount|Transaction of))\s*[:\-]?\s*(?P<currency>[A-Za-z₹$€Rs\.\s]*)\s*(?P<value>[0-9\.,]+)', re.I),
    "txn_id": re.compile(r'\b(?:Transaction id|Reference|Txn|TXN)\s*[:\-]?\s*([A-Z0-9\-]+)', re.I),
    "vendor_from": re.compile(r'^From:\s*(.+?)\s*<', re.I | re.M),
    "subject": re.compile(r'^Subject:\s*(.+)$', re.I | re.M),
    "date_header": re.compile(r'^Date:\s*(.+)$', re.I | re.M),
}

# ---- Helper functions ----
def find_first(pattern, text):
    m = pattern.search(text)
    return m.group(1).strip() if m else None

def find_amounts(text):
    out = []
    for m in patterns["amount_any"].finditer(text):
        label = m.group('label').strip()
        currency_raw = m.group('currency').strip()
        val_raw = m.group('value').strip()
        try:
            val_norm = float(val_raw.replace(',', '').replace(' ', ''))
        except:
            val_norm = None
        out.append({"label": label, "currency_raw": currency_raw, "value": val_norm})
    return out

def parse_email_text(text):
    data = {}
    data['vendor'] = find_first(patterns['vendor_from'], text)
    data['subject'] = find_first(patterns['subject'], text)
    data['date_header'] = find_first(patterns['date_header'], text)
    data['order_id'] = find_first(patterns['order_id'], text)
    data['order_date'] = find_first(patterns['order_date'], text)
    data['payment_method'] = find_first(patterns['payment_method'], text)
    data['card_last4'] = find_first(patterns['card_last4'], text)
    data['transaction_id'] = find_first(patterns['txn_id'], text)
    data['amounts'] = find_amounts(text)

    # normalize date
    if data.get('order_date'):
        try:
            dt = dateparser.parse(data['order_date'], dayfirst=True)
            data['order_date_iso'] = dt.date().isoformat()
        except Exception:
            data['order_date_iso'] = data['order_date']
    return data

# ---- Gmail auth ----
def gmail_auth():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as f:
            f.write(creds.to_json())
    return creds

# ---- HTML cleaning ----
def html_to_text(html):
    """Convert HTML body to readable plain text using BeautifulSoup."""
    try:
        soup = BeautifulSoup(html, "html.parser")
        # remove script/style
        for tag in soup(["script", "style"]):
            tag.decompose()
        return soup.get_text(separator="\n")
    except Exception:
        return html

def get_plain_text_from_msg(msg):
    """Extract readable text from Gmail API message structure."""
    parts = []
    if 'payload' in msg:
        payload = msg['payload']

        def walk(part):
            mime = part.get('mimeType')
            body = part.get('body', {})
            data = body.get('data')
            if data:
                decoded = base64.urlsafe_b64decode(data.encode('ASCII')).decode('utf-8', errors='replace')
                if mime == 'text/plain':
                    parts.append(decoded)
                elif mime == 'text/html':
                    parts.append(html_to_text(decoded))
            for p in part.get('parts', []) or []:
                walk(p)

        walk(payload)
    return '\n'.join(parts)

# ---- Fetch and parse ----
def fetch_and_parse(service, query=FETCH_QUERY, max_messages=MAX_MESSAGES):
    results = service.users().messages().list(userId='me', q=query, maxResults=max_messages).execute()
    messages = results.get('messages', [])
    parsed_results = []

    for m in messages:
        msg = service.users().messages().get(userId='me', id=m['id'], format='full').execute()
        text = get_plain_text_from_msg(msg)
        if not text.strip():
            continue
        parsed = parse_email_text(text)
        parsed['gmail_id'] = m['id']
        parsed_results.append(parsed)

    return parsed_results

# ---- MAIN ----
def main():
    creds = gmail_auth()
    service = build('gmail', 'v1', credentials=creds)
    print("Fetching messages matching query:", FETCH_QUERY)
    parsed = fetch_and_parse(service)
    print(json.dumps(parsed, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
