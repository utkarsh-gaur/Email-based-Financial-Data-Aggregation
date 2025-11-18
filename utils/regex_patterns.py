# utils/regex_patterns.py
"""
Regex patterns for deterministic extraction across banks.
Only static fields included.
"""

HDFC_PATTERNS = {
    "account_number": r"Account\s*Number[:\s]+([Xx\*]+[\d]{3,4})",
    "opening_balance": r"Opening\s*Balance[:\s]+(?:INR|Rs\.?)?\s*([\d,]+\.\d{2})",
    "closing_balance": r"Closing\s*Balance[:\s]+(?:INR|Rs\.?)?\s*([\d,]+\.\d{2})",
    "available_balance": r"Available\s*Balance[:\s]+(?:INR|Rs\.?)?\s*([\d,]+\.\d{2})"
}

ICICI_PATTERNS = {
    "account_number": r"A/c\s*No\.?\s*:?\s*([Xx\*]+[\d]{3,4})",
    "opening_balance": r"Opening\s*Bal(?:ance)?[:\s]+(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "closing_balance": r"Closing\s*Bal(?:ance)?[:\s]+(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "available_balance": r"Available\s*Bal(?:ance)?[:\s]+(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})"
}

SBI_PATTERNS = {
    "account_number": r"A/c\s*No\.?\s*[:\s]*([Xx\*]+[\d]{4})",
    "opening_balance": r"Opening\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "closing_balance": r"Closing\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "available_balance": r"Available\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})"
}

AXIS_PATTERNS = {
    "account_number": r"Account\s*No\.?\s*[:\s]*([Xx\*]+[\d]{4})",
    "opening_balance": r"Opening\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "closing_balance": r"Closing\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "available_balance": r"Available\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})"
}

KOTAK_PATTERNS = {
    "account_number": r"A/c\s*Number[:\s]*([Xx\*]+[\d]{4})",
    "opening_balance": r"Opening\s*Bal(?:ance)?[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "closing_balance": r"Closing\s*Bal(?:ance)?[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "available_balance": r"Available\s*Bal(?:ance)?[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})"
}

CANARA_PATTERNS = {
    "account_number": r"Account\s*No\.?\s*[:\s]*([Xx\*]+[\d]{4})",
    "opening_balance": r"Opening\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "closing_balance": r"Closing\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})",
    "available_balance": r"Avail(?:able)?\s*Balance[:\s]*(?:INR|Rs)?\.?\s*([\d,]+\.\d{2})"
}

BANK_REGEX = {
    "HDFC": HDFC_PATTERNS,
    "ICICI": ICICI_PATTERNS,
    "SBI": SBI_PATTERNS,
    "AXIS": AXIS_PATTERNS,
    "KOTAK": KOTAK_PATTERNS,
    "CANARA": CANARA_PATTERNS,
}
