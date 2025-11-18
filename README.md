# Email-based Financial Data Aggregation — PDF Unlock Helper

This small CLI helps attempt to unlock a password-protected bank-statement PDF by generating candidate passwords from provided credentials and simple bank-specific templates. After unlocking (if successful), it reports whether the PDF contains extractable text or appears to be scanned images (OCR required).

Quick notes:
- This tool **tries guessed passwords** based on the inputs you provide. You are responsible for using it only on PDFs you are authorized to access.
- The bank templates included are example heuristics. Update `generate_password_candidates` in `main.py` to add real templates.

Setup
1. Create and activate a Python environment (Windows PowerShell example):

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. For OCR (optional) install Tesseract separately:
- Windows: https://github.com/tesseract-ocr/tesseract

Usage

```powershell
python main.py --pdf statement.pdf --full-name "John Doe" --phone "+91-98765-43210" --dob "01-02-1990" --bank HDFC
```

What the script does
- Generates password candidates using `full_name`, `phone`, `dob`, and `bank`.
- Attempts to open the PDF using `pikepdf` with each candidate; saves a decrypted temporary copy on success.
- Uses `PyPDF2` text extraction to check whether the PDF contains extractable text (if not, it reports that OCR is required).

Files of interest
- `main.py` — CLI and core logic (password generation, unlock, text detection).
- `requirements.txt` — Python packages used.

Extending bank patterns
- Edit the `bank_templates` map inside `generate_password_candidates` in `main.py`. Add bank key (lowercase) and a list of templates. Templates support placeholders: `{first}`, `{last}`, `{initials}`, `{dob}`, `{dob_short}`, `{phone4}`, `{bank}`.

Limitations & safety
- This implements a heuristic guesser — it is not guaranteed to succeed. Patterns vary between banks and may change.
- Ensure you have legal authorization to attempt unlocking PDFs.
- OCR requires Tesseract installed on the system; `pytesseract` is only a Python wrapper.

Next steps you might ask for
- Add a configuration file to define bank patterns externally.
- Add logging and rate-limiting to avoid too many password attempts in short time.
- Add an optional OCR pass (using `pdf2image` + `pytesseract`) to return extracted text when only scanned images are present.
