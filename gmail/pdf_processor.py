# gmail/pdf_processor.py
from utils.decrypt import try_decrypt_pdf_bytes
from utils.clean_text import clean_text

def extract_text_from_pdf_bytes(pdf_bytes: bytes, password: str = None) -> str:
    """
    Try password first (if provided); otherwise try without password.
    Returns '' on failure.
    """
    if password:
        text = try_decrypt_pdf_bytes(pdf_bytes, password)
        if text:
            return text
    # try without password
    text = try_decrypt_pdf_bytes(pdf_bytes, "")
    return text or ""
