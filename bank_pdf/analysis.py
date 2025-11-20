import json
from typing import Any, Dict, Optional

import requests


def format_analysis_prompt(extracted: Dict[str, Any]) -> str:
    """Create a concise prompt to ask Gemini to analyze expenditure patterns.

    The prompt instructs the model to return structured JSON containing
    summary statistics, category spend, recurring payments, anomalies, and suggestions.
    """
    header = (
        "You are a financial-data analyst. Analyze the following bank-statement data (JSON). "
        "Return a JSON object with these keys: \n"
        "- `summary`: short text summary (1-3 sentences)\n"
        "- `monthly_spend_by_category`: map of category -> monthly average and total\n"
        "- `top_merchants`: list of top 5 merchants by spend with counts\n"
        "- `recurring_payments`: list of likely recurring payments with cadence and average amount\n"
        "- `anomalies`: list of suspicious or one-off transactions worth reviewing\n"
        "- `suggestions`: actionable tips to improve savings / reduce spending\n"
        "Keep numeric values as numbers and dates in ISO format if present. Use brief explanations.\n\n"
        "Give structured clean json which is pretty printed and easy to read."
    )

    # Include the extracted JSON, but keep it reasonably sized. We'll stringify it.
    try:
        payload_str = json.dumps(extracted, ensure_ascii=False)
    except Exception:
        payload_str = str(extracted)

    prompt = header + "DATA:\n" + payload_str + "\n\nRespond only with the requested JSON object."
    return prompt


def analyze_with_gemini(prompt: str, endpoint: str, api_key: str, timeout: int = 60) -> Dict[str, Any]:
    """Send the prompt to a Gemini-compatible REST endpoint.

    This function uses a simple generic REST contract: POST JSON {"prompt": <prompt>} with
    `Authorization: Bearer <api_key>`. Many hosted LLM HTTP APIs accept this pattern. If your
    provider uses a different contract, you can adapt `data` and headers accordingly.
    """
    # Special-case Google Generative Language API endpoint which accepts an API key as a query param
    if 'generativelanguage.googleapis.com' in endpoint:
        params = {'key': api_key}
        # Use the v1 `generateContent` request shape as provided by the user example.
        # Payload shape:
        # {"contents":[{"role":"user","parts":[{"text":"..."}]}]}
        body = {
            'contents': [
                {
                    'role': 'user',
                    'parts': [
                        {'text': prompt}
                    ]
                }
            ]
        }
        resp = requests.post(endpoint, params=params, json=body, timeout=timeout)
        resp.raise_for_status()
        try:
            return resp.json()
        except Exception:
            return {'raw_text': resp.text}

    # Generic LLM endpoints: try Bearer auth with a simple prompt contract
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    data = {'prompt': prompt, 'max_tokens': 1000}

    resp = requests.post(endpoint, headers=headers, json=data, timeout=timeout)
    resp.raise_for_status()

    try:
        return resp.json()
    except Exception:
        return {'raw_text': resp.text}


def parse_model_response(resp: Dict[str, Any]) -> Dict[str, Any]:
    """Attempt to extract JSON from a model response. This is heuristic.

    Many APIs return a top-level `output` or `choices` field — we try a few common patterns,
    and fall back to attempting to parse the entire `raw_text` as JSON.
    """
    # common shapes
    if 'json' in resp and isinstance(resp['json'], dict):
        return resp['json']

    # OpenAI-like: choices -> [ { text | message: { content } } ]
    if 'choices' in resp and isinstance(resp['choices'], list) and resp['choices']:
        first = resp['choices'][0]
        text = first.get('text') or (first.get('message') or {}).get('content')
        if text:
            try:
                return json.loads(text)
            except Exception:
                return {'text': text}

    # Google Generative Language: candidates -> [ { output: '...' } ]
    if 'candidates' in resp and isinstance(resp['candidates'], list) and resp['candidates']:
        first = resp['candidates'][0]
        # Google generateContent may return `content` as a list of parts; join any text parts.
        text = None
        if isinstance(first.get('content'), list):
            parts = []
            for part in first.get('content'):
                if isinstance(part, dict):
                    # common key names are 'text' or 'type'/'text'
                    if 'text' in part:
                        parts.append(part.get('text'))
                    elif 'type' in part and part.get('type') == 'output_text' and 'text' in part:
                        parts.append(part.get('text'))
            if parts:
                text = '\n'.join(parts)
        if not text:
            text = first.get('output') or first.get('text') or (first.get('content') if isinstance(first.get('content'), str) else None)
        if text:
            try:
                return json.loads(text)
            except Exception:
                return {'text': text}

    # generic single text field
    for key in ('output', 'response', 'result'):
        if key in resp and isinstance(resp[key], str):
            try:
                return json.loads(resp[key])
            except Exception:
                return {key: resp[key]}

    # fallback: try to parse raw_text
    if 'raw_text' in resp and isinstance(resp['raw_text'], str):
        try:
            return json.loads(resp['raw_text'])
        except Exception:
            return {'raw_text': resp['raw_text']}

    # last resort
    return resp
