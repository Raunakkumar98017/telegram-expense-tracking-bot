const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, 'expenses.db');

// Check if we are in Cloud Mode (Supabase)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
let sqliteDb = null;

if (supabaseUrl && supabaseKey) {
    console.log('🌐 Cloud Mode: Connecting to Supabase...');
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.log('💻 Local Mode: Connecting to SQLite...');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('❌ SQLite Error:', err.message);
    });

    sqliteDb.serialize(() => {
        sqliteDb.run(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            date TEXT,
            amount REAL,
            category TEXT,
            description TEXT
        )`);
    });
}

module.exports = { sqliteDb, supabase };
