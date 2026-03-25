const { sqliteDb, supabase } = require('./db');

// Helper to determine the mode
const isCloud = () => !!supabase;

// Save expense (Unified)
async function saveExpense(userId, amount, category, date, description, callback) {
    if (isCloud()) {
        const { data, error } = await supabase
            .from('expenses')
            .insert([{ userId, amount, category, date, description }])
            .select();
        
        if (error) return callback(error);
        callback(null, data[0].id);
    } else {
        const query = `INSERT INTO expenses (userId, amount, category, date, description) VALUES (?, ?, ?, ?, ?)`;
        sqliteDb.run(query, [userId, amount, category, date, description], function(err) {
            callback(err, this ? this.lastID : null);
        });
    }
}

// Get detailed summary (Unified)
async function getDetailedSummary(userId, range, callback) {
    let startDate = '1970-01-01';
    const now = new Date();
    
    if (range === 'today') {
        startDate = now.toISOString().split('T')[0];
    } else if (range === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        startDate = monday.toISOString().split('T')[0];
    } else if (range === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (range === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }

    if (isCloud()) {
        const { data: totalData, error: totalErr } = await supabase
            .from('expenses')
            .select('amount')
            .eq('userId', userId)
            .gte('date', startDate);
        
        if (totalErr) return callback("❌ Cloud Error.");
        const total = totalData.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2);

        // Category breakdown (Manual aggregation since Supabase client is simpler)
        const categories = {};
        totalData.forEach(row => {
            // Re-fetch with category grouping or just group locally (simpler)
        });
        // Let's just re-query categories for speed
        const { data: catData, error: catErr } = await supabase.rpc('get_categories_summary', { 
            p_userid: userId, 
            p_startdate: startDate 
        });
        // Alternatively, since RPC requires manual SQL setup, let's just group locally for the demo:
        const { data: rawData } = await supabase.from('expenses').select('category, amount').eq('userId', userId).gte('date', startDate);
        const catMap = {};
        rawData.forEach(r => {
            catMap[r.category] = (catMap[r.category] || 0) + r.amount;
        });

        let reply = `📊 *Summary (${range.toUpperCase()})*\nTotal: ₹${total}\n\n*By Category:*`;
        Object.entries(catMap).sort((a,b) => b[1] - a[1]).forEach(([cat, amt]) => {
            reply += `\n- ${cat}: ₹${amt.toFixed(2)}`;
        });
        callback(reply);

    } else {
        const totalQuery = `SELECT SUM(amount) as total FROM expenses WHERE userId = ? AND date >= ?`;
        const categoryQuery = `SELECT category, SUM(amount) as catTotal FROM expenses WHERE userId = ? AND date >= ? GROUP BY category ORDER BY catTotal DESC`;

        sqliteDb.get(totalQuery, [userId, startDate], (err, row) => {
            if (err) return callback("❌ Error fetching summary.");
            const total = row && row.total ? row.total.toFixed(2) : "0.00";

            sqliteDb.all(categoryQuery, [userId, startDate], (err, rows) => {
                if (err) return callback("❌ Error fetching categories.");
                let reply = `📊 *Summary (${range.toUpperCase()})*\nTotal: ₹${total}\n`;
                if (rows.length > 0) {
                    reply += `\n*By Category:*`;
                    rows.forEach(r => (reply += `\n- ${r.category}: ₹${r.catTotal.toFixed(2)}`));
                }
                callback(reply);
            });
        });
    }
}

// Get recent text (Unified)
async function getRecentText(userId, callback) {
    if (isCloud()) {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .eq('userId', userId)
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .limit(5);

        if (error) return callback("❌ Cloud Error.");
        if (!data || data.length === 0) return callback("No expenses yet!");

        let reply = "*📝 Recent Expenses:*\n";
        data.forEach(row => {
            reply += `• ₹${row.amount.toFixed(2)} - ${row.category} (${row.date})\n  _${row.description}_\n`;
        });
        callback(reply);
    } else {
        const query = `SELECT * FROM expenses WHERE userId = ? ORDER BY date DESC, id DESC LIMIT 5`;
        sqliteDb.all(query, [userId], (err, rows) => {
            if (err) return callback("❌ Error fetching recent expenses.");
            if (rows.length === 0) return callback("No expenses yet!");
            let reply = "*📝 Recent Expenses:*\n";
            rows.forEach(row => (reply += `• ₹${row.amount.toFixed(2)} - ${row.category} (${row.date})\n  _${row.description}_\n`));
            callback(reply);
        });
    }
}

// Clear Database (Unified)
async function clearDatabase(userId, callback) {
    if (isCloud()) {
        const { error, count } = await supabase.from('expenses').delete().eq('userId', userId);
        callback(error, count);
    } else {
        sqliteDb.run("DELETE FROM expenses WHERE userId = ?", [userId], function(err) {
            callback(err, this.changes);
        });
    }
}

module.exports = { saveExpense, getDetailedSummary, getRecentText, clearDatabase };
