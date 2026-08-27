const axios = require('axios');
const { analyzeReceipt } = require('./groq');
const { saveExpense, getBudget, getMonthSpend } = require('./expenses');

const pendingReceipts = new Map();

async function handleReceiptPhoto(bot, msg) {
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const photos = msg.photo;

    if (!photos || photos.length === 0) return;

    // Pick highest resolution photo (last in array)
    const photo = photos[photos.length - 1];

    try {
        await bot.sendMessage(chatId, '📸 *Scanning receipt with Penny AI...*', { parse_mode: 'Markdown' });

        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const base64Image = Buffer.from(response.data).toString('base64');

        const parsed = await analyzeReceipt(base64Image, 'image/jpeg');

        if (!parsed || !parsed.amount || parsed.amount <= 0) {
            return bot.sendMessage(chatId, '❌ Could not detect clear receipt amount. Please log manually e.g. `spent 250 at D-Mart`', { parse_mode: 'Markdown' });
        }

        const groupId = msg.chat.type !== 'private' ? String(chatId) : null;
        const note = `[Receipt|${fileLink}] ${parsed.store ? parsed.store + ' - ' : ''}${parsed.description}`;

        const todayStr = new Date().toISOString().split('T')[0];
        
        if (parsed.date && parsed.date !== todayStr) {
            // Receipt is old, ask user
            const receiptId = Date.now().toString();
            pendingReceipts.set(receiptId, { userId, parsed, note, groupId });
            
            await bot.sendMessage(chatId, 
                `📅 *Receipt dated: ${parsed.date}*\n\n` +
                `I noticed this receipt is not from today.\n` +
                `How would you like to record this expense?`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: `📅 Use Receipt Date (${parsed.date})`, callback_data: `rcptdate_${receiptId}` }],
                            [{ text: `📆 Use Today's Date`, callback_data: `rcpttoday_${receiptId}` }]
                        ]
                    }
                }
            );
            return;
        }

        // If today, save immediately
        _saveFinalReceipt(bot, chatId, userId, parsed, note, groupId, parsed.date);
        
    } catch (err) {
        console.error('Receipt Handler Error:', err.message);
        bot.sendMessage(chatId, '⚠️ Error scanning receipt. Please ensure image is clear or log manually.', { parse_mode: 'Markdown' });
    }
}

function _saveFinalReceipt(bot, chatId, userId, parsed, note, groupId, finalDate) {
    saveExpense(userId, parsed.amount, parsed.category, finalDate, note, groupId, async (err, expenseId) => {
        if (err) {
            return bot.sendMessage(chatId, '❌ Failed to save receipt expense to database.');
        }

        const cleanDisplayNote = note.replace(/\[Receipt\|[^\]]+\]\s*/, '').replace(/[_*`\[\]]/g, ' ');
        await bot.sendMessage(chatId,
            `🧾 *Receipt Scanned & Saved!*\n\n` +
            `💰 Amount: ₹${parsed.amount.toFixed(2)}\n` +
            `📂 Category: ${parsed.category}\n` +
            `🏪 Store: ${parsed.store}\n` +
            `📅 Date: ${finalDate}\n` +
            `📝 Note: ${cleanDisplayNote}`,
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
}

function confirmReceiptDate(bot, queryId, chatId, messageId, receiptId, useToday) {
    const data = pendingReceipts.get(receiptId);
    if (!data) {
        bot.answerCallbackQuery(queryId, { text: '❌ Receipt data expired.' });
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        return;
    }
    
    pendingReceipts.delete(receiptId);
    bot.answerCallbackQuery(queryId, { text: '⏳ Saving receipt...' });
    bot.deleteMessage(chatId, messageId).catch(()=>{});
    
    const finalDate = useToday ? new Date().toISOString().split('T')[0] : data.parsed.date;
    _saveFinalReceipt(bot, chatId, data.userId, data.parsed, data.note, data.groupId, finalDate);
}

module.exports = { handleReceiptPhoto, confirmReceiptDate };
