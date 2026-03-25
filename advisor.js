const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getPoetryRoast(userName, spendingData) {
    const prompt = `
You are a witty, fun, warm-hearted financial advisor who speaks in Hinglish (mix of Hindi and English).
You write short, funny and relatable Shayari or two-liners based on a user's spending habits.

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

    const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-pro'];
    let lastError = '';

    for (const modelName of modelsToTry) {
        try {
            console.log(`🤖 Attempting Gemini model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            if (text) return text;
        } catch (err) {
            console.error(`Gemini error (${modelName}):`, err.message);
            lastError = err.message;
        }
    }

    return `🤖 AI advisor is taking a chai break.\n\n*Last error details:* \`${lastError}\`\n\n💡 *Tip:* Check if "Generative Language API" is enabled in your Google Cloud Console.`;
}

module.exports = { getPoetryRoast };
