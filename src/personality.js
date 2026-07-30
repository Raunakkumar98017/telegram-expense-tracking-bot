const { getAllExpenses, getBudget, getMonthSpend } = require('./expenses');
const { getChatCompletion } = require('./groq');

async function getFinancialPersonality(userId) {
    const expenses = await getAllExpenses(userId, 100);
    const budget = await getBudget(userId);
    const monthSpend = await getMonthSpend(userId);

    if (!expenses || expenses.length === 0) {
        return {
            title: "🌱 The Beginner",
            icon: "🌱",
            description: "You haven't logged enough transactions yet to determine your financial personality.",
            strength: "Clean slate and ready to build good financial habits.",
            weakness: "Limited spending history.",
            recommendation: "Log your daily expenses for at least a week to unlock your full profile!",
            formattedText: "🧠 *Financial Personality: 🌱 The Beginner*\n\nLog more expenses to calculate your profile!"
        };
    }

    const totalSpent = expenses.reduce((acc, r) => acc + r.amount, 0);
    const maxSingle = Math.max(...expenses.map(r => r.amount));
    
    // Calculate category distribution
    const catTotals = {};
    expenses.forEach(r => {
        catTotals[r.category] = (catTotals[r.category] || 0) + r.amount;
    });

    const foodSpend = (catTotals['Food'] || 0) + (catTotals['Groceries'] || 0) + (catTotals['Dining out'] || 0);
    const foodRatio = foodSpend / (totalSpent || 1);

    let title = "🎯 Balanced Planner";
    let icon = "🎯";
    let description = "You maintain steady control over your income and expenses with sensible spending choices.";
    let strength = "✔ Strong budget control and balanced category allocation.";
    let weakness = "✖ Occasional micro-leaks in routine daily purchases.";
    let recommendation = "Maintain your current budget and start setting aside 20% into automated savings.";

    const budgetPct = budget ? (monthSpend / budget) * 100 : 50;

    if (foodRatio > 0.45 || expenses.length > 25) {
        title = "🎉 Impulsive Shopper";
        icon = "🎉";
        description = "You love treating yourself! Frequent food orders and small impulse buys make up a big portion of your wallet.";
        strength = "✔ Enjoys life and values experiences & quick convenience.";
        weakness = "✖ High transaction frequency and impulse spending on delivery/dining.";
        recommendation = "Limit food delivery/outings to twice a week to save up to 30% monthly.";
    } else if (budgetPct > 90 || maxSingle > 3000) {
        title = "🦁 Big Spender";
        icon = "🦁";
        description = "You don't compromise on quality or big purchases. When you spend, you go big!";
        strength = "✔ Decisive buyer who invests in high-value products.";
        weakness = "✖ High risk of burning through monthly budget early.";
        recommendation = "Implement a 48-hour cool-off rule before making purchases over ₹2,000.";
    } else if (monthSpend < 1500 || (budget && budgetPct < 40)) {
        title = "🐢 Saver";
        icon = "🐢";
        description = "Highly cautious and disciplined with money. You prioritize security and low expenses.";
        strength = "✔ Outstanding spending discipline and high savings potential.";
        weakness = "✖ Might occasionally skip investing in self-growth or comfort.";
        recommendation = "Consider allocating a small 'fun budget' for rewards without guilt.";
    } else if (expenses.length > 10 && budgetPct <= 75) {
        title = "📈 Smart Investor";
        icon = "📈";
        description = "Data-driven and mindful. You track expenses diligently and maximize value for every rupee.";
        strength = "✔ Consistent tracking, low waste, and high financial awareness.";
        weakness = "✖ Over-analyzing minor purchases.";
        recommendation = "Automate mutual fund / SIP investments to compound your disciplined savings.";
    }

    const formattedText = 
        `🧠 *Financial Personality: ${icon} ${title}*\n\n` +
        `_${description}_\n\n` +
        `*Strength:* ${strength}\n` +
        `*Weakness:* ${weakness}\n\n` +
        `💡 *Recommendation:* ${recommendation}`;

    return {
        title,
        icon,
        description,
        strength,
        weakness,
        recommendation,
        formattedText,
        foodRatio: (foodRatio * 100).toFixed(1),
        totalSpent,
        transactionCount: expenses.length
    };
}

module.exports = { getFinancialPersonality };
