const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const { parseText, parseSummaryRange } = require('./parser');
const { saveExpense, getDetailedSummary, getRecentText, clearDatabase } = require('./expenses');
const { generateCSV } = require('./export');

const app = express();
const port = process.env.PORT || 3000;

// Render health check
app.get('/', (req, res) => res.send('WhatsApp Bot is Online! 🚀'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
        headless: true, // Auto-set for cloud, can be toggled via env if needed
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// Deduplication cache to prevent processing the same message twice
const processedMessages = new Set();
// Clean the cache every hour to prevent memory leaks
setInterval(() => processedMessages.clear(), 1000 * 60 * 60);

client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code in WhatsApp to log in:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n🚀 WhatsApp Expense Bot is online and ready!');
    console.log('Open WhatsApp and send a message to yourself to log an expense.\n');
});

// Listen for incoming messages
client.on('message_create', async (msg) => {
    // 1. Deduplication: Don't process the same message ID twice
    if (processedMessages.has(msg.id.id)) return;
    processedMessages.add(msg.id.id);

    // 2. Public Mode: Listen to all incoming messages from everyone
    const userId = msg.from;
    const text = msg.body.trim().toLowerCase();
    if (!text) return;

    // 3. Fix: Ignore automated replies from the bot itself
    if (text.startsWith('✅') || text.startsWith('❌') || text.startsWith('📊') || text.startsWith('*📝')) {
        return;
    }

    // Command: "list" -> Show recent expenses
    if (text === 'list') {
        getRecentText(userId, (reply) => msg.reply(reply));
        return;
    }

    // Command: "total ..." -> Show categorized summary
    if (text.startsWith('total') || text === 'summary') {
        const range = parseSummaryRange(text);
        getDetailedSummary(userId, range, (reply) => msg.reply(reply));
        return;
    }

    // Command: "export" -> Generate CSV
    if (text === 'export') {
        generateCSV(userId, async (err, csvPath) => {
            if (err || !csvPath) return msg.reply('❌ No data to export.');
            try {
                const media = MessageMedia.fromFilePath(csvPath);
                await client.sendMessage(msg.from, media, { caption: "Here is your expense export!" });
            } catch (e) {
                msg.reply("❌ Error sending the CSV file.");
            }
        });
        return;
    }

    // Command: "reset" or "clear" -> Wipe database for THIS user only
    if (text === 'reset' || text === 'clear') {
        clearDatabase(userId, (err, count) => {
            if (err) msg.reply("❌ Error clearing database.");
            else msg.reply(`✅ Your database history has been cleared! Removed ${count} entries.`);
        });
        return;
    }

    // Natural Language Expense parsing
    if (!/\d/.test(text)) return; 

    // Parse text to extract info
    const parsed = parseText(msg.body);
    
    // Only save if an amount was found
    if (parsed.amount > 0) {
        saveExpense(userId, parsed.amount, parsed.category, parsed.date, parsed.description, (err, id) => {
            if (err) {
                msg.reply('❌ Failed to save expense.');
            } else {
                msg.reply(`✅ *Saved Expense #${id}*\n💰 ₹${parsed.amount.toFixed(2)}\n📂 ${parsed.category}\n📅 ${parsed.date}`);
            }
        });
    }
});

client.initialize();
