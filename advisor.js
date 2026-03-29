const OpenAI = require('openai');
require('dotenv').config();

let client = null;
if (process.env.GROQ_API_KEY) {
    client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
    });
}

async function getPoetryRoast(userName, spendingData) {
    if (!client) {
        console.warn('⚠️ GROQ_API_KEY is missing. Skipping AI Advisor.');
        return `📊 *Spending Summary (Simple Mode)*\n\n${spendingData}\n\n💡 *Note:* AI Advisor is currently disabled. Please add GROQ_API_KEY to your environment.`;
    }

    const systemPrompt = `
You are a witty "Shayar" financial advisor. 
TASK: Write a SHORT, RHYMING 2-line or 4-line Shayari in Hinglish (Hindi + English) about the user's spending.
TONE: Funny, relatable, slightly roasting but warm-hearted.
FORMAT: 
- Line 1 (Shayari)
- Line 2 (Shayari)
- (Optional Line 3 & 4)
- (Spacer)
- 💡 Advice: [One short line of real advice]

Constraints:
- Use rhyme (e.g., rhymes at the end of lines).
- Max 60 words total.
- Do NOT provide a generic response. Use the user's name and data.
`;

    const userPrompt = `
User name: ${userName}
Spending this week: ${spendingData}

If spend > ₹2000: Funny roast.
If spend ₹500-₹2000: Balanced advice.
If spend < ₹500: Grand praise.
`;

    try {
        console.log(`🤖 Requesting Groq Shayari for ${userName}...`);
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.8,
            max_tokens: 150,
        });

        const text = completion.choices[0].message.content;
        if (text) return text;
    } catch (err) {
        console.error(`Groq error:`, err.message);
    }

    return `📊 *Spending Summary (Simple Mode)*\n\n${spendingData}\n\n💡 *Note:* AI Advisor is currently unavailable. Check your Groq API limits.`;
}

module.exports = { getPoetryRoast };
