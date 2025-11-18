# gmail/bank_rules.py
BANK_SENDERS = {
    "HDFC": ["hdfcbank.com", "alerts.hdfcbank.net"],
    "ICICI": ["icicibank.com"],
    "SBI": ["sbi.co.in"],
    "AXIS": ["axisbank.com"],
    "KOTAK": ["kotak.com"],
    "CANARA": ["canarabank.in", "canarabank.com"]
}

def get_bank_from_subject(subject: str):
    if not subject:
        return None
    s = subject.lower()
    if "hdfc" in s or "hdfc bank" in s:
        return "HDFC"
    if "icici" in s:
        return "ICICI"
    if "sbi" in s or "state bank" in s:
        return "SBI"
    if "axis" in s:
        return "AXIS"
    if "kotak" in s:
        return "KOTAK"
    if "canara" in s or "canara bank" in s:
        return "CANARA"
    return None

def detect_bank_by_sender(sender: str):
    s = (sender or "").lower()
    for bank, domains in BANK_SENDERS.items():
        for d in domains:
            if d in s:
                return bank
    return None

def detect_bank(sender: str, subject: str):
    bank = get_bank_from_subject(subject)
    if bank:
        return bank
    return detect_bank_by_sender(sender)
