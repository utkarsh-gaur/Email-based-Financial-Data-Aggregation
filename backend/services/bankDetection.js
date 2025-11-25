const bankKeywords = {
    "hdfc bank": ["hdfc", "hdfcbank"],
    "state bank of india": ["sbi", "statebank"],
    "icici bank": ["icici"],
    "kotak mahindra bank": ["kotak"],
    "bank of baroda": ["bankofbaroda", "barodabank", "baroda"],
    "axis bank": ["axis"],
    "yes bank": ["yesbank"],
    "union bank of india": ["unionbank"],
    "punjab national bank": ["pnb", "punjabnationalbank"],
    "idfc first bank": ["idfc", "idfcbank", "idfcfirst"],
    "indusind bank": ["indusind"],
    "canara bank": ["canara"],
    "bank of india": ["boi", "bankofindia"],
    "central bank of india": ["centralbank", "central bank"],
    "indian bank": ["indianbank", "indian bank"],
    "indian overseas bank": ["iob", "overseas bank", "indianoverseas"],
    "allahabad bank": ["allahabad bank"],
    "rbl bank": ["rbl"],
    "standard chartered bank": ["standardchartered", "standard chartered", "scb"],
    "hsbc bank": ["hsbc"],
    "citibank": ["citi", "citibank"],
    "bandhan bank": ["bandhan"],
};

function getBankFromSubject(msg) {
    const headers = msg.payload.headers || [];
    let subject = "";
    let senderEmail = "";

    headers.forEach(h => {
        const name = h.name.toLowerCase();
        const value = h.value.toLowerCase();
        if (name === "subject") subject = value;
        else if (name === "from") senderEmail = value;
    });

    function matchBank(text) {
        if (!text) return null;
        for (const [bankName, keywords] of Object.entries(bankKeywords)) {
            for (const kw of keywords) {
                if (text.includes(kw)) {
                    return bankName;
                }
            }
        }
        return null;
    }

    let found = matchBank(subject);
    if (found) return found;

    found = matchBank(senderEmail);
    if (found) return found;

    const snippet = (msg.snippet || "").toLowerCase();
    found = matchBank(snippet);
    if (found) return found;

    return "UNKNOWN";
}

function getBankFromFilename(filename) {
    const lowerFilename = filename.toLowerCase();

    for (const [bankName, keywords] of Object.entries(bankKeywords)) {
        for (const kw of keywords) {
            if (lowerFilename.includes(kw)) {
                return bankName;
            }
        }
    }

    return "UNKNOWN";
}

module.exports = { getBankFromSubject, getBankFromFilename };
