#!/usr/bin/env python3
import sys
import json
import pikepdf

def unlock_pdf(pdf_path, passwords):
    # Try without password first
    try:
        with pikepdf.open(pdf_path):
            return {
                "success": True,
                "password": None,
                "decrypted_path": pdf_path
            }
    except pikepdf.PasswordError:
        pass  # it's encrypted

    # Try each password
    for pwd in passwords:
        try:
            with pikepdf.open(pdf_path, password=pwd) as pdf:
                out_path = pdf_path.replace(".pdf", "_unlocked.pdf")
                pdf.save(out_path)

                return {
                    "success": True,
                    "password": pwd,
                    "decrypted_path": out_path
                }
        except pikepdf.PasswordError:
            continue

    return {
        "success": False,
        "password": None,
        "decrypted_path": None
    }

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    passwords = sys.argv[2:]

    result = unlock_pdf(pdf_path, passwords)
    print(json.dumps(result))
