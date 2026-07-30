const { getChatCompletion } = require('./groq');

async function getPoetryRoast(userName, spendingData) {
    const systemPrompt = `
You are a witty "Shayar" financial advisor. 
TASK: Write a SHORT, RHYMING 2-line or 4-line Shayari in Hinglish (Hindi + English) about the user's spending.
TONE: Funny, relatable, slightly roasting but warm-hearted.
FORMAT: 
- Line 1 (Shayari)
- Line 2 (Shayari)
- (Optional Line 3 & 4)
- 💡 Advice: [One short line of real advice]

Constraints:
- Use rhyme (e.g., rhymes at end of lines).
- Max 60 words total.
- Use user's name and data.
`;

    const userPrompt = `
User name: ${userName}
Spending this week: ${spendingData}

If spend > ₹2000: Funny roast.
If spend ₹500-₹2000: Balanced advice.
If spend < ₹500: Grand praise.
`;

    const reply = await getChatCompletion(userPrompt, systemPrompt);
    if (reply) return reply;

    return `📊 *Spending Summary (Simple Mode)*\n\n${spendingData}\n\n💡 *Note:* AI Advisor currently in simple mode.`;
}

module.exports = { getPoetryRoast };
