import io
from pypdf import PdfReader

def try_decrypt_pdf_bytes(pdf_bytes: bytes, password: str):
    """
    Attempt to decrypt PDF bytes using password.
    Returns string of concatenated page text if success, else None.
    """
    try:
        stream = io.BytesIO(pdf_bytes)
        reader = PdfReader(stream)

        if reader.is_encrypted:
            # pypdf decrypt returns 0/1; pass both str & bytes
            ok = False
            try:
                if reader.decrypt(password) == 1:
                    ok = True
            except Exception:
                pass
            if not ok:
                return None

        # extract text safely
        pages_text = []
        for page in reader.pages:
            txt = page.extract_text() or ""
            pages_text.append(txt)
        return "\n".join(pages_text)
    except Exception:
        return None
