const { supabase } = require('./db');

// ─── EXPENSES ────────────────────────────────────────────────────────────────

async function saveExpense(userId, amount, category, date, description, groupId, callback) {
    const { data, error } = await supabase
        .from('expenses')
        .insert([{ userId, amount, category, date, description, groupId }])
        .select();
    if (error) {
        if (callback) return callback(error);
        throw error;
    }
    if (callback) callback(null, data[0].id);
    return data[0].id;
}

async function deleteExpense(userId, expenseId, callback) {
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('userId', userId);
    if (callback) callback(error);
    return error;
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
    
    if (error) {
        if (callback) return callback("❌ Cloud Error.");
        throw error;
    }
    
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
    if (callback) callback(reply);
    return { total, catMap, reply };
}

async function getMonthSpend(userId) {
    const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const { data } = await supabase.from('expenses').select('amount').eq('userId', userId).gte('date', startDate);
    return data ? data.reduce((acc, r) => acc + r.amount, 0) : 0;
}

async function getLastMonthSpend(userId) {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const { data } = await supabase.from('expenses').select('amount').eq('userId', userId).gte('date', firstDayLastMonth).lte('date', lastDayLastMonth);
    return data ? data.reduce((acc, r) => acc + r.amount, 0) : 0;
}

async function getTodaySpend(userId) {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('expenses').select('amount').eq('userId', userId).eq('date', todayStr);
    return data ? data.reduce((acc, r) => acc + r.amount, 0) : 0;
}

async function getYesterdaySpend(userId) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yestStr = yesterday.toISOString().split('T')[0];
    const { data } = await supabase.from('expenses').select('amount').eq('userId', userId).eq('date', yestStr);
    return data ? data.reduce((acc, r) => acc + r.amount, 0) : 0;
}

async function getWeeklySummaryText(userId) {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startDate = new Date(now.setDate(diff)).toISOString().split('T')[0];

    const { data } = await supabase.from('expenses').select('category, amount, description').eq('userId', userId).gte('date', startDate);
    if (!data || data.length === 0) return 'No expenses logged this week.';
    const total = data.reduce((acc, r) => acc + r.amount, 0);
    const catMap = {};
    data.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
    let text = `Total: ₹${total.toFixed(2)}\nCategories:\n`;
    Object.entries(catMap).forEach(([cat, amt]) => { text += `- ${cat}: ₹${amt.toFixed(2)}\n`; });
    return text;
}

async function getRecentText(userId, callback) {
    const { data, error } = await supabase.from('expenses').select('*').eq('userId', userId).order('date', { ascending: false }).order('id', { ascending: false }).limit(5);
    if (error) {
        if (callback) return callback("❌ Cloud Error.");
        throw error;
    }
    if (!data || data.length === 0) {
        const msg = "No expenses yet! Try: _spent 200 on lunch_";
        if (callback) return callback(msg);
        return msg;
    }
    let reply = "*📝 Recent Expenses:*\n";
    data.forEach(row => { reply += `• ₹${row.amount.toFixed(2)} - ${row.category} (${row.date})\n  _${row.description}_\n`; });
    if (callback) callback(reply);
    return reply;
}

async function getAllExpenses(userId, limit = 50) {
    const query = supabase.from('expenses').select('*');
    if (userId) query.eq('userId', userId);
    const { data } = await query.order('date', { ascending: false }).order('id', { ascending: false }).limit(limit);
    return data || [];
}

async function getDailyExpensesMap(userId, days = 30) {
    const now = new Date();
    const pastDate = new Date(now.setDate(now.getDate() - days)).toISOString().split('T')[0];
    const query = supabase.from('expenses').select('date, amount');
    if (userId) query.eq('userId', userId);
    const { data } = await query.gte('date', pastDate);

    const dailyMap = {};
    if (data) {
        data.forEach(r => {
            dailyMap[r.date] = (dailyMap[r.date] || 0) + r.amount;
        });
    }
    return dailyMap;
}

async function getStreak(userId) {
    const { data } = await supabase.from('expenses').select('date').eq('userId', userId).order('date', { ascending: false });
    if (!data || data.length === 0) return 0;
    
    const uniqueDates = [...new Set(data.map(d => d.date))];
    let streak = 0;
    let checkDate = new Date();
    
    for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (uniqueDates.includes(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Allow today to be missing if checked early in the morning
            if (i === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }
            break;
        }
    }
    return streak;
}

async function getUsersList() {
    const { data } = await supabase.from('expenses').select('userId');
    if (!data) return [];
    return [...new Set(data.map(d => d.userId))];
}

async function clearDatabase(userId, callback) {
    const { error, count } = await supabase.from('expenses').delete().eq('userId', userId);
    if (callback) callback(error, count || 0);
    return { error, count };
}

// ─── BUDGETS ─────────────────────────────────────────────────────────────────

async function setBudget(userId, amount, callback) {
    const { error } = await supabase.from('budgets').upsert([{ userId, amount, updated_at: new Date().toISOString() }]);
    if (callback) callback(error);
    return error;
}

async function getBudget(userId, callback) {
    const { data } = await supabase.from('budgets').select('amount').eq('userId', userId).single();
    const bAmount = data ? data.amount : null;
    if (callback) callback(null, bAmount);
    return bAmount;
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
    const perPerson = grandTotal / (users.length || 1);

    let reply = `👥 *Group Khata Split*\n`;
    reply += `Total Spent: ₹${grandTotal.toFixed(2)}\n`;
    reply += `Per Person: ₹${perPerson.toFixed(2)}\n\n`;

    users.forEach(uid => {
        const paid = totals[uid];
        const balance = paid - perPerson;
        const status = balance >= 0 ? `gets back ₹${balance.toFixed(2)}` : `owes ₹${Math.abs(balance).toFixed(2)}`;
        reply += `• User <${uid}>: Paid ₹${paid.toFixed(2)} (${status})\n`;
    });

    callback(null, reply);
}

module.exports = {
    saveExpense,
    deleteExpense,
    getDetailedSummary,
    getRecentText,
    clearDatabase,
    setBudget,
    getBudget,
    getMonthSpend,
    getLastMonthSpend,
    getTodaySpend,
    getYesterdaySpend,
    getWeeklySummaryText,
    getGroupSplit,
    getAllExpenses,
    getDailyExpensesMap,
    getStreak,
    getUsersList
};
