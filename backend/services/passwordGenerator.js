const bankTemplates = {
    'default': [
        '{first4}{dob_ddmm}', '{first4upper}{year}', '{first4upper}{dob_ddmm}', '{first}{dob}', '{first}{dob_short}', '{first}{last}', '{first}{phone4}',
        '{last}{dob}', '{initials}{dob}', '{bank}{phone4}', '{bank}{dob_short}',
    ],
    'hdfc': ['{first}{dob}', '{first}{dob_short}', '{first}{phone4}'],
    'state bank of india': ['{phone5}{dob_ddmmyy}'],
    'icici': ['{first4}{dob_ddmm}', '{first}{dob}', '{initials}{phone4}', '{bank}{dob_short}'],
    'bank of baroda': ['{first4}{dob_ddmm}'],
};

function generatePasswordCandidates(fullName, phone, dob, bank, maxCandidates = 200) {
    fullName = (fullName || "").trim();
    phone = (phone || "").replace(/\D/g, "");
    dob = (dob || "").replace(/\D/g, "");
    bank = (bank || "").trim().toLowerCase();

    const parts = fullName.split(/\s+/);
    const first = parts[0] || "";
    const first4 = first.substring(0, 4);
    const first4upper = first4.toUpperCase();
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const initials = parts.map(p => p[0]).join("");

    const dobVariants = new Set();
    let year = "";
    let yearShort = "";

    if (dob) {
        // Assuming dob is digits only now
        if (dob.length >= 4) {
            year = dob.substring(dob.length - 4);
            yearShort = year.substring(2);
        }

        if (dob.length === 8) {
            // ddmmyyyy
            dobVariants.add(dob);
            // yyyymmdd
            dobVariants.add(dob.substring(4, 8) + dob.substring(2, 4) + dob.substring(0, 2));
            // yyymmdd? (kept from python logic)
            dobVariants.add(dob.substring(6, 8) + dob.substring(4, 6) + dob.substring(0, 4));
            dobVariants.add(year);
            dobVariants.add(yearShort);
        } else if (dob.length === 6) {
            dobVariants.add(dob);
            if (dob.length >= 4) dobVariants.add(dob.substring(dob.length - 4));
        } else {
            dobVariants.add(dob);
            if (year) dobVariants.add(year);
        }
    }

    const phoneSuffixes = new Set();
    let phone5 = "";
    if (phone) {
        if (phone.length >= 4) phoneSuffixes.add(phone.substring(phone.length - 4));
        if (phone.length >= 6) phoneSuffixes.add(phone.substring(phone.length - 6));
        phoneSuffixes.add(phone);
        if (phone.length >= 5) {
            phone5 = phone.substring(phone.length - 5);
            phoneSuffixes.add(phone5);
        }
    }

    const templates = bankTemplates[bank] || bankTemplates['default'];
    const candidates = [];

    let dob_ddmmyy = "";
    if (dob) {
        if (dob.length === 8) {
            dob_ddmmyy = dob.substring(0, 2) + dob.substring(2, 4) + dob.substring(6, 8);
        } else if (dob.length === 6) {
            dob_ddmmyy = dob;
        } else {
            dob_ddmmyy = dob.substring(dob.length - 6);
        }
    }

    let dob_ddmm = "";
    if (dob) {
        if (dob.length >= 4) {
            dob_ddmm = dob.substring(0, 2) + dob.substring(2, 4);
        } else {
            dob_ddmm = dob;
        }
    }

    const dobList = dobVariants.size > 0 ? Array.from(dobVariants).sort() : [""];
    const phoneList = phoneSuffixes.size > 0 ? Array.from(phoneSuffixes).sort() : [""];

    for (const t of templates) {
        for (const d of dobList) {
            for (const p of phoneList) {
                let s = t
                    .replace('{first}', first)
                    .replace('{first4}', first4)
                    .replace('{first4upper}', first4upper)
                    .replace('{last}', last)
                    .replace('{initials}', initials)
                    .replace('{dob}', d)
                    .replace('{dob_short}', d ? d.substring(d.length - 4) : '')
                    .replace('{phone4}', p ? p.substring(p.length - 4) : '')
                    .replace('{bank}', bank.toUpperCase())
                    .replace('{year}', year)
                    .replace('{dob_ddmmyy}', dob_ddmmyy)
                    .replace('{dob_ddmm}', dob_ddmm)
                    .replace('{phone5}', phone5);

                if (s) {
                    candidates.push(s);
                    candidates.push(s.toLowerCase());
                    candidates.push(s.toUpperCase());
                    // Capitalize first letter
                    candidates.push(s.charAt(0).toUpperCase() + s.slice(1));
                }
                if (candidates.length >= maxCandidates) break;
            }
            if (candidates.length >= maxCandidates) break;
        }
        if (candidates.length >= maxCandidates) break;
    }

    // Fallback
    const fallback = [
        first + last,
        first + (phone ? phone.substring(phone.length - 4) : ''),
        last + (dob ? dob.substring(dob.length - 4) : '')
    ];

    for (const f of fallback) {
        if (f) candidates.push(f);
    }

    // Unique
    return [...new Set(candidates)].slice(0, maxCandidates);
}

module.exports = { generatePasswordCandidates };
