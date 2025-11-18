import argparse
import os
import shutil
import json
try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

# If a .env file is present in the repo root, load it so environment variables
# like GEMINI_API_KEY and GEMINI_ENDPOINT become available.
if load_dotenv is not None:
    load_dotenv()
from .generator import generate_password_candidates
from .unlocker import try_unlock_pdf
from .detector import contains_text
from .extractor import extract_pdf_all
from .analysis import format_analysis_prompt, analyze_with_gemini, parse_model_response


def main(argv=None):
    parser = argparse.ArgumentParser(description='Attempt to unlock a password-protected bank-statement PDF')
    parser.add_argument('--pdf', required=True, help='Path to the encrypted PDF')
    parser.add_argument('--full-name', required=True, help='Full name used for candidate generation')
    parser.add_argument('--phone', default='', help='Phone number (digits only or with separators)')
    parser.add_argument('--dob', default='', help='Date of birth (any format; digits will be used)')
    parser.add_argument('--bank', default='', help='Bank name to pick templates (e.g., HDFC, SBI, ICICI)')
    parser.add_argument('--max-candidates', type=int, default=200, help='Max password candidates to try')
    parser.add_argument('--output', default='', help='Optional path to write decrypted PDF (default: temp file)')
    parser.add_argument('--json', action='store_true', help='Print everything extractable as JSON')
    parser.add_argument('--ocr', action='store_true', help='Force OCR pass when no extractable text is found')
    parser.add_argument('--limit-pages', type=int, default=None, help='Limit pages to inspect/ocr (default: all)')
    parser.add_argument('--analyze', action='store_true', help='Send extracted JSON to an LLM (Gemini) for analysis')
    parser.add_argument('--gemini-endpoint', default='', help='LLM endpoint URL (can also be set via GEMINI_ENDPOINT env var)')
    parser.add_argument('--gemini-key', default='', help='API key for Gemini (can also be set via GEMINI_API_KEY env var)')
    args = parser.parse_args(argv)

    pdf_path = args.pdf
    if not os.path.isfile(pdf_path):
        print(f'Error: file not found: {pdf_path}')
        return

    candidates = generate_password_candidates(args.full_name, args.phone, args.dob, args.bank, args.max_candidates)
    print(f'Generated {len(candidates)} password candidates (showing up to 10):')
    for c in candidates[:10]:
        print('  -', c)

    success, password, decrypted_path = try_unlock_pdf(pdf_path, candidates)
    if not success:
        print('Unable to unlock the PDF with generated candidates.')
        return

    if password:
        print('Successfully unlocked PDF with password:', password)
    else:
        print('PDF was not encrypted (opened without password).')

    out_path = args.output or decrypted_path
    if args.output and decrypted_path and decrypted_path != args.output:
        shutil.copyfile(decrypted_path, args.output)
        out_path = args.output

    is_text = contains_text(out_path)
    if is_text:
        print('PDF contains extractable text (no OCR needed).')
    else:
        print('PDF appears to be scanned images (OCR may be required).')

    # Decide whether to run OCR: if user passed --ocr or if no text was found
    do_ocr = args.ocr or (not is_text)

    extracted = extract_pdf_all(out_path, ocr=do_ocr, max_pages=args.limit_pages)

    if args.json:
        # attach unlock info
        extracted['unlocked_with'] = password
        print(json.dumps(extracted, ensure_ascii=False, indent=2))
    else:
        print('Decrypted file (if created):', out_path)
        print('Summary:')
        print('  num_pages:', extracted.get('num_pages'))
        print('  metadata keys:', list(extracted.get('metadata', {}).keys()))
        if extracted.get('ocr_performed'):
            print('  OCR performed: yes')
        else:
            print('  OCR performed: no')

    # Optional analysis via Gemini (or any REST LLM endpoint)
    if args.analyze:
        gemini_key = args.gemini_key or os.environ.get('GEMINI_API_KEY')
        gemini_endpoint = args.gemini_endpoint or os.environ.get('GEMINI_ENDPOINT')
        if not gemini_key:
            print('Analysis requested but GEMINI_API_KEY not provided (set GEMINI_API_KEY env or --gemini-key).')
            return
        # If no endpoint provided, default to Google's Generative Language API (text-bison)
        if not gemini_endpoint:
            gemini_endpoint = 'https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText'

        prompt = format_analysis_prompt(extracted)
        print('Sending data to LLM endpoint for analysis...')
        try:
            resp = analyze_with_gemini(prompt, gemini_endpoint, gemini_key)
            parsed = parse_model_response(resp)
            print('\n=== Analysis Result ===')
            print(json.dumps(parsed, ensure_ascii=False, indent=2))
        except Exception as e:
            print('Analysis failed:', e)


if __name__ == '__main__':
    main()
