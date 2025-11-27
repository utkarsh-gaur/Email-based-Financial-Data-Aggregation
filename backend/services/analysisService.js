const { google } = require('googleapis');
const axios = require('axios');

async function analyzeWithGemini(consolidatedData, apiKey) {
  // consolidatedData is an object: { documents: [ { path, text, ... } ] }

  const prompt = `
You are a financial advisor AI analyzing bank statement data to generate personalized, actionable nudges for users. Your goal is to identify opportunities where the user can save money, earn better returns, or consolidate their financial activities on our platform.
Analyze the following bank statement data and generate smart nudges based on these categories:
## INPUT DATA:
${JSON.stringify(consolidatedData, null, 2)}
## NUDGE CATEGORIES TO ANALYZE:
### 1. RECURRING PAYMENTS & SUBSCRIPTIONS
- Identify: Netflix, Amazon Prime, Spotify, Jio, Airtel, DTH recharges, gym memberships, etc.
- Look for: Monthly/yearly patterns, auto-debits, UPI subscriptions
- Nudge: "We noticed you pay ₹X for [service]. Get it on our app with Y% cashback!"
### 2. LOAN OPPORTUNITIES
- Identify: Existing EMIs, loan payments, credit card bills
- Calculate: Total monthly EMI burden, interest rates (if visible)
- Nudge: "Paying ₹X/month in EMIs? Refinance with us at Z% lower interest and save ₹Y annually!"
### 3. INVESTMENT OPPORTUNITIES
- Identify: Idle balance patterns, salary credits, consistent savings
- Calculate: Average monthly balance, money lying idle for 30+ days
- Nudge Options:
  - "₹X lying idle? Invest in Digital Gold and earn Y% returns"
  - "Start SIP with ₹X/month based on your savings pattern"
  - "Your average balance is ₹X. Invest ₹Y in mutual funds for better returns"
### 4. LOW BALANCE ALERTS & LOAN OFFERS
- Identify: Balance dropping below ₹5000, frequent overdrafts
- Nudge: "Balance running low? Get instant personal loan up to ₹X at Y% interest"
### 5. BILL PAYMENT CONSOLIDATION
- Identify: Electricity, water, gas, mobile recharge, broadband bills
- Look for: Multiple payment platforms (Paytm, PhonePe, Google Pay)
- Nudge: "Pay all bills on our app and earn ₹X cashback monthly"
### 6. CREDIT CARD OPTIMIZATION
- Identify: Credit card payments, interest charges, late fees
- Nudge: "Paying ₹X in credit card interest? Switch to our app for card payments with cashback upto 5% "
### 7. INSURANCE OPPORTUNITIES
- Identify: Insurance premium payments (LIC, health, vehicle)
- Nudge: "Renewing insurance? Compare and save up to Y% with our partners"
### 8. MERCHANT-SPECIFIC OFFERS
- Identify: Frequent spending at Swiggy, Zomato, Amazon, Flipkart
- Nudge: "You spend ₹X on food delivery. Use our app and get Y% cashback"
### 9. SALARY ACCOUNT BENEFITS
- Identify: Salary credits, employer name
- Nudge: "Open salary account with us and get zero-balance banking + ₹X welcome bonus"
### 10. EXPIRING SUBSCRIPTIONS
- Identify: Annual subscriptions nearing renewal date
- Nudge: "Your [service] subscription expires on [date]. Renew via our app and save Y%"
- Monthly Income Determination Logic: 
    Check the credit transactions and keep an eye on any credits that are recurring and are consistent. Most likely it will be credited in the first 10 days of the month or the last day of the month.
    label that as the monthly income.
## OUTPUT FORMAT:
Return ONLY valid JSON with this structure:
{
  "user_profile": {
    "monthly_income": 0.00,
    "average_balance": 0.00,
    "spending_pattern": "high/medium/low",
    "financial_health_score": 0-100
  },
  "insights": {
    "total_recurring_payments": 0.00,
    "total_emi_burden": 0.00,
    "idle_money": 0.00,
    "top_spending_categories": ["category1", "category2"]
  },
  "nudges": [
    {
      "id": "unique_id",
      "category": "recurring_payment|loan|investment|bill_payment|credit_card|insurance|low_balance|subscription|merchant_offer|salary_account",
      "priority": "high|medium|low",
      "title": "Short catchy title",
      "message": "Detailed nudge message",
      "cta": "Call to action button text",
      "potential_savings": 0.00,
      "data": {
        "current_amount": 0.00,
        "frequency": "monthly|yearly|one-time",
        "merchant": "merchant_name",
        "next_due_date": "YYYY-MM-DD (if applicable)"
      }
    }
  ]
}
## RULES:
1. Generate 5-10 most relevant nudges based on actual transaction data
2. Prioritize nudges with highest potential savings/value
3. Be specific with amounts and dates from the statement
4. Only suggest nudges where you have clear evidence from transactions
5. Calculate potential savings realistically
6. Use Indian Rupee (₹) for all amounts
7. Make CTAs action-oriented and compelling
8. Ensure all dates are in YYYY-MM-DD format
9. Return ONLY the JSON, no markdown or explanations
## EXAMPLES OF GOOD NUDGES:
**Recurring Payment:**
{
  "category": "recurring_payment",
  "priority": "high",
  "title": "Save ₹500/year on Netflix",
  "message": "We noticed you pay ₹649/month for Netflix Premium. Subscribe through our app and get 5% cashback (₹389 annual savings)!",
  "cta": "Get Cashback Now",
  "potential_savings": 389.40,
  "data": {
    "current_amount": 649.00,
    "frequency": "monthly",
    "merchant": "Netflix"
  }
}
**Investment:**
{
  "category": "investment",
  "priority": "high",
  "title": "₹45,000 earning 0% returns",
  "message": "Your average balance is ₹45,000. Invest ₹30,000 in Digital Gold and earn ~8% annual returns (₹2,400/year).",
  "cta": "Start Investing",
  "potential_savings": 2400.00,
  "data": {
    "current_amount": 45000.00,
    "frequency": "one-time"
  }
}
**Loan Refinance:**
{
  "category": "loan",
  "priority": "high",
  "title": "Save ₹24,000 on your home loan",
  "message": "You're paying ₹18,500/month in EMI. Refinance with us at 8.5% (vs current ~9.5%) and save ₹2,000/month!",
  "cta": "Check Eligibility",
  "potential_savings": 24000.00,
  "data": {
    "current_amount": 18500.00,
    "frequency": "monthly",
    "merchant": "HDFC Bank"
  }
}
**Low Balance:**
{
  "category": "low_balance",
  "priority": "medium",
  "title": "Need funds? Get instant loan",
  "message": "Your balance dropped to ₹2,450 on 15th Nov. Get instant personal loan up to ₹2,00,000 at 12% interest.",
  "cta": "Apply Now",
  "potential_savings": 0,
  "data": {
    "current_amount": 2450.00,
    "frequency": "one-time"
  }
}
**Bill Payment:**
{
  "category": "bill_payment",
  "priority": "medium",
  "title": "Consolidate bills, earn ₹200/month",
  "message": "You pay electricity (₹1,200), Jio (₹599), and DTH (₹450) across different apps. Pay all on our app and earn ₹200 cashback monthly!",
  "cta": "Pay Bills Here",
  "potential_savings": 2400.00,
  "data": {
    "current_amount": 2249.00,
    "frequency": "monthly"
  }
}
Now analyze the provided bank statement data and generate personalized nudges.
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
