import re
from extractors.base_parser import BaseBankParser
from utils.clean_text import clean_text
from utils.regex_patterns import BANK_REGEX

class CanaraParser(BaseBankParser):
    def __init__(self):
        super().__init__("CANARA", BANK_REGEX.get("CANARA"))

    def clean(self, text: str) -> str:
        t = clean_text(text)
        t = re.sub(r"CANARA\s*BANK", "", t, flags=re.IGNORECASE)
        return t

    def extract_fields(self, text: str) -> dict:
        result = {}
        for key, pat in (self.patterns or {}).items():
            m = re.search(pat, text, flags=re.IGNORECASE)
            result[key] = None if not m else (m.group(1).replace(",", "") if re.match(r"^[\d,]+\.\d{2}$", m.group(1)) else m.group(1))
        result["bank_name"] = "CANARA"
        return result

    def extract_transactions(self, text: str) -> list:
        lines = []
        pattern = r"(\d{1,2}\s+[A-Za-z]{3}\s+.*?(?:INR|Rs\.)\s*[\d,]+\.\d{2})"
        for m in re.findall(pattern, text, flags=re.IGNORECASE | re.DOTALL):
            lines.append(" ".join(m.split()))
        return lines
