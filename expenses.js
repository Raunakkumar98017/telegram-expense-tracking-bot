const { supabase } = require('./db');

// ─── EXPENSES ────────────────────────────────────────────────────────────────

async function saveExpense(userId, amount, category, date, description, groupId, callback) {
    const { data, error } = await supabase
        .from('expenses')
        .insert([{ userId, amount, category, date, description, groupId }])
        .select();
    if (error) return callback(error);
    callback(null, data[0].id);
}

async function deleteExpense(userId, expenseId, callback) {
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('userId', userId);
    callback(error);
}

async function getDetailedSummary(userId, range, callback) {
    let startDate = '1970-01-01';
    const now = new Date();
    if (range === 'today') {
        startDate = now.toISOString().split('T')[0];
    } else if (range === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff)).toISOString().split('T')[0];
    } else if (range === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (range === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }

    const { data: rawData, error } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('userId', userId)
        .gte('date', startDate);
    
    if (error) return callback("❌ Cloud Error.");
    
    const total = rawData.reduce((acc, r) => acc + r.amount, 0);
    const catMap = {};
    rawData.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });

    let reply = `📊 *Summary (${range.toUpperCase()})*\nTotal: ₹${total.toFixed(2)}\n`;
    if (Object.keys(catMap).length > 0) {
        reply += `\n*By Category:*`;
        Object.entries(catMap).sort((a,b) => b[1]-a[1]).forEach(([cat, amt]) => {
            reply += `\n- ${cat}: ₹${amt.toFixed(2)}`;
        });
    }
    callback(reply);
}

async function getMonthSpend(userId) {
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const { data } = await supabase.from('expenses').select('amount').eq('userId', userId).gte('date', startDate);
    return data ? data.reduce((acc, r) => acc + r.amount, 0) : 0;
}

async function getWeeklySummaryText(userId) {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startDate = new Date(now.setDate(diff)).toISOString().split('T')[0];

    const { data } = await supabase.from('expenses').select('category, amount').eq('userId', userId).gte('date', startDate);
    if (!data || data.length === 0) return 'No expenses this week.';
    const total = data.reduce((acc, r) => acc + r.amount, 0);
    const catMap = {};
    data.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
    let text = `Total: ₹${total.toFixed(2)}\n`;
    Object.entries(catMap).forEach(([cat, amt]) => { text += `${cat}: ₹${amt.toFixed(2)}\n`; });
    return text;
}

async function getRecentText(userId, callback) {
    const { data, error } = await supabase.from('expenses').select('*').eq('userId', userId).order('date', { ascending: false }).order('id', { ascending: false }).limit(5);
    if (error) return callback("❌ Cloud Error.");
    if (!data || data.length === 0) return callback("No expenses yet! Try: _spent 200 on lunch_");
    let reply = "*📝 Recent Expenses:*\n";
    data.forEach(row => { reply += `• ₹${row.amount.toFixed(2)} - ${row.category} (${row.date})\n  _${row.description}_\n`; });
    callback(reply);
}

async function clearDatabase(userId, callback) {
    const { error } = await supabase.from('expenses').delete().eq('userId', userId);
    callback(error, '?');
}

// ─── BUDGETS ─────────────────────────────────────────────────────────────────

async function setBudget(userId, amount, callback) {
    const { error } = await supabase.from('budgets').upsert([{ userId, amount, updated_at: new Date().toISOString() }]);
    callback(error);
}

async function getBudget(userId, callback) {
    const { data } = await supabase.from('budgets').select('amount').eq('userId', userId).single();
    callback(null, data ? data.amount : null);
}

async function getGroupSplit(groupId, callback) {
    const { data, error } = await supabase
        .from('expenses')
        .select('userId, amount')
        .eq('groupId', groupId);
    
    if (error) return callback(error);
    if (!data || data.length === 0) return callback(null, "No group expenses yet!");

    const totals = {};
    let grandTotal = 0;
    data.forEach(ex => {
        totals[ex.userId] = (totals[ex.userId] || 0) + ex.amount;
        grandTotal += ex.amount;
    });

    const users = Object.keys(totals);
    const perPerson = grandTotal / users.length;

    let reply = `👥 *Group Khata Split*\n`;
    reply += `Total Spent: ₹${grandTotal.toFixed(2)}\n`;
    reply += `Per Person: ₹${perPerson.toFixed(2)}\n\n`;

    users.forEach(uid => {
        const paid = totals[uid];
        const balance = paid - perPerson;
        const status = balance >= 0 ? `gets back ₹${balance.toFixed(2)}` : `owes ₹${Math.abs(balance).toFixed(2)}`;
        reply += `• <ID:${uid}>: Paid ₹${paid.toFixed(2)} (${status})\n`;
    });

    callback(null, reply);
}

module.exports = { saveExpense, deleteExpense, getDetailedSummary, getRecentText, clearDatabase, setBudget, getBudget, getMonthSpend, getWeeklySummaryText, getGroupSplit };
