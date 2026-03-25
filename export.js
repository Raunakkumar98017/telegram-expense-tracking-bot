const fs = require('fs');
const path = require('path');
const { sqliteDb, supabase } = require('./db');

const isCloud = () => !!supabase;

async function generateCSV(userId, callback) {
    let rows = [];

    if (isCloud()) {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('userId', userId)
            .order('date', { ascending: false });
        
        if (error) return callback(error, null);
        rows = data;
    } else {
        const query = `SELECT * FROM expenses WHERE userId = ? ORDER BY date DESC, id DESC`;
        sqliteDb.all(query, [userId], (err, data) => {
            if (err) return callback(err, null);
            processRows(userId, data, callback);
        });
        return; // Callback handled in async sqlite
    }

    processRows(userId, rows, callback);
}

function processRows(userId, rows, callback) {
    if (rows.length === 0) {
        return callback(new Error("No expenses to export."), null);
    }

    const sanitizedUser = userId.replace(/[^a-z0-9]/gi, '_');
    const csvPath = path.join(__dirname, `expenses_${sanitizedUser}.csv`);
    const headers = ["ID", "Date", "Amount", "Category", "Description"];
    
    const lines = [headers.join(',')];
    rows.forEach(row => {
        const line = [
            row.id,
            row.date,
            row.amount.toFixed(2),
            `"${row.category}"`,
            `"${row.description.replace(/"/g, '""')}"`
        ];
        lines.push(line.join(','));
    });

    fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
    callback(null, csvPath);
}

module.exports = { generateCSV };
