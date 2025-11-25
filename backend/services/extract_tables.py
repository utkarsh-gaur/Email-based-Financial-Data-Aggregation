#!/usr/bin/env python3
import sys
import json
import os
import csv
import pdfplumber

# Default output directory - temp_csv in project root
# This script is in backend/services/, so we go up two levels
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT_DIR = os.path.join(SCRIPT_DIR, '../../temp_csv')

def extract_tables_to_csv(pdf_path, output_dir=None):
    """
    Extract all tables from a PDF and combine them into a single CSV file.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save CSV file (defaults to temp_csv in project root)
    
    Returns:
        JSON with success status, table count, and CSV file path
    """
    try:
        # Use default temp_csv directory if not specified
        if output_dir is None:
            output_dir = DEFAULT_OUTPUT_DIR

        # Create output directory if it doesn't exist
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Get base filename without extension
        base_filename = os.path.splitext(os.path.basename(pdf_path))[0]
        
        # Single CSV filename
        csv_filename = f"{base_filename}.csv"
        csv_path = os.path.join(output_dir, csv_filename)
        
        total_tables = 0
        total_rows = 0
        all_tables_data = []
        
        # Open PDF and extract all tables
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                tables = page.extract_tables()
                
                if tables:
                    for table_num, table in enumerate(tables, start=1):
                        total_tables += 1
                        
                        # Add a header row to identify the table
                        if total_tables > 1:
                            # Add blank row as separator between tables
                            all_tables_data.append([])
                        
                        # Add metadata header
                        all_tables_data.append([f"=== Page {page_num}, Table {table_num} ==="])
                        
                        # Add the table data
                        for row in table:
                            all_tables_data.append(row)
                            total_rows += 1
        
        # Write combined CSV file
        if total_tables > 0:
            with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerows(all_tables_data)
        
        return {
            "success": True,
            "pdf_path": pdf_path,
            "total_tables": total_tables,
            "total_rows": total_rows,
            "csv_file": {
                "filename": csv_filename,
                "path": csv_path,
                "tables_combined": total_tables
            } if total_tables > 0 else None,
            "output_dir": output_dir
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "pdf_path": pdf_path,
            "total_tables": 0,
            "total_rows": 0,
            "csv_file": None
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python extract_tables.py <pdf_path> [output_dir]"
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = extract_tables_to_csv(pdf_path, output_dir)
    print(json.dumps(result, indent=2))
