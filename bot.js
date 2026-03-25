const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');
const { parseText, parseSummaryRange } = require('./parser');
const { saveExpense, deleteExpense, getDetailedSummary, getRecentText, clearDatabase, setBudget, getBudget, getMonthSpend, getWeeklySummaryText, getGroupSplit } = require('./expenses');
const { generateCSV } = require('./export');
const { getPoetryRoast } = require('./advisor');
require('dotenv').config();

// ─── EXPRESS HEALTH CHECK ────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🚀 Telegram Expense Bot is Online!'));
const server = app.listen(port, () => console.log(`🌍 Health check on port ${port}`));

// ─── SELF-PING TO STAY AWAKE (RENDER) ───────────────────────────────────────
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    console.log(`📡 Self-ping active for: ${RENDER_URL}`);
    setInterval(() => {
        https.get(RENDER_URL, (res) => {
            console.log(`Ping successful: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('Ping failed:', err.message);
        });
    }, 13 * 60 * 1000); // Ping every 13 mins to stay awake (Render sleeps at 15)
}

// ─── TELEGRAM BOT ────────────────────────────────────────────────────────────
const token = process.env.TELEGRAM_TOKEN;
if (!token) { console.error('❌ TELEGRAM_TOKEN not set!'); process.exit(1); }

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram Expense Bot is running!');

// ─── HELPER: BURN RATE CHECK ─────────────────────────────────────────────────
async function checkBurnRate(userId, chatId) {
    const budget = await new Promise(resolve => getBudget(userId, (err, b) => resolve(b)));
    if (!budget) return;

    const monthSpend = await getMonthSpend(userId);
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    const dailyRate = monthSpend / dayOfMonth;
    const projectedSpend = dailyRate * daysInMonth;

    if (projectedSpend > budget) {
        const runOutDay = Math.floor(budget / dailyRate);
        bot.sendMessage(chatId,
            `🔥 *Burn Rate Alert!*\n\n` +
            `You've spent ₹${monthSpend.toFixed(0)} in ${dayOfMonth} days.\n` +
            `At this pace, you'll *run out of your ₹${budget} budget by the ${runOutDay}th* of this month!\n\n` +
            `💡 _Slow down a bit!_`,
            { parse_mode: 'Markdown' }
        );
    }
}

// ─── COMMANDS ────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'there';
    bot.sendMessage(msg.chat.id,
        `👋 Hey *${name}*! I'm your personal AI Expense Tracker!\n\n` +
        `💬 *Log an expense:*\n  _spent 200 on lunch_\n\n` +
        `📊 *Summaries:*\n  _total today_ / _total this week_\n\n` +
        `🎭 *Commands:*\n` +
        `/list — Last 5 expenses\n` +
        `/budget <amount> — Set monthly budget\n` +
        `/roast — Get AI financial advice (Shayari style!)\n` +
        `/split — (Groups only) Show shared balances\n` +
        `/export — Download CSV\n` +
        `/reset — Clear your data\n` +
        `/help — Show this message`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📖 *How to use:*\n\n` +
        `Just type naturally:\n` +
        `  • _spent 150 on coffee_\n` +
        `  • _paid 500 for groceries today_\n` +
        `  • _total this week_\n\n` +
        `*Commands:*\n` +
        `/list — Your last 5 expenses\n` +
        `/budget 5000 — Set ₹5000 as your monthly limit\n` +
        `/roast — Get AI Shayari about your spending!\n` +
        `/export — Download all data as CSV\n` +
        `/reset — Clear your history`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/list/, (msg) => {
    const userId = String(msg.from.id);
    getRecentText(userId, (reply) => {
        bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
    });
});

// /budget <amount> — Set a monthly budget
bot.onText(/\/budget (.+)/, (msg, match) => {
    const userId = String(msg.from.id);
    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) {
        return bot.sendMessage(msg.chat.id, '❌ Please enter a valid amount. Example: `/budget 5000`', { parse_mode: 'Markdown' });
    }
    setBudget(userId, amount, (err) => {
        if (err) return bot.sendMessage(msg.chat.id, '❌ Failed to set budget.');
        bot.sendMessage(msg.chat.id, 
            `✅ *Monthly Budget Set!*\n\n💰 You will be warned when your spending pace exceeds ₹${amount.toFixed(0)}.\n\n_I'll keep an eye on your burn rate for you!_ 👀`,
            { parse_mode: 'Markdown' }
        );
    });
});

// /roast — Gemini Shayari Advisor
bot.onText(/\/roast/, async (msg) => {
    const userId = String(msg.from.id);
    const name = msg.from.first_name || 'Dost';
    
    await bot.sendMessage(msg.chat.id, '🎭 _Consulting AI Shayar (Final v3)..._', { parse_mode: 'Markdown' });
    
    const spendingData = await getWeeklySummaryText(userId);
    const roast = await getPoetryRoast(name, spendingData);
    
    bot.sendMessage(msg.chat.id, `🎭 *Your Financial Shayari:*\n\n${roast}`, { parse_mode: 'Markdown' });
});

