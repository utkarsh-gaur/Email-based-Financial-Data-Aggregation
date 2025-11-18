import json
from typing import Dict, Any, Optional

try:
    from PyPDF2 import PdfReader
except Exception:
    PdfReader = None

try:
    from pdf2image import convert_from_path
    import pytesseract
except Exception:
    convert_from_path = None
    pytesseract = None


def _clean_metadata(md) -> Dict[str, Any]:
    if not md:
        return {}
    out = {}
    try:
        # PyPDF2 metadata keys often start with a leading '/'
        for k, v in dict(md).items():
            key = k[1:] if isinstance(k, str) and k.startswith('/') else str(k)
            out[key] = v
    except Exception:
        try:
            for k in md:
                out[str(k)] = md[k]
        except Exception:
            pass
    return out


def extract_pdf_all(pdf_path: str, ocr: bool = False, max_pages: Optional[int] = None) -> Dict[str, Any]:
    """Extract metadata and per-page text from `pdf_path`.

    If `ocr` is True (or pdf2image+pytesseract are available and text is missing), an OCR pass will be attempted.
    Returns a dict suitable for JSON serialization.
    """
    result: Dict[str, Any] = {'path': pdf_path, 'metadata': {}, 'num_pages': 0, 'pages': [], 'ocr_performed': False}

    if PdfReader is None:
        result['error'] = 'PyPDF2 not installed'
        return result

    try:
        reader = PdfReader(pdf_path)
        md = _clean_metadata(reader.metadata)
        result['metadata'] = md
        num_pages = len(reader.pages)
        result['num_pages'] = num_pages
        pages_to_check = num_pages if max_pages is None else min(num_pages, max_pages)

        extracted_total = ''
        for i in range(pages_to_check):
            try:
                text = reader.pages[i].extract_text() or ''
            except Exception:
                text = ''
            page_entry = {'page_number': i + 1, 'text': text}
            result['pages'].append(page_entry)
            extracted_total += text or ''

        result['extracted_text'] = extracted_total

        # if no extracted text and ocr requested or possible, run OCR
        if (not extracted_total.strip()) and (ocr or (ocr is False and convert_from_path and pytesseract)):
            # attempt OCR on the pages we collected (or all pages)
            if convert_from_path is None or pytesseract is None:
                result['ocr_error'] = 'pdf2image or pytesseract not available'
            else:
                ocr_text_total = ''
                images = convert_from_path(pdf_path, dpi=200, first_page=1, last_page=pages_to_check)
                for idx, img in enumerate(images):
                    try:
                        txt = pytesseract.image_to_string(img)
                    except Exception as e:
                        txt = ''
                    ocr_text_total += txt or ''
                    # attach ocr_text per page
                    if idx < len(result['pages']):
                        result['pages'][idx]['ocr_text'] = txt
                    else:
                        result['pages'].append({'page_number': idx + 1, 'text': '', 'ocr_text': txt})

                result['ocr_performed'] = True
                result['ocr_text'] = ocr_text_total

        return result
    except Exception as e:
        return {'error': f'failed to read PDF: {e}'}
