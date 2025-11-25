const { google } = require('googleapis');
const axios = require('axios');

async function analyzeWithGemini(consolidatedData, apiKey) {
    // consolidatedData is an object: { documents: [ { path, text, ... } ] }

    const prompt = `
You are a financial-data analyst. Analyze the following bank-statement data (JSON).
Return a JSON object with these keys:
- \`summary\`: short text summary (1-3 sentences)
- \`monthly_spend_by_category\`: map of category -> monthly average and total
- \`top_merchants\`: list of top 5 merchants by spend with counts
- \`recurring_payments\`: list of likely recurring payments with cadence and average amount
- \`anomalies\`: list of suspicious or one-off transactions worth reviewing
- \`suggestions\`: actionable tips to improve savings / reduce spending
Keep numeric values as numbers and dates in ISO format if present. Use brief explanations.

DATA:
${JSON.stringify(consolidatedData, null, 2).substring(0, 30000)} 

Respond only with the requested JSON object.
`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await axios.post(endpoint, {
            contents: [{
                parts: [{ text: prompt }]
            }]
        });

        const candidate = response.data.candidates[0];
        const text = candidate.content.parts[0].text;

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini Analysis Error", error.response ? error.response.data : error.message);
        throw new Error("Analysis failed");
    }
}

module.exports = { analyzeWithGemini };
