# processors/statement_processor.py
from gmail.bank_rules import detect_bank
from extractors.parser_router import get_parser
from gmail.pdf_processor import extract_text_from_pdf_bytes
from utils.clean_text import clean_text
from ai.ai_parser import parse_with_ai
from models.statement import ParsedStatement, AIStructuredStatement, RuleBasedExtraction
import traceback

class StatementProcessor:
    def __init__(self, user_info: dict):
        self.user_info = user_info

    def process(self, pdf_bytes: bytes, email_subject: str = None, email_sender: str = None):
        """
        Full pipeline:
         - detect bank via subject/sender
         - try bank password generation (optional) - skipped here (you can add)
         - extract text from PDF
         - run bank static parser
         - run AI parser
         - merge rule + ai outputs (rule fields override AI numerics)
        """
        try:
            bank = detect_bank(email_sender, email_subject)
            # fallback: try subject then sender
            if not bank:
                bank = detect_bank(email_sender, email_subject)
            # extract raw text trying no password first (you can add password logic)
            raw_text = extract_text_from_pdf_bytes(pdf_bytes, password=None)
            if not raw_text:
                # if empty, return error structure
                return {"error": "Unable to extract text from PDF (maybe encrypted)"}

            cleaned = clean_text(raw_text)

            # get parser and extract static fields
            parser = get_parser(bank)
            if parser:
                parsed_static = parser.parse(cleaned)
                static_fields = parsed_static.get("static", {})
                txns_raw = parsed_static.get("transactions_raw", [])
            else:
                static_fields = {}
                txns_raw = []

            # AI parse
            ai_parsed = parse_with_ai(cleaned, bank=bank)

            # merge logic: rule-based numeric fields override AI's numeric fields
            merged_ai = ai_parsed or {}
            # coerce numeric string values
            def to_float_safe(v):
                if v is None:
                    return None
                try:
                    if isinstance(v, str):
                        return float(v.replace(",", "").strip())
                    return float(v)
                except Exception:
                    return None

            # create final models (simple dict output)
            rule_obj = {
                "bank_name": static_fields.get("bank_name") or bank,
                "account_number": static_fields.get("account_number"),
                "opening_balance": to_float_safe(static_fields.get("opening_balance")),
                "closing_balance": to_float_safe(static_fields.get("closing_balance")),
                "ifsc": static_fields.get("ifsc"),
                "available_balance": to_float_safe(static_fields.get("available_balance")),
                "statement_period": static_fields.get("statement_period")
            }

            ai_obj = {
                "account_number": merged_ai.get("account_number"),
                "account_holder": merged_ai.get("account_holder"),
                "bank_name": merged_ai.get("bank_name") or bank,
                "statement_period": merged_ai.get("statement_period"),
                "opening_balance": to_float_safe(merged_ai.get("opening_balance")),
                "closing_balance": to_float_safe(merged_ai.get("closing_balance")),
                "total_credits": to_float_safe(merged_ai.get("total_credits")),
                "total_debits": to_float_safe(merged_ai.get("total_debits")),
                "transactions": merged_ai.get("transactions") or [],
                "insights": merged_ai.get("insights") or []
            }

            # override numeric fields with rule-based if available
            if rule_obj["opening_balance"] is not None:
                ai_obj["opening_balance"] = rule_obj["opening_balance"]
            if rule_obj["closing_balance"] is not None:
                ai_obj["closing_balance"] = rule_obj["closing_balance"]

            # Build final response dict (not pydantic model to keep simple)
            final = {
                "bank_detected": bank,
                "rule_based_data": rule_obj,
                "ai_structured_data": ai_obj,
                "cleaned_text": cleaned,
                "transactions_raw": txns_raw
            }
            return final
        except Exception as e:
            traceback.print_exc()
            return {"error": str(e)}
