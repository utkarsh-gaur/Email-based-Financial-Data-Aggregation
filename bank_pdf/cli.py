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
    parser.add_argument('--pdf', nargs='*', default=[], help='Path(s) to encrypted PDF(s). Provide one or more files')
    parser.add_argument('--pdfs-dir', default='', help='Directory containing PDFs to process (e.g. `pdfs/`). Files found here will be included')
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

    # Build list of PDF paths from explicit args and/or a directory
    pdf_paths = list(args.pdf or [])
    if args.pdfs_dir:
        pdfs_dir = args.pdfs_dir
        if not os.path.isabs(pdfs_dir):
            # interpret relative to repo root (current working directory)
            pdfs_dir = os.path.join(os.getcwd(), pdfs_dir)
        if not os.path.isdir(pdfs_dir):
            print(f'Error: pdfs directory not found: {args.pdfs_dir}')
            return
        # find .pdf files (case-insensitive)
        for fname in os.listdir(pdfs_dir):
            if fname.lower().endswith('.pdf'):
                pdf_paths.append(os.path.join(pdfs_dir, fname))

    if not pdf_paths:
        print('No PDF files provided via --pdf or --pdfs-dir. Nothing to do.')
        return

    # Verify files exist
    missing = [p for p in pdf_paths if not os.path.isfile(p)]
    if missing:
        print('Error: the following files were not found:')
        for m in missing:
            print('  -', m)
        return

    # Generate password candidates once (same credentials used for all attachments)
    candidates = generate_password_candidates(args.full_name, args.phone, args.dob, args.bank, args.max_candidates)
    print(f'Generated {len(candidates)} password candidates (showing up to 10):')
    for c in candidates[:10]:
        print('  -', c)

    consolidated = {'documents': []}

    for pdf_path in pdf_paths:
        print('\nProcessing:', pdf_path)
        success, password, decrypted_path = try_unlock_pdf(pdf_path, candidates)
        if not success:
            print('  Unable to unlock this PDF with generated candidates. Skipping.')
            consolidated['documents'].append({'path': pdf_path, 'error': 'unable to unlock'})
            continue

        if password:
            print('  Successfully unlocked PDF with password:', password)
        else:
            print('  PDF was not encrypted (opened without password).')

        out_path = decrypted_path
        # If user provided --output and only one input file, use that; otherwise keep decrypted temp file.
        if args.output and len(pdf_paths) == 1:
            if decrypted_path and decrypted_path != args.output:
                shutil.copyfile(decrypted_path, args.output)
            out_path = args.output

        is_text = contains_text(out_path)
        if is_text:
            print('  PDF contains extractable text (no OCR needed).')
        else:
            print('  PDF appears to be scanned images (OCR may be required).')

        do_ocr = args.ocr or (not is_text)
        extracted = extract_pdf_all(out_path, ocr=do_ocr, max_pages=args.limit_pages)
        extracted['path'] = pdf_path
        extracted['unlocked_with'] = password
        consolidated['documents'].append(extracted)

    # If analysis requested, send the consolidated data to the LLM and print ONLY the LLM output.
    if args.analyze:
        gemini_key = args.gemini_key or os.environ.get('GEMINI_API_KEY')
        gemini_endpoint = args.gemini_endpoint or os.environ.get('GEMINI_ENDPOINT')
        if not gemini_key:
            print('Analysis requested but GEMINI_API_KEY not provided (set GEMINI_API_KEY env or --gemini-key).')
            return
        # If no endpoint provided, default to Google's Generative Language v1 generateContent for gemini-2.0-flash
        if not gemini_endpoint:
            gemini_endpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent'

        prompt = format_analysis_prompt(consolidated)
        try:
            resp = analyze_with_gemini(prompt, gemini_endpoint, gemini_key)
            parsed = parse_model_response(resp)
            # Print only the model's analysis output
            print(json.dumps(parsed, ensure_ascii=False, indent=2))
        except Exception as e:
            print('Analysis failed:', e)
        return

    # Not analyzing: print a short summary but do not print the full extracted JSON to console
    print('\nConsolidated summary:')
    print('  documents:', len(consolidated['documents']))
    totals = [d.get('num_pages', 0) for d in consolidated['documents'] if not d.get('error')]
    print('  total pages processed (sum of readable docs):', sum(totals))
    if args.json:
        print('Extraction collected; use --analyze to send consolidated data to Gemini or --json-out to save to a file.')


if __name__ == '__main__':
    main()
