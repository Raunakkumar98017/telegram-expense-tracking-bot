const OpenAI = require('openai');
require('dotenv').config();

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

async function getPoetryRoast(userName, spendingData) {
    const systemPrompt = `
You are a witty, fun, warm-hearted financial advisor who speaks in Hinglish (mix of Hindi and English).
You write short, funny and relatable Shayari or two-liners based on a user's spending habits.
`;

    const userPrompt = `
User name: ${userName}
Spending this week:
${spendingData}

If they spent a lot (total > ₹2000), gently roast them in a funny way.
If they spent reasonably (total ₹500-₹2000), give balanced advice.
If they spent very little (total < ₹500), praise them hilariously.

Respond ONLY with:
1. A 2-4 line Shayari or witty comment (in Hinglish)
2. One line of genuine financial advice

Keep it under 150 words. Be warm, funny, and encouraging.
`;

    try {
        console.log(`🤖 Requesting Groq advisor for ${userName}...`);
        const completion = await client.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        });

        const text = completion.choices[0].message.content;
        if (text) return text;
    } catch (err) {
        console.error(`Groq error:`, err.message);
    }

    // ABSOLUTE LAST RESORT: Simple Text Summary
    return `📊 *Spending Summary (Simple Mode)*\n\n${spendingData}\n\n💡 *Note:* AI Advisor is currently unavailable. Please check your Groq API limits.`;
}

module.exports = { getPoetryRoast };
