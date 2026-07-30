const axios = require('axios');
const { analyzeReceipt } = require('./groq');
const { saveExpense, getBudget, getMonthSpend } = require('./expenses');

async function handleReceiptPhoto(bot, msg) {
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const photos = msg.photo;

    if (!photos || photos.length === 0) return;

    // Pick highest resolution photo (last in array)
    const photo = photos[photos.length - 1];

    try {
        await bot.sendMessage(chatId, '📸 *Scanning receipt with Groq AI...*', { parse_mode: 'Markdown' });

        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');

        const parsed = await analyzeReceipt(base64Image, 'image/jpeg');

        if (!parsed || !parsed.amount || parsed.amount <= 0) {
            return bot.sendMessage(chatId, '❌ Could not detect clear receipt amount. Please log manually e.g. `spent 250 at D-Mart`', { parse_mode: 'Markdown' });
        }

        const groupId = msg.chat.type !== 'private' ? String(chatId) : null;
        const note = `[Receipt] ${parsed.store ? parsed.store + ' - ' : ''}${parsed.description}`;

        saveExpense(userId, parsed.amount, parsed.category, parsed.date, note, groupId, async (err, expenseId) => {
            if (err) {
                return bot.sendMessage(chatId, '❌ Failed to save receipt expense to database.');
            }

            await bot.sendMessage(chatId,
                `🧾 *Receipt Scanned & Saved!*\n\n` +
                `💰 Amount: ₹${parsed.amount.toFixed(2)}\n` +
                `📂 Category: ${parsed.category}\n` +
                `🏪 Store: ${parsed.store}\n` +
                `📅 Date: ${parsed.date}\n` +
                `📝 Note: _${note}_`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '↩️ Undo', callback_data: `undo_${expenseId}` }
                        ]]
                    }
                }
            );

            // Burn rate alert check
            const budget = await getBudget(userId);
            if (budget) {
                const monthSpend = await getMonthSpend(userId);
                const now = new Date();
                const dayOfMonth = now.getDate();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const dailyRate = monthSpend / (dayOfMonth || 1);
                const projectedSpend = dailyRate * daysInMonth;

                if (projectedSpend > budget) {
                    const runOutDay = Math.floor(budget / dailyRate);
                    bot.sendMessage(chatId,
                        `🔥 *Burn Rate Alert!*\n\n` +
                        `You've spent ₹${monthSpend.toFixed(0)} in ${dayOfMonth} days.\n` +
                        `At this pace, you'll *run out of your ₹${budget} budget by the ${runOutDay}th* of this month!`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }
        });
    } catch (err) {
        console.error('Receipt Handler Error:', err.message);
        bot.sendMessage(chatId, '⚠️ Error scanning receipt. Please ensure image is clear or log manually.', { parse_mode: 'Markdown' });
    }
}

module.exports = { handleReceiptPhoto };
