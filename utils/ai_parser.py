# ai/ai_parser.py
"""
Gemini 2.5 Flash integration wrapper.
This file returns parsed JSON (dict). Customize prompt to tune extraction.
"""
import os
import json
from dotenv import load_dotenv

load_dotenv()

# Use google genai SDK or your wrapper
# Here is a placeholder pattern — update with the actual client you use.
try:
    from google import genai
    genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", ""))
except Exception:
    genai_client = None

def parse_with_ai(cleaned_text: str, bank: str = None) -> dict:
    """
    Sends prompt to Gemini and returns parsed dict.
    The prompt requests JSON only.
    """
    prompt = f"""
You are a highly-accurate financial statement parser. Input is cleaned bank statement text.
Bank: {bank or 'UNKNOWN'}
Text:
{cleaned_text}

Return ONLY valid JSON with keys:
- account_number
- account_holder
- bank_name
- statement_period
- opening_balance
- closing_balance
- total_credits
- total_debits
- transactions (array of {{date, description, amount, type}})
- insights (array of short strings)

If any value is missing, use null or empty array.
"""
    if genai_client is None:
        # local fallback: return empty structured skeleton
        return {
            "account_number": None,
            "account_holder": None,
            "bank_name": bank,
            "statement_period": None,
            "opening_balance": None,
            "closing_balance": None,
            "total_credits": None,
            "total_debits": None,
            "transactions": [],
            "insights": []
        }

    # call Gemini (pseudo-code — adapt to your installed SDK)
    try:
        response = genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text if hasattr(response, "text") else str(response)
        # parse JSON from model output
        # attempt to find first JSON object
        start = text.find("{")
        end = text.rfind("}") + 1
        json_text = text[start:end] if start != -1 and end != -1 else "{}"
        parsed = json.loads(json_text)
        return parsed
    except Exception:
        return {
            "account_number": None,
            "account_holder": None,
            "bank_name": bank,
            "statement_period": None,
            "opening_balance": None,
            "closing_balance": None,
            "total_credits": None,
            "total_debits": None,
            "transactions": [],
            "insights": []
        }


