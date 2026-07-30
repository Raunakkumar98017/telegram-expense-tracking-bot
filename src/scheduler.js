const cron = require('node-cron');
const { getUsersList } = require('./expenses');
const { generateWeeklyReport } = require('./reports');
const { getBudget, getMonthSpend } = require('./expenses');

function start(bot) {
    console.log('⏰ Initializing Background Scheduler...');

    // 1. Weekly AI Finance Report (Every Sunday at 09:00 AM)
    cron.schedule('0 9 * * 0', async () => {
        console.log('📢 Running Sunday Weekly Finance Report job...');
        try {
            const userIds = await getUsersList();
            for (const userId of userIds) {
                const report = await generateWeeklyReport(userId);
                bot.sendMessage(userId, report.reportText, { parse_mode: 'Markdown' }).catch(err => {
                    console.error(`Failed to send weekly report to ${userId}:`, err.message);
                });
            }
        } catch (err) {
            console.error('Error in Sunday Weekly Report job:', err.message);
        }
    });

    // 2. Daily Evening Burn Rate Alert & Encouragement (Every day at 8:00 PM)
    cron.schedule('0 20 * * *', async () => {
        console.log('🌙 Running Daily Evening Check job...');
        try {
            const userIds = await getUsersList();
            for (const userId of userIds) {
                const budget = await getBudget(userId);
                if (!budget) continue;

                const monthSpend = await getMonthSpend(userId);
                const now = new Date();
                const dayOfMonth = now.getDate();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const dailyRate = monthSpend / (dayOfMonth || 1);
                const projectedSpend = dailyRate * daysInMonth;

                if (projectedSpend > budget) {
                    const runOutDay = Math.floor(budget / dailyRate);
                    bot.sendMessage(userId,
                        `🌙 *Evening Burn Rate Alert!*\n\n` +
                        `Your current spending speed projects you'll run out of budget by day *${runOutDay}* of this month.\n` +
                        `💡 _Consider keeping tomorrow's spend under ₹${Math.floor(budget / daysInMonth)}!_`,
                        { parse_mode: 'Markdown' }
                    ).catch(()=>{});
                }
            }
        } catch (err) {
            console.error('Error in Daily Evening Check job:', err.message);
        }
    });

    console.log('✅ Background Scheduler active (Sunday Reports & Evening Alerts).');
}

module.exports = { start };
