const { getAllExpenses, getBudget, getMonthSpend, getDailyExpensesMap, getWeeklySummaryText } = require('./expenses');
const { getChatCompletion } = require('./groq');

/**
 * Generates visual Spending Heatmap (7-day & Monthly) using color emojis
 */
async function generateSpendingHeatmap(userId) {
    const dailyMap = await getDailyExpensesMap(userId, 30);
    const now = new Date();
    
    // Days of the week heatmap (Last 7 days)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let weekText = "📅 *Weekly Heatmap (Last 7 Days)*\n";
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = dayNames[d.getDay()];
        const amt = dailyMap[dateStr] || 0;

        let emoji = '🟩';
        if (amt > 500) emoji = '🟥';
        else if (amt >= 200) emoji = '🟨';

        weekText += `${dayName}: ${emoji} (₹${amt.toFixed(0)})\n`;
    }

    // Monthly Grid Heatmap
    let monthGrid = "\n🗓️ *30-Day Heatmap Grid*\n";
    let count = 0;
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const amt = dailyMap[dateStr] || 0;

        let emoji = '🟩';
        if (amt > 500) emoji = '🟥';
        else if (amt >= 200) emoji = '🟨';

        monthGrid += emoji;
        count++;
        if (count % 7 === 0) monthGrid += '\n';
    }

    const legend = "\n\n*Legend:*\n🟩 < ₹200  |  🟨 ₹200–500  |  🟥 > ₹500";
    
    return {
        formattedText: weekText + monthGrid + legend,
        dailyMap
    };
}

/**
 * Generates Weekly AI Finance Report
 */
async function generateWeeklyReport(userId) {
    const expenses = await getAllExpenses(userId, 100);
    const budget = await getBudget(userId) || 5000;
    const monthSpend = await getMonthSpend(userId);

    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStartDate = new Date(now.setDate(diff)).toISOString().split('T')[0];

    const weekExpenses = expenses.filter(e => e.date >= weekStartDate);
    const weekTotal = weekExpenses.reduce((acc, r) => acc + r.amount, 0);

    const catMap = {};
    let topExpense = { amount: 0, description: 'None' };

    weekExpenses.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + e.amount;
        if (e.amount > topExpense.amount) {
            topExpense = { amount: e.amount, description: e.description || e.category };
        }
    });

    const sortedCats = Object.entries(catMap).sort((a,b) => b[1] - a[1]);
    const highestCategory = sortedCats.length > 0 ? sortedCats[0][0] : 'None';
    const lowestCategory = sortedCats.length > 0 ? sortedCats[sortedCats.length - 1][0] : 'None';

    const budgetPct = Math.round((monthSpend / budget) * 100);
    const burnRateStatus = budgetPct > 90 ? '🔥 Critical' : (budgetPct > 70 ? '⚠️ High' : '🟩 Healthy');

    // Get AI Advice from Groq
    const weekSummaryText = await getWeeklySummaryText(userId);
    const aiAdvicePrompt = `Given the user spent ₹${weekTotal.toFixed(0)} this week (highest category: ${highestCategory}, top expense: ${topExpense.description}), write a witty 2-line financial advice in Hinglish with a joke or rhyme. Max 35 words total.`;
    
    let aiAdvice = await getChatCompletion(aiAdvicePrompt);
    if (!aiAdvice) {
        aiAdvice = "Keep tracking your daily expenses and try to minimize weekend impulse buys! 💡";
    }

    const reportText = 
        `📊 *Weekly Finance Report*\n\n` +
        `💰 *Spent:* ₹${weekTotal.toFixed(2)}\n` +
        `📉 *Budget Used:* ${budgetPct}%\n` +
        `🍕 *Highest Spending:* ${highestCategory}\n` +
        `🚌 *Lowest Spending:* ${lowestCategory}\n` +
        `⚡ *Burn Rate:* ${burnRateStatus}\n` +
        `⭐ *Top Expense:* ${topExpense.description} (₹${topExpense.amount.toFixed(0)})\n\n` +
        `💡 *AI Advice:*\n${aiAdvice}`;

    return {
        weekTotal,
        budgetPct,
        highestCategory,
        lowestCategory,
        burnRateStatus,
        topExpense,
        aiAdvice,
        reportText
    };
}

module.exports = { generateSpendingHeatmap, generateWeeklyReport };
