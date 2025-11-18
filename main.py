from fastapi import FastAPI, UploadFile, File, Form
from processors.statement_processor import StatementProcessor
from typing import Optional
import json

app = FastAPI(title="Email Statement Parser (Hybrid)")

# Example: create a processor with user info (in real app pass per-user)
DEFAULT_USER_INFO = {
    "name": "AKSHAT SHARMA",
    "dob": "17011999",
    "mobile": "9876543210",
    "pan": "ABCDE1234F",
    "acc_last4": "1234"
}

processor = StatementProcessor(DEFAULT_USER_INFO)


@app.post("/parse-statement")
async def parse_statement(
    file: UploadFile = File(...),
    email_subject: Optional[str] = Form(None),
    email_sender: Optional[str] = Form(None),
):
    """
    Upload a PDF file and optional email subject/sender. Returns merged parsed output.
    """
    content = await file.read()
    result = processor.process(pdf_bytes=content, email_subject=email_subject, email_sender=email_sender)
    return result
