import re
from typing import List


def generate_password_candidates(full_name: str, phone: str, dob: str, bank: str, max_candidates: int = 200) -> List[str]:
    """Generate likely password candidates from provided credentials.

    See `bank_pdf.cli` README for supported template placeholders.
    """
    full_name = (full_name or "").strip()
    phone = re.sub(r"\D", "", (phone or ""))
    dob = re.sub(r"\D", "", (dob or ""))
    bank = (bank or "").strip().lower()

    parts = full_name.split()
    first = parts[0] if parts else ""
    first4 = parts[0][:4] if parts else ""
    last = parts[-1] if len(parts) > 1 else ""
    initials = ''.join([p[0] for p in parts]) if parts else ""

    dob_variants = set()
    if dob:
        if len(dob) == 8:
            dob_variants.update([dob, dob[4:8]+dob[2:4]+dob[0:2], dob[6:8]+dob[4:6]+dob[0:4]])
        elif len(dob) == 6:
            dob_variants.add(dob)
        else:
            dob_variants.add(dob)

    phone_suffixes = set()
    phone5 = ''
    if phone:
        phone_suffixes.add(phone[-4:])
        phone_suffixes.add(phone[-6:])
        phone_suffixes.add(phone)
        phone5 = phone[-5:]
        phone_suffixes.add(phone5)

    bank_templates = {
        'default': [
            '{first}{dob}', '{first}{dob_short}', '{first}{last}', '{first}{phone4}',
            '{last}{dob}', '{initials}{dob}', '{bank}{phone4}', '{bank}{dob_short}',
        ],
        'hdfc': ['{first}{dob}', '{first}{dob_short}', '{first}{phone4}'],
        'state bank of india': ['{phone5}{dob_ddmmyy}'],
        'icici': ['{first4}{dob_ddmm}', '{first}{dob}', '{initials}{phone4}', '{bank}{dob_short}'],
        'bank of baroda': ['{first4}{dob_ddmm}'],
    }

    templates = bank_templates.get(bank, bank_templates['default'])

    candidates = []
    dob_ddmmyy = ''
    if dob:
        if len(dob) == 8:
            dob_ddmmyy = dob[0:2] + dob[2:4] + dob[6:8]
        elif len(dob) == 6:
            dob_ddmmyy = dob
        else:
            dob_ddmmyy = dob[-6:]

    # ddmm (day+month) variant for templates that need only day+month
    dob_ddmm = ''
    if dob:
        if len(dob) >= 4:
            dob_ddmm = dob[0:2] + dob[2:4]
        else:
            dob_ddmm = dob

    for t in templates:
        for d in (sorted(dob_variants) if dob_variants else [""]):
            for p in (sorted(phone_suffixes) if phone_suffixes else [""]):
                s = t.format(
                    first=first, first4=first4, last=last, initials=initials,
                    dob=d, dob_short=d[-4:] if d else '', phone4=p[-4:] if p else '', bank=bank.upper(),
                    dob_ddmmyy=dob_ddmmyy, dob_ddmm=dob_ddmm, phone5=phone5)
                if s:
                    candidates.append(s)
                if s:
                    candidates.append(s.lower())
                    candidates.append(s.upper())
                    candidates.append(s.capitalize())
                if len(candidates) >= max_candidates:
                    return list(dict.fromkeys(candidates))

    fallback = [first + last, first + phone[-4:] if phone else '', last + dob[-4:] if dob else '']
    for f in fallback:
        if f:
            candidates.append(f)

    seen = set()
    out = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out[:max_candidates]
