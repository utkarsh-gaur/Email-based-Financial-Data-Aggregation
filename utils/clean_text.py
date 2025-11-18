import re

def clean_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    text = raw_text

    # normalize whitespace and newlines
    text = text.replace("\r", "\n")
    text = re.sub(r"\n+", "\n", text)
    text = re.sub(r"\t+", " ", text)
    text = re.sub(r"[ \u00A0]{2,}", " ", text)  # multiple spaces
    text = text.strip()

    # normalize dashes, currency signs
    text = text.replace("–", "-").replace("—", "-")
    text = text.replace("₹", "INR")
    return text
