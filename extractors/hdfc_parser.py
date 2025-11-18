import re
from extractors.base_parser import BaseBankParser
from utils.clean_text import clean_text
from utils.regex_patterns import BANK_REGEX

class HDFCParser(BaseBankParser):
    def __init__(self):
        super().__init__("HDFC", BANK_REGEX.get("HDFC"))

    def clean(self, text: str) -> str:
        t = clean_text(text)
        t = re.sub(r"Page \d+ of \d+", "", t, flags=re.IGNORECASE)
        t = re.sub(r"HDFC\s*BANK\s*LIMITED", "", t, flags=re.IGNORECASE)
        # fix broken amount linewraps like "1,23\n4.00"
        t = re.sub(r"(\d),\s+(\d{2}\b)", r"\1\2", t)
        return t

    def extract_fields(self, text: str) -> dict:
        result = {}
        for key, pat in (self.patterns or {}).items():
            m = re.search(pat, text, flags=re.IGNORECASE)
            if not m:
                result[key] = None
                continue
            val = m.group(1)
            if isinstance(val, str) and re.match(r"^[\d,]+\.\d{2}$", val):
                val = val.replace(",", "")
            result[key] = val
        result["bank_name"] = "HDFC"
        return result

    def extract_transactions(self, text: str) -> list:
        # extract lines likely to be transactions (basic heuristics)
        lines = []
        pattern = r"(\d{1,2}\s+[A-Za-z]{3,}\s+.+?(?:INR|Rs\.?)\s*[\d,]+\.\d{2})"
        for m in re.findall(pattern, text, flags=re.IGNORECASE | re.DOTALL):
            lines.append(" ".join(m.split()))
        return lines
