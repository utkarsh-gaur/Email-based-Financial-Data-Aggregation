import argparse
import os
import shutil
import json
import sqlite3
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
    parser.add_argument('--pdfs-dir', default='temp_pdfs', help='Directory containing PDFs to process (default: temp_pdfs)')
    # Make full-name optional; if missing, we will try to read from ui/users.db
    parser.add_argument('--full-name', default='', help='Full name used for candidate generation (defaults to latest user in ui/users.db)')
    parser.add_argument('--phone', default='', help='Phone number (digits only or with separators; defaults to latest user mobile)')
    parser.add_argument('--dob', default='', help='Date of birth (any format; defaults to latest user dob)')
    # Default bank set to SBI unless provided in args or users.db
    parser.add_argument('--bank', default='SBI', help='Bank name to pick templates (default: SBI)')
    parser.add_argument('--max-candidates', type=int, default=200, help='Max password candidates to try')
    parser.add_argument('--output', default='', help='Optional path to write decrypted PDF (default: temp file)')
    parser.add_argument('--json', action='store_true', help='Print everything extractable as JSON')
    parser.add_argument('--ocr', action='store_true', help='Force OCR pass when no extractable text is found')
    parser.add_argument('--limit-pages', type=int, default=None, help='Limit pages to inspect/ocr (default: all)')
    parser.add_argument('--analyze', action='store_true', default=True, help='Send extracted JSON to an LLM (Gemini) for analysis (default: enabled)')
    parser.add_argument('--gemini-endpoint', default='', help='LLM endpoint URL (can also be set via GEMINI_ENDPOINT env var)')
    parser.add_argument('--gemini-key', default='', help='API key for Gemini (can also be set via GEMINI_API_KEY env var)')
    args = parser.parse_args(argv)

    # Try to fill missing credentials from root users.db (latest user)
    def _fill_from_users_db(args_obj):
        try:
            import sqlite3
        except Exception:
            return args_obj  # sqlite3 should be stdlib, but be safe
        # Determine repo root relative to this file and expect DB at repo_root/users.db
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        db_path = os.path.join(repo_root, 'users.db')
        if not os.path.isfile(db_path):
            return args_obj

        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Order by rowid to get latest inserted user
            cur.execute('SELECT user_id, full_name, dob, mobile FROM users ORDER BY rowid DESC LIMIT 1')
            row = cur.fetchone()
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            return args_obj

        if not row:
            try:
                conn.close()
            except Exception:
                pass
            return args_obj

        user_id_db, full_name_db, dob_db, mobile_db = row

        # Try to fetch a bank for this user_id from user_banks table (latest entry)
        bank_db = None
        try:
            cur.execute('SELECT bank_name FROM user_banks WHERE user_id = ? ORDER BY id DESC LIMIT 1', (user_id_db,))
            brow = cur.fetchone()
            if brow:
                bank_db = brow[0]
        except Exception:
            # ignore and leave bank_db as None
            bank_db = None
        # Helper: normalize many common DOB formats into dd-mm-yyyy
        from datetime import datetime

        def _normalize_dob(dob_value):
            if not dob_value:
                return None
            dob_value = str(dob_value).strip()
            # If already in expected format, return as-is
            try:
                dt = datetime.strptime(dob_value, '%d-%m-%Y')
                return dt.strftime('%d-%m-%Y')
            except Exception:
                pass

            # Try common patterns
            candidates = [
                '%d/%m/%Y', '%Y-%m-%d', '%Y/%m/%d', '%d %b %Y', '%d %B %Y', '%d.%m.%Y', '%d %m %Y'
            ]
            for fmt in candidates:
                try:
                    dt = datetime.strptime(dob_value, fmt)
                    return dt.strftime('%d-%m-%Y')
                except Exception:
                    continue

            # As a last resort, try to parse YYYYMMDD or DDMMYYYY numeric strings
            cleaned = ''.join(ch for ch in dob_value if ch.isdigit())
            if len(cleaned) == 8:
                # try YYYYMMDD
                try:
                    dt = datetime.strptime(cleaned, '%Y%m%d')
                    return dt.strftime('%d-%m-%Y')
                except Exception:
                    pass
                # try DDMMYYYY
                try:
                    dt = datetime.strptime(cleaned, '%d%m%Y')
                    return dt.strftime('%d-%m-%Y')
                except Exception:
                    pass

            return None

        # Only fill fields that are currently empty or defaults
        if not args_obj.full_name:
            args_obj.full_name = full_name_db or args_obj.full_name
        if not args_obj.phone:
            args_obj.phone = mobile_db or args_obj.phone

        # Normalize DOB to dd-mm-yyyy. If normalization succeeds, write back to DB.
        norm_dob = None
        if dob_db:
            norm_dob = _normalize_dob(dob_db)
        # If CLI provided a dob, prefer that (but normalize it if possible)
        if args_obj.dob:
            cli_norm = _normalize_dob(args_obj.dob)
            if cli_norm:
                args_obj.dob = cli_norm
            # else leave as-is (validation will catch missing/invalid)
        else:
            if norm_dob:
                args_obj.dob = norm_dob
            else:
                # If DB had a value but we couldn't normalize, still use raw DB value
                args_obj.dob = dob_db or args_obj.dob

        # If DB DOB was normalized and differs from stored value, update DB to store dd-mm-yyyy
        try:
            if dob_db and norm_dob and norm_dob != str(dob_db).strip():
                try:
                    cur.execute('UPDATE users SET dob = ? WHERE user_id = ?', (norm_dob, user_id_db))
                    conn.commit()
                except Exception:
                    # not critical; continue without failing
                    pass
        except Exception:
            pass

        # If user provided no bank (or left default SBI) but db has a bank, prefer db value
        if (args_obj.bank in ('', 'SBI')) and bank_db:
            args_obj.bank = bank_db

        # expose the selected user_id and db_path on the args object for later use
        try:
            args_obj._user_id = user_id_db
            args_obj._db_path = db_path
        except Exception:
            pass

        try:
            conn.close()
        except Exception:
            pass

        return args_obj

    args = _fill_from_users_db(args)

    # Validate that we have the essential credentials now
    if not args.full_name or not args.phone or not args.dob:
        print('Error: missing required credentials. Provide --full-name/--phone/--dob or ensure users.db (repo root) has a user.')
        return

    # Build list of PDF paths from explicit args and/or a directory
    pdf_paths = list(args.pdf or [])
    if args.pdfs_dir:
        pdfs_dir = args.pdfs_dir
        if not os.path.isabs(pdfs_dir):
            # interpret relative to the repository root (folder above this package)
            repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
            pdfs_dir = os.path.join(repo_root, pdfs_dir)
        if not os.path.isdir(pdfs_dir):
            # Create directory if missing to support default behavior
            os.makedirs(pdfs_dir, exist_ok=True)
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

            # If we have a user_id from the DB and a discovered password, persist it
            try:
                user_id_to_update = getattr(args, '_user_id', None)
                db_path_to_use = getattr(args, '_db_path', None)
                # Normalize bank name to match storage (we store lower-case bank names elsewhere)
                bank_for_update = (args.bank or '').strip().lower()
                if password and user_id_to_update and db_path_to_use:
                    print(f"[debug] Persisting password for user_id={user_id_to_update} bank={bank_for_update} db={db_path_to_use}")
                    # ensure password column exists
                    try:
                        conn_up = sqlite3.connect(db_path_to_use)
                        cur_up = conn_up.cursor()
                        cur_up.execute("PRAGMA table_info('user_banks')")
                        cols = [r[1] for r in cur_up.fetchall()]
                        print(f"[debug] user_banks columns: {cols}")
                        if 'password' not in cols:
                            try:
                                cur_up.execute('ALTER TABLE user_banks ADD COLUMN password TEXT')
                                conn_up.commit()
                            except Exception:
                                # ignore migration failure
                                pass

                        # Upsert password for (user_id, bank_name).
                        # user_banks has UNIQUE(user_id, bank_name) so use ON CONFLICT to update.
                        try:
                            # Prefer standard UPSERT if available
                            cur_up.execute(
                                'INSERT INTO user_banks (user_id, bank_name, password) VALUES (?, ?, ?) '
                                'ON CONFLICT(user_id, bank_name) DO UPDATE SET password=excluded.password',
                                (user_id_to_update, bank_for_update, password)
                            )
                            print('[debug] Executed UPSERT with ON CONFLICT')
                        except Exception as e_upsert:
                            print(f"[debug] UPSERT failed: {e_upsert}; falling back to update/insert")
                            try:
                                cur_up.execute('UPDATE user_banks SET password = ? WHERE user_id = ? AND bank_name = ?', (password, user_id_to_update, bank_for_update))
                                if cur_up.rowcount == 0:
                                    cur_up.execute('INSERT OR IGNORE INTO user_banks (user_id, bank_name, password) VALUES (?, ?, ?)', (user_id_to_update, bank_for_update, password))
                                    print('[debug] Performed INSERT OR IGNORE fallback')
                                else:
                                    print('[debug] Performed UPDATE fallback (rows affected: ' + str(cur_up.rowcount) + ')')
                            except Exception as e_fallback:
                                print(f"[debug] Fallback update/insert failed: {e_fallback}")

                        conn_up.commit()
                        print('[debug] Committed password to user_banks')
                    except Exception:
                        pass
                    finally:
                        try:
                            conn_up.close()
                        except Exception:
                            pass
            except Exception:
                pass
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
