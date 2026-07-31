const fs = require('fs');
const path = require('path');
const { supabase } = require('./db');

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

    const { data: expenses, error: errExp } = await supabase
        .from('expenses')
        .select('*')
        .eq('userId', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

    if (errExp) return callback(errExp, null);
    if (!expenses || expenses.length === 0) return callback(new Error("No expenses found."), null);

    const { data: bData } = await supabase.from('budgets').select('amount').eq('userId', userId).single();
    const budget = bData ? bData.amount : null;
    const totalSpent = expenses.reduce((acc, r) => acc + r.amount, 0);

    const sanitizedUser = userId.replace(/[^a-z0-9]/gi, '_');
    const tempDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const csvPath = path.join(tempDir, `expenses_${sanitizedUser}_${timeframe}.csv`);
    
    const lines = [];
    lines.push(`Export Timeframe: ${timeframe}`);
    lines.push(`Total Spent: ₹${totalSpent.toFixed(2)}`);
    if (budget) lines.push(`Monthly Budget: ₹${budget.toFixed(2)}`);
    lines.push('');
    
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
        // Prepend UTF-8 BOM \uFEFF so Microsoft Excel opens rupee symbols & formatting natively
        const excelContent = '\uFEFF' + lines.join('\n');
        fs.writeFileSync(csvPath, excelContent, 'utf8');
        callback(null, csvPath);
    } catch (fsErr) {
        callback(fsErr, null);
    }
}

module.exports = { generateCSV };
