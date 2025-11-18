from typing import Optional

try:
    from PyPDF2 import PdfReader
except Exception:
    PdfReader = None


def contains_text(pdf_path: str, page_limit: int = 5) -> bool:
    """Return True if the PDF contains extractable text.

    Uses `PyPDF2`'s `extract_text()` on the first few pages; conservative default.
    """
    if PdfReader is None:
        return False

    try:
        reader = PdfReader(pdf_path)
        text = []
        pages_to_check = min(page_limit, len(reader.pages))
        for i in range(pages_to_check):
            try:
                ptext = reader.pages[i].extract_text() or ''
            except Exception:
                ptext = ''
            text.append(ptext)
        joined = '\n'.join(text).strip()
        return len(joined) > 50
    except Exception:
        return False
