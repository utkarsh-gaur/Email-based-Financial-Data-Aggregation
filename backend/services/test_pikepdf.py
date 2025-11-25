#!/usr/bin/env python3
"""
Quick test script to verify pikepdf can unlock the PDFs
"""
import sys
import os
import pikepdf

def test_unlock():
    # Find first PDF in temp_pdfs
    temp_dir = os.path.join(os.path.dirname(__file__), '../../temp_pdfs')
    pdfs = [f for f in os.listdir(temp_dir) if f.lower().endswith('.pdf')]
    
    if not pdfs:
        print("No PDFs found in temp_pdfs")
        return
    
    pdf_path = os.path.join(temp_dir, pdfs[0])
    print(f"Testing PDF: {pdfs[0]}")
    
    # Test 1: Try without password
    print("\n--- Test 1: No password ---")
    try:
        with pikepdf.open(pdf_path):
            print("[OK] PDF is not encrypted")
            return
    except pikepdf.PasswordError:
        print("[X] PDF is password protected")
    
    # Test 2: Try with password
    print("\n--- Test 2: With password ---")
    password = sys.argv[1] if len(sys.argv) > 1 else "71636200698"
    print(f'Trying password: "{password}"')
    
    try:
        with pikepdf.open(pdf_path, password=password) as pdf:
            print("[OK] Successfully unlocked PDF with pikepdf!")
            print(f"  Pages: {len(pdf.pages)}")
            
            # Test saving
            out_path = pdf_path.replace('.pdf', '_test_unlocked.pdf')
            pdf.save(out_path)
            print(f"[OK] Saved unlocked PDF to: {out_path}")
            
            # Clean up test file
            os.remove(out_path)
            print("[OK] Test complete!")
            
    except pikepdf.PasswordError:
        print("[X] Wrong password")
    except Exception as e:
        print(f"[X] Error: {e}")

if __name__ == "__main__":
    test_unlock()
