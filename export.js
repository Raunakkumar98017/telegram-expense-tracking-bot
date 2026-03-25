const fs = require('fs');
const path = require('path');
const { supabase } = require('./db');

// Start dates for different timeframes
function getTimeframeBounds(timeframe) {
    const now = new Date();
    let startDate = '1970-01-01';
    let endDate = '2100-01-01';

    if (timeframe === 'this_week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff)).toISOString().split('T')[0];
    } else if (timeframe === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (timeframe === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (timeframe === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    return { startDate, endDate };
}

async function generateCSV(userId, timeframe, callback) {
    const { startDate, endDate } = getTimeframeBounds(timeframe);

    // Fetch expenses
    const { data: expenses, error: errExp } = await supabase
        .from('expenses')
        .select('*')
        .eq('userId', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

    if (errExp) return callback(errExp, null);
    if (!expenses || expenses.length === 0) return callback(new Error("No expenses found."), null);

    // Fetch budget 
    const { data: bData } = await supabase.from('budgets').select('amount').eq('userId', userId).single();
    const budget = bData ? bData.amount : null;

    // Calculate total
    const totalSpent = expenses.reduce((acc, r) => acc + r.amount, 0);

    const sanitizedUser = userId.replace(/[^a-z0-9]/gi, '_');
    const csvPath = path.join(__dirname, `expenses_${sanitizedUser}_${timeframe}.csv`);
    
    // We'll write the CSV manually to include the summary at the top
    const lines = [];
    lines.push(`Export Timeframe: ${timeframe}`);
    lines.push(`Total Spent: ₹${totalSpent.toFixed(2)}`);
    if (budget) lines.push(`Monthly Budget: ₹${budget.toFixed(2)}`);
    lines.push(''); // Blank row
    
    // Data rows
    const headers = ["ID", "Date", "Amount", "Category", "Description"];
    lines.push(headers.join(','));
    
    expenses.forEach(row => {
        const line = [
            row.id,
            row.date,
            row.amount.toFixed(2),
            `"${row.category}"`,
            `"${(row.description || '').replace(/"/g, '""')}"`
        ];
        lines.push(line.join(','));
    });

    try {
        fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
        callback(null, csvPath);
    } catch (fsErr) {
        callback(fsErr, null);
    }
}

module.exports = { generateCSV };