// /split — (Groups only) Calculate shared balance
bot.onText(/\/split/, async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;

    if (chatType === 'private') {
        return bot.sendMessage(chatId, '❌ The `/split` command only works in groups!', { parse_mode: 'Markdown' });
    }

    getGroupSplit(String(chatId), (err, reply) => {
        if (err) return bot.sendMessage(chatId, '❌ Error calculating split.');
        bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
    });
});

// /export — Send CSV file
bot.onText(/\/export/, async (msg) => {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'This Week', callback_data: 'export_this_week' },
                    { text: 'This Month', callback_data: 'export_this_month' }
                ],
                [
                    { text: 'Last Month', callback_data: 'export_last_month' },
                    { text: 'This Year', callback_data: 'export_this_year' }
                ],
                [
                    { text: 'All Time', callback_data: 'export_all_time' }
                ]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, '📅 Which timeframe would you like to export?', opts);
});

// /reset — Clear user data
bot.onText(/\/reset/, (msg) => {
    const userId = String(msg.from.id);
    clearDatabase(userId, (err, count) => {
        if (err) bot.sendMessage(msg.chat.id, '❌ Error clearing data.');
        else bot.sendMessage(msg.chat.id, `✅ Your history has been cleared! Removed *${count}* entries.`, { parse_mode: 'Markdown' });
    });
});

// ─── INLINE BUTTON HANDLERS ──────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
    const data = query.data;
    const userId = String(query.from.id);
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    // Handle Undo
    if (data.startsWith('undo_')) {
        const expenseId = data.split('_')[1];
        deleteExpense(userId, expenseId, (err) => {
            if (err) {
                bot.answerCallbackQuery(query.id, { text: '❌ Could not undo.' });
            } else {
                bot.editMessageText(
                    '↩️ *Expense removed!*',
                    { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
                );
                bot.answerCallbackQuery(query.id, { text: '✅ Expense deleted!' });
            }
        });
    }

    // Handle Export Timeframe
    if (data.startsWith('export_')) {
        const timeframe = data.replace('export_', '');
        bot.answerCallbackQuery(query.id, { text: '⏳ Generating CSV...' });
        
        generateCSV(userId, timeframe, async (err, csvPath) => {
            if (err || !csvPath) return bot.sendMessage(chatId, `❌ No expenses found for this timeframe.`);
            try {
                bot.deleteMessage(chatId, messageId).catch(()=>{}); // remove inline keyboard
                
                const tfLabel = timeframe.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                await bot.sendDocument(chatId, csvPath, 
                    { caption: `📊 Here is your expense report (${tfLabel})` }, 
                    { filename: `MyKhataBot_${tfLabel.replace(' ','')}.csv` }
                );
                require('fs').unlink(csvPath, ()=>{}); // clean up temp file
            } catch (e) {
                bot.sendMessage(chatId, '❌ Failed to send CSV file.');
            }
        });
    }
});

// ─── NATURAL LANGUAGE EXPENSE PARSING ────────────────────────────────────────
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = String(msg.from.id);
    const text = msg.text || '';
    const lower = text.trim().toLowerCase();
    if (!lower) return;

    // Summary request
    if (lower.startsWith('total') || lower === 'summary') {
        const range = parseSummaryRange(lower);
        getDetailedSummary(userId, range, (reply) => {
            bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
        });
        return;
    }

    // Must have a number to be an expense
    if (!/\d/.test(lower)) return;

    const parsed = parseText(text);
    const groupId = msg.chat.type !== 'private' ? String(msg.chat.id) : null;

    if (parsed.amount > 0) {
        saveExpense(userId, parsed.amount, parsed.category, parsed.date, parsed.description, groupId, async (err, id) => {
            if (err) {
                bot.sendMessage(msg.chat.id, '❌ Failed to save expense.');
            } else {
                // Send confirmation WITH the Undo inline button
                await bot.sendMessage(msg.chat.id,
                    `✅ *Expense Saved!*\n\n` +
                    `💰 Amount: ₹${parsed.amount.toFixed(2)}\n` +
                    `📂 Category: ${parsed.category}\n` +
                    `📅 Date: ${parsed.date}\n` +
                    `📝 Note: _${parsed.description}_`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '↩️ Undo', callback_data: `undo_${id}` }
                            ]]
                        }
                    }
                );

                // Check burn rate after every expense
                await checkBurnRate(userId, msg.chat.id);
            }
        });
    }
});

// Error handling
bot.on('polling_error', (error) => console.error('Polling error:', error.message));
