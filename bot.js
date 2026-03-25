const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { parseText, parseSummaryRange } = require('./parser');
const { saveExpense, getDetailedSummary, getRecentText, clearDatabase } = require('./expenses');
const { generateCSV } = require('./export');
require('dotenv').config();

// Start Express health check server for Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🚀 Telegram Expense Bot is Online!'));
app.listen(port, () => console.log(`🌍 Health check on port ${port}`));

// Initialize Telegram Bot
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
    console.error('❌ TELEGRAM_TOKEN is not set in the .env file!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Telegram Expense Bot is running!');

// ──────────────────────────────────────────────
// COMMANDS
// ──────────────────────────────────────────────

// /start — Welcome message
bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'there';
    bot.sendMessage(msg.chat.id, 
        `👋 Hey *${name}*! I'm your personal Expense Tracker Bot!\n\n` +
        `Here's what you can do:\n\n` +
        `💬 *Log an expense*:\n  _spent 200 on lunch_\n\n` +
        `📊 *Get summaries*:\n  _total today_\n  _total this week_\n  _total this month_\n\n` +
        `📋 *Commands*:\n` +
        `  /list — Last 5 expenses\n` +
        `  /export — Download CSV\n` +
        `  /reset — Clear your data\n` +
        `  /help — Show this message`,
        { parse_mode: 'Markdown' }
    );
});

// /help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📖 *How to use the Bot:*\n\n` +
        `Just type naturally! Examples:\n` +
        `  • _spent 150 on coffee_\n` +
        `  • _paid 500 for groceries today_\n` +
        `  • _total today_ / _total this week_\n\n` +
        `*Commands:*\n` +
        `/list — Your last 5 expenses\n` +
        `/export — Download all data as CSV\n` +
        `/reset — Clear your expense history`,
        { parse_mode: 'Markdown' }
    );
});

// /list — Recent expenses
bot.onText(/\/list/, (msg) => {
    const userId = String(msg.from.id);
    getRecentText(userId, (reply) => {
        bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
    });
});

// /export — Send CSV file
bot.onText(/\/export/, async (msg) => {
    const userId = String(msg.from.id);
    generateCSV(userId, async (err, csvPath) => {
        if (err || !csvPath) {
            return bot.sendMessage(msg.chat.id, '❌ No data to export yet!');
        }
        try {
            await bot.sendDocument(msg.chat.id, csvPath, {}, { filename: 'expenses.csv' });
        } catch (e) {
            bot.sendMessage(msg.chat.id, '❌ Failed to send CSV file.');
        }
    });
});

// /reset — Clear user data
bot.onText(/\/reset/, (msg) => {
    const userId = String(msg.from.id);
    clearDatabase(userId, (err, count) => {
        if (err) bot.sendMessage(msg.chat.id, '❌ Error clearing data.');
        else bot.sendMessage(msg.chat.id, `✅ Your history has been cleared! Removed *${count}* entries.`, { parse_mode: 'Markdown' });
    });
});

// ──────────────────────────────────────────────
// NATURAL LANGUAGE EXPENSE PARSING
// ──────────────────────────────────────────────
bot.on('message', async (msg) => {
    // Ignore commands (already handled above)
    if (msg.text && msg.text.startsWith('/')) return;
    
    const userId = String(msg.from.id);
    const text = msg.text || '';
    const lower = text.trim().toLowerCase();

    if (!lower) return;

    // Summary request: "total today", "total this week" etc.
    if (lower.startsWith('total') || lower === 'summary') {
        const range = parseSummaryRange(lower);
        getDetailedSummary(userId, range, (reply) => {
            bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
        });
        return;
    }

    // Must contain a number to be an expense
    if (!/\d/.test(lower)) return;

    // Try to parse as an expense
    const parsed = parseText(text);
    if (parsed.amount > 0) {
        saveExpense(userId, parsed.amount, parsed.category, parsed.date, parsed.description, (err, id) => {
            if (err) {
                bot.sendMessage(msg.chat.id, '❌ Failed to save expense.');
            } else {
                bot.sendMessage(msg.chat.id,
                    `✅ *Expense Saved!*\n\n` +
                    `💰 Amount: ₹${parsed.amount.toFixed(2)}\n` +
                    `📂 Category: ${parsed.category}\n` +
                    `📅 Date: ${parsed.date}\n` +
                    `📝 Note: _${parsed.description}_`,
                    { parse_mode: 'Markdown' }
                );
            }
        });
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});
