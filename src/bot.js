const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const https = require('https');
const path = require('path');
const { parseText, parseSummaryRange } = require('./parser');
const {
    saveExpense,
    deleteExpense,
    getDetailedSummary,
    getRecentText,
    clearDatabase,
    setBudget,
    getBudget,
    getMonthSpend,
    getWeeklySummaryText,
    getGroupSplit
} = require('./expenses');
const { generateCSV } = require('./export');
const { getPoetryRoast } = require('./advisor');
const { handleReceiptPhoto } = require('./receipt');
const { handleVoiceNote } = require('./voice');
const { generateSpendingHeatmap, generateWeeklyReport } = require('./reports');
const { getFinancialPersonality } = require('./personality');
const dashboardApi = require('./routes/dashboardApi');
const scheduler = require('./scheduler');
const { generateDashboardToken, verifyDashboardToken } = require('./auth');
require('dotenv').config();

// ─── EXPRESS SERVER & DASHBOARD API ──────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'landing')));
app.use('/api', dashboardApi);

// 🔒 Token-Protected Dashboard Route
app.get(['/dashboard', '/dashboard.html', '/analytics'], (req, res) => {
    const { userId, ts, t } = req.query;

    if (!verifyDashboardToken(userId, ts, t)) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Access Restricted — Penny AI</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>
                    body { background: #0f0d19; color: #ffffff; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                    .restricted-card { background: #1a162d; border: 1px solid rgba(255,255,255,0.1); padding: 40px 30px; border-radius: 20px; max-width: 440px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                    .icon { font-size: 52px; margin-bottom: 16px; }
                    h1 { font-size: 22px; font-weight: 800; color: #ef4444; margin-bottom: 12px; }
                    p { color: #9ca3af; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
                    .btn-tg { display: inline-block; background: linear-gradient(135deg, #0088cc, #0077b5); color: #ffffff; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; }
                    .btn-tg:hover { background: #0077b5; }
                </style>
            </head>
            <body>
                <div class="restricted-card">
                    <div class="icon">🔒</div>
                    <h1>Access Restricted</h1>
                    <p>Direct web URL access is disabled for your security & privacy.</p>
                    <p>To view your live personal analytics dashboard, please type <strong>/dashboard</strong> in the <strong>Penny AI</strong> Telegram chat.</p>
                    <a href="https://t.me/MyKhataBot" class="btn-tg">Open Penny AI in Telegram</a>
                </div>
            </body>
            </html>
        `);
    }
    res.sendFile(path.join(__dirname, '..', 'landing', 'dashboard.html'));
});

const server = app.listen(port, () => console.log(`🌍 Server & Dashboard running on port ${port}`));

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
    }, 13 * 60 * 1000);
}

// ─── TELEGRAM BOT ────────────────────────────────────────────────────────────
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
    console.error('❌ TELEGRAM_TOKEN not set in environment variables!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
console.log('🤖 Penny AI Telegram Bot is running!');

bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        // Suppress repeated console spam when another instance is polling
    } else {
        console.error('Telegram Polling Error:', error.message || error);
    }
});

// Launch background cron scheduler
scheduler.start(bot);

// ─── HELPER: BURN RATE CHECK ─────────────────────────────────────────────────
async function checkBurnRate(userId, chatId) {
    const budget = await getBudget(userId);
    if (!budget) return;

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
            `At this pace, you'll *run out of your ₹${budget} budget by the ${runOutDay}th* of this month!\n\n` +
            `💡 _Slow down a bit!_`,
            { parse_mode: 'Markdown' }
        );
    }
}

// ─── COMMAND HANDLERS ────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
    const name = msg.from.first_name || 'there';
    bot.sendMessage(msg.chat.id,
        `👋 Hey *${name}*! I'm *Penny AI*, your personal financial assistant!\n\n` +
        `💬 *Log expenses naturally:*\n  • Text: _spent 200 on lunch_\n  • 🎤 Voice: Send a voice note\n  • 📸 Receipt: Upload a photo\n\n` +
        `📊 *Commands & Features:*\n` +
        `/dashboard — Open your live Analytics Web Dashboard\n` +
        `/list — Recent expenses\n` +
        `/budget <amount> — Set monthly limit\n` +
        `/heatmap — Spending calendar grid\n` +
        `/personality — AI Financial Personality\n` +
        `/report — Weekly AI Finance Report\n` +
        `/roast — Financial Shayari & AI Roasts\n` +
        `/split — (Groups) Calculate shared balances\n` +
        `/export — Download Excel Spreadsheet\n` +
        `/help — Detailed guide`,
        { parse_mode: 'Markdown' }
    );
});

// /dashboard or /analytics command
bot.onText(/\/(dashboard|analytics)/, (msg) => {
    const userId = String(msg.from.id);
    const name = msg.from.first_name || 'User';
    const ts = Date.now();
    const token = generateDashboardToken(userId, ts);

    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    const dashboardUrl = `${baseUrl}/dashboard?userId=${userId}&name=${encodeURIComponent(name)}&ts=${ts}&t=${token}`;

    bot.sendMessage(msg.chat.id,
        `📊 *Your Personal Financial Analytics Dashboard*\n\n` +
        `Hey *${name}*! Click the button below to view your personalized real-time spending insights, charts, and heatmaps:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '🌐 Open My Analytics Dashboard', url: dashboardUrl }
                ]]
            }
        }
    );
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📖 *How to use Penny AI:*\n\n` +
        `1. *Text Expense:* _spent 150 on coffee_\n` +
        `2. *Voice Note:* Send any audio voice message!\n` +
        `3. *Receipt Scanner:* Upload any receipt photo!\n` +
        `4. *Analytics Dashboard:* Type /dashboard to get your web link!\n\n` +
        `*Commands:* /dashboard, /list, /budget, /heatmap, /personality, /report, /roast, /split, /export, /reset`,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/list/, (msg) => {
    const userId = String(msg.from.id);
    getRecentText(userId, (reply) => {
        bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
    });
});

bot.onText(/\/budget (.+)/, (msg, match) => {
    const userId = String(msg.from.id);
    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) {
        return bot.sendMessage(msg.chat.id, '❌ Please enter a valid amount. Example: `/budget 5000`', { parse_mode: 'Markdown' });
    }
    setBudget(userId, amount, (err) => {
        if (err) return bot.sendMessage(msg.chat.id, '❌ Failed to set budget.');
        bot.sendMessage(msg.chat.id, 
            `✅ *Monthly Budget Set!*\n\n💰 Warns when spending exceeds ₹${amount.toFixed(0)} limit pace.\n\n_I'll watch your burn rate for you!_ 👀`,
            { parse_mode: 'Markdown' }
        );
    });
});

// /heatmap — Visual Spending Heatmap
bot.onText(/\/heatmap/, async (msg) => {
    const userId = String(msg.from.id);
    const heatmap = await generateSpendingHeatmap(userId);
    bot.sendMessage(msg.chat.id, heatmap.formattedText, { parse_mode: 'Markdown' });
});

// /personality — AI Financial Personality
bot.onText(/\/personality/, async (msg) => {
    const userId = String(msg.from.id);
    const p = await getFinancialPersonality(userId);
    bot.sendMessage(msg.chat.id, p.formattedText, { parse_mode: 'Markdown' });
});

// /report — Weekly AI Finance Report
bot.onText(/\/report/, async (msg) => {
    const userId = String(msg.from.id);
    await bot.sendMessage(msg.chat.id, '📊 *Generating Weekly AI Report...*', { parse_mode: 'Markdown' });
    const r = await generateWeeklyReport(userId);
    bot.sendMessage(msg.chat.id, r.reportText, { parse_mode: 'Markdown' });
});

// /roast — Financial Shayari & AI Roasts
bot.onText(/\/roast/, async (msg) => {
    const userId = String(msg.from.id);
    const name = msg.from.first_name || 'Sher';
    await bot.sendMessage(msg.chat.id, `🔥 *${name} ka Kharcha check ho raha hai...*`, { parse_mode: 'Markdown' });
    const spendingData = await getWeeklySummaryText(userId);
    const roast = await getPoetryRoast(name, spendingData);
    bot.sendMessage(msg.chat.id, `🎭 *Shayari-e-Kharcha (Penny AI):*\n\n${roast}`, { parse_mode: 'Markdown' });
});

// /split — Group balances
bot.onText(/\/split/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type === 'private') {
        return bot.sendMessage(chatId, '❌ The `/split` command only works in group chats!', { parse_mode: 'Markdown' });
    }
    getGroupSplit(String(chatId), (err, reply) => {
        if (err) return bot.sendMessage(chatId, '❌ Error calculating split.');
        bot.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
    });
});

// /export — Send Excel document
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
                ]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, '📅 Select timeframe for Excel export:', opts);
});

