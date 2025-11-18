import tempfile
import os
from typing import List, Tuple, Optional

try:
    import pikepdf
except Exception:
    pikepdf = None


def try_unlock_pdf(pdf_path: str, candidates: List[str]) -> Tuple[bool, Optional[str], Optional[str]]:
    """Attempt to open `pdf_path` with each password candidate. Returns (success, password, decrypted_path).

    If the file is not encrypted, it returns (True, None, original_path).
    """
    if pikepdf is None:
        raise RuntimeError('pikepdf is required but not installed. See requirements.txt')

    try:
        with pikepdf.open(pdf_path) as pdf:
            return True, None, pdf_path
    except Exception:
        # Likely encrypted; we'll attempt candidates.
        pass

    for pw in candidates:
        try:
            with pikepdf.open(pdf_path, password=pw) as pdf:
                tmp_fd, tmp_path = tempfile.mkstemp(suffix='.pdf')
                os.close(tmp_fd)
                pdf.save(tmp_path)
                return True, pw, tmp_path
        except Exception:
            continue

    return False, None, None
