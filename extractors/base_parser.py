class BaseBankParser:
    def __init__(self, bank_name, patterns):
        self.bank = bank_name
        self.patterns = patterns or {}

    def clean(self, text: str) -> str:
        """Override for bank-specific cleaning; default returns text"""
        return text

    def extract_fields(self, text: str) -> dict:
        """Override: extract static fields"""
        raise NotImplementedError

    def extract_transactions(self, text: str) -> list:
        """Override: return raw transaction lines (strings)"""
        raise NotImplementedError

    def parse(self, raw_text: str) -> dict:
        cleaned = self.clean(raw_text)
        fields = self.extract_fields(cleaned)
        transactions = self.extract_transactions(cleaned)
        return {
            "bank": self.bank,
            "static": fields,
            "transactions_raw": transactions
        }
