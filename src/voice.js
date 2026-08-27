const axios = require('axios');
const { transcribeAudio, extractExpensesFromText } = require('./groq');
const { saveExpense, getBudget, getMonthSpend } = require('./expenses');

async function handleVoiceNote(bot, msg) {
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const voice = msg.voice;

    if (!voice) return;

    try {
        await bot.sendMessage(chatId, '🎤 *Transcribing voice note with Penny AI...*', { parse_mode: 'Markdown' });

        const fileLink = await bot.getFileLink(voice.file_id);
        console.log('Voice file link:', fileLink);
        
        const response = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 15000 });
        const audioBuffer = Buffer.from(response.data);
        console.log('Voice buffer size:', audioBuffer.length, 'bytes');

        if (audioBuffer.length < 100) {
            return bot.sendMessage(chatId, '❌ Audio file too small. Please record a longer voice note.', { parse_mode: 'Markdown' });
        }

        const transcript = await transcribeAudio(audioBuffer, 'voice.ogg');

        if (!transcript || !transcript.trim()) {
            return bot.sendMessage(chatId, '❌ Could not hear audio clearly. Please try again or type naturally.', { parse_mode: 'Markdown' });
        }

        await bot.sendMessage(chatId, `🗣️ *Heard:* _"${transcript.replace(/[_*`\[\]]/g, ' ')}"_`, { parse_mode: 'Markdown' });

        const expenses = await extractExpensesFromText(transcript);
        const groupId = msg.chat.type !== 'private' ? String(chatId) : null;

        if (!expenses || expenses.length === 0) {
            return bot.sendMessage(chatId, `❓ Could not extract expense amounts from: "${transcript}". Try saying "spent 300 on groceries"`, { parse_mode: 'Markdown' });
        }

        for (const parsed of expenses) {
            if (!parsed.amount || parsed.amount <= 0) continue;
            const dateStr = new Date().toISOString().split('T')[0];

            saveExpense(userId, parsed.amount, parsed.category, dateStr, parsed.description, groupId, async (err, expenseId) => {
                if (err) {
                    return bot.sendMessage(chatId, '❌ Failed to save voice expense.');
                }

                const cleanDesc = (parsed.description || '').replace(/[_*`\[\]]/g, ' ');
                await bot.sendMessage(chatId,
                    `✅ *Voice Expense Saved!*\n\n` +
                    `💰 Amount: ₹${parsed.amount.toFixed(2)}\n` +
                    `📂 Category: ${parsed.category}\n` +
                    `📝 Note: ${cleanDesc}`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '↩️ Undo', callback_data: `undo_${expenseId}` }
                            ]]
                        }
                    }
                );
                // Burn rate check
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
    } catch (err) {
        console.error('Voice Handler Error:', err.message);
        console.error('Voice Handler Full Error:', err.response?.data || err.stack);
        bot.sendMessage(chatId, `⚠️ Error processing voice note: ${err.message || 'Unknown error'}. Please try again.`, { parse_mode: 'Markdown' });
    }
}

module.exports = { handleVoiceNote };