// /reset — Reset data
bot.onText(/\/reset/, (msg) => {
    const userId = String(msg.from.id);
    clearDatabase(userId, (err, count) => {
        if (err) bot.sendMessage(msg.chat.id, '❌ Error clearing data.');
        else bot.sendMessage(msg.chat.id, `✅ Your history has been reset! (${count} items removed)`, { parse_mode: 'Markdown' });
    });
});

// ─── MEDIA HANDLERS (VOICE & RECEIPT PHOTO) ─────────────────────────────────

bot.on('photo', async (msg) => {
    handleReceiptPhoto(bot, msg);
});

bot.on('voice', async (msg) => {
    handleVoiceNote(bot, msg);
});

// ─── INLINE BUTTON CALLBACK HANDLERS ─────────────────────────────────────────
bot.on('callback_query', async (query) => {
    const data = query.data;
    const userId = String(query.from.id);
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (data.startsWith('undo_')) {
        const expenseId = data.split('_')[1];
        deleteExpense(userId, expenseId, (err) => {
            if (err) {
                bot.answerCallbackQuery(query.id, { text: '❌ Could not undo.' });
            } else {
                bot.editMessageText('↩️ *Expense removed!*', { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
                bot.answerCallbackQuery(query.id, { text: '✅ Expense deleted!' });
            }
        });
    }

    if (data.startsWith('total_')) {
        const timeframe = data.replace('total_', '');
        bot.answerCallbackQuery(query.id, { text: '📊 Fetching total...' });
        getDetailedSummary(userId, timeframe, (reply) => {
            bot.editMessageText(reply, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        });
    }

    if (data.startsWith('export_')) {
        const timeframe = data.replace('export_', '');
        bot.answerCallbackQuery(query.id, { text: '⏳ Generating Excel file...' });
        generateCSV(userId, timeframe, async (err, csvPath) => {
            if (err || !csvPath) return bot.sendMessage(chatId, `❌ No expenses found for this timeframe.`);
            try {
                bot.deleteMessage(chatId, messageId).catch(()=>{});
                const tfLabel = timeframe.replace('_', ' ').toUpperCase();
                await bot.sendDocument(chatId, csvPath, 
                    { caption: `📊 Here is your Penny AI Excel expense report (${tfLabel})` }, 
                    { filename: `PennyAI_Expenses_${tfLabel}.csv` }
                );
                require('fs').unlink(csvPath, ()=>{});
            } catch (e) {
                bot.sendMessage(chatId, '❌ Failed to send Excel file.');
            }
        });
    }
});

// ─── NATURAL LANGUAGE TEXT MESSAGE PARSING ───────────────────────────────────
bot.on('message', async (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    if (msg.photo || msg.voice) return; // Handled by media handlers
    
    const userId = String(msg.from.id);
    const text = msg.text || '';
    if (!text.trim()) return;

    const initialLines = text.split('\n');
    let finalParts = [];

    for (const line of initialLines) {
        if (!line.trim()) continue;
        if (line.toLowerCase().startsWith('total') || line.toLowerCase() === 'summary') {
            finalParts.push(line.trim());
            continue;
        }

        const smartRegex = /(?:(?:₹|rs\.?|\$)?\s*\d+(?:\.\d{1,2})?\s*(?:rupees|rs|dollars|bucks)?\s*.+?)(?=(?:(?:₹|rs\.?|\$)?\s*\d+)|$)/gi;
        const matches = line.match(smartRegex);

        if (matches && matches.length > 1) {
            finalParts.push(...matches.map(m => m.trim()));
        } else {
            finalParts.push(line.trim());
        }
    }

    for (const part of finalParts) {
        const lower = part.toLowerCase().trim();

        // Plain text keywords
        if (lower === 'help' || lower === 'start' || lower === 'hi' || lower === 'hello') {
            bot.sendMessage(msg.chat.id, '👋 Hi! Send me text like `spent 200 on lunch`, voice notes, or receipt photos to log expenses!', { parse_mode: 'Markdown' });
            continue;
        }

        if (lower.startsWith('budget') || lower.startsWith('set budget') || lower.startsWith('my budget')) {
            const numMatch = lower.match(/\d+/);
            if (numMatch) {
                const amount = parseFloat(numMatch[0]);
                if (amount > 0) {
                    setBudget(userId, amount, (err) => {
                        if (err) return bot.sendMessage(msg.chat.id, '❌ Failed to set budget.');
                        bot.sendMessage(msg.chat.id, `🎯 *Monthly budget updated to ₹${amount.toLocaleString()}!*`, { parse_mode: 'Markdown' });
                    });
                    continue;
                }
            }
        }

        if (lower === 'list' || lower === 'recent' || lower === 'history') {
            getRecentText(userId, (reply) => bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' }));
            continue;
        }

        if (lower === 'roast' || lower === 'shayari') {
            const name = msg.from.first_name || 'Sher';
            await bot.sendMessage(msg.chat.id, `🔥 *${name} ka Kharcha check ho raha hai...*`, { parse_mode: 'Markdown' });
            const spendingData = await getWeeklySummaryText(userId);
            const roast = await getPoetryRoast(name, spendingData);
            bot.sendMessage(msg.chat.id, `🎭 *Shayari-e-Kharcha (Penny AI):*\n\n${roast}`, { parse_mode: 'Markdown' });
            continue;
        }

        if (lower === 'dashboard' || lower === 'analytics') {
            const name = msg.from.first_name || 'User';
            const ts = Date.now();
            const token = generateDashboardToken(userId, ts);
            const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
            const dashboardUrl = `${baseUrl}/dashboard?userId=${userId}&name=${encodeURIComponent(name)}&ts=${ts}&t=${token}`;
            bot.sendMessage(msg.chat.id,
                `📊 *Your Personal Financial Analytics Dashboard*\n\n` +
                `Click the button below to view your live spending insights:`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🌐 Open My Analytics Dashboard', url: dashboardUrl }
                        ]]
                    }
                }
            );
            continue;
        }

        if (lower === 'heatmap') {
            const heatmap = await generateSpendingHeatmap(userId);
            bot.sendMessage(msg.chat.id, heatmap.formattedText, { parse_mode: 'Markdown' });
            continue;
        }

        if (lower === 'personality') {
            const p = await getFinancialPersonality(userId);
            bot.sendMessage(msg.chat.id, p.formattedText, { parse_mode: 'Markdown' });
            continue;
        }

        if (lower === 'report') {
            const r = await generateWeeklyReport(userId);
            bot.sendMessage(msg.chat.id, r.reportText, { parse_mode: 'Markdown' });
            continue;
        }

        if (lower.startsWith('total') || lower === 'summary') {
            const hasRange = lower.includes('today') || lower.includes('week') || lower.includes('month') || lower.includes('year');
            if (hasRange) {
                const range = parseSummaryRange(lower);
                getDetailedSummary(userId, range, (reply) => bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' }));
            } else {
                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [ { text: 'Today', callback_data: 'total_today' }, { text: 'This Week', callback_data: 'total_week' } ],
                            [ { text: 'This Month', callback_data: 'total_month' }, { text: 'All Time', callback_data: 'total_all' } ]
                        ]
                    }
                };
                bot.sendMessage(msg.chat.id, '📊 *Select Timeframe for Summary:*', { parse_mode: 'Markdown', ...opts });
            }
            continue;
        }

        if (!/\d/.test(lower)) continue;

        const parsed = parseText(part);
        const groupId = msg.chat.type !== 'private' ? String(msg.chat.id) : null;

        if (parsed.amount > 0) {
            saveExpense(userId, parsed.amount, parsed.category, parsed.date, parsed.description, groupId, async (err, id) => {
                if (err) {
                    bot.sendMessage(msg.chat.id, `❌ Failed to save: "${part}"`);
                } else {
                    await bot.sendMessage(msg.chat.id,
                        `✅ *Expense Saved!*\n\n` +
                        `💰 Amount: ₹${parsed.amount.toFixed(2)}\n` +
                        `📂 Category: ${parsed.category}\n` +
                        `📅 Date: ${parsed.date}\n` +
                        `📝 Note: _${parsed.description}_`,
                        {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[ { text: '↩️ Undo', callback_data: `undo_${id}` } ]]
                            }
                        }
                    );
                    await checkBurnRate(userId, msg.chat.id);
                }
            });
        }
    }
});

bot.on('polling_error', (error) => console.error('Polling error:', error.message));
