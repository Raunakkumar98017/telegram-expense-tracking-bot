const express = require('express');
const router = express.Router();
const {
    getAllExpenses,
    getMonthSpend,
    getLastMonthSpend,
    getTodaySpend,
    getYesterdaySpend,
    getBudget,
    getStreak,
    getDailyExpensesMap,
    getCustomRangeSpend,
    getAllExpensesBetween
} = require('../expenses');
const { generateWeeklyReport, generateSpendingHeatmap } = require('../reports');
const { getFinancialPersonality } = require('../personality');
const { verifyApiToken } = require('../auth');

// Protect all dashboard API endpoints with token verification
router.use(verifyApiToken);

/**
 * Helper to get default userId if query param missing
 */
function getUserId(req) {
    return req.query.userId || req.headers['x-user-id'] || null;
}

// 1. GET /api/summary - Dashboard Header KPIs
router.get('/summary', async (req, res) => {
    try {
        const userId = getUserId(req);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        let monthSpend = 0;
        let lastMonthSpend = 0;
        let todaySpend = 0;
        let yesterdaySpend = 0;
        
        if (startDate && endDate) {
            monthSpend = await getCustomRangeSpend(userId, startDate, endDate);
        } else {
            monthSpend = await getMonthSpend(userId);
            lastMonthSpend = await getLastMonthSpend(userId);
            todaySpend = await getTodaySpend(userId);
            yesterdaySpend = await getYesterdaySpend(userId);
        }

        const budget = (await getBudget(userId)) || 5000;
        const streak = await getStreak(userId);

        const budgetLeft = Math.max(0, budget - monthSpend);
        const burnRatePct = Math.min(100, Math.round((monthSpend / budget) * 100));

        let spentTrendText = null;
        let spentTrendDirection = 'up';
        if (!startDate && lastMonthSpend > 0) {
            const diffPct = (((monthSpend - lastMonthSpend) / lastMonthSpend) * 100).toFixed(1);
            spentTrendDirection = diffPct >= 0 ? 'up' : 'down';
            spentTrendText = `${Math.abs(diffPct)}% vs last mth`;
        }

        let todayTrendText = null;
        let todayTrendDirection = 'down';
        if (!startDate && yesterdaySpend > 0) {
            const diffPct = (((todaySpend - yesterdaySpend) / yesterdaySpend) * 100).toFixed(1);
            todayTrendDirection = diffPct >= 0 ? 'up' : 'down';
            todayTrendText = `${Math.abs(diffPct)}% vs Yesterday`;
        }

        res.json({
            success: true,
            totalSpent: monthSpend,
            budget,
            budgetLeft,
            todaySpend: startDate ? monthSpend : todaySpend, // If custom range, show total
            streak,
            burnRatePct,
            spentTrendText,
            spentTrendDirection,
            todayTrendText,
            todayTrendDirection
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET /api/trends - Charts data (Pie chart categories & Monthly line chart)
router.get('/trends', async (req, res) => {
    try {
        const userId = getUserId(req);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let expenses;
        if (startDate && endDate) {
            expenses = await getAllExpensesBetween(userId, startDate, endDate);
        } else {
            expenses = await getAllExpenses(userId, 500);
        }

        const now = new Date();
        const isLastMonth = req.query.catMonth === 'last';
        const targetMonth = isLastMonth ? now.getMonth() - 1 : now.getMonth();
        const targetYear = isLastMonth && targetMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const actualMonth = targetMonth < 0 ? 11 : targetMonth;

        // Category breakdown
        const categoryMap = {};
        expenses.forEach(e => {
            if (!e.date) return;
            if (startDate && endDate) {
                // Already filtered by DB
                categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
            } else {
                const d = new Date(e.date);
                if (d.getMonth() === actualMonth && d.getFullYear() === targetYear) {
                    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
                }
            }
        });

        // Monthly trend (by day)
        let dailyMap = {};
        if (startDate && endDate) {
            expenses.forEach(r => {
                if(r.date) {
                    dailyMap[r.date] = (dailyMap[r.date] || 0) + r.amount;
                }
            });
        } else {
            dailyMap = await getDailyExpensesMap(userId, 30);
        }

        res.json({
            success: true,
            categories: categoryMap,
            dailyTrend: dailyMap
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. GET /api/heatmap - Heatmap grid data
router.get('/heatmap', async (req, res) => {
    try {
        const userId = getUserId(req);
        const heatmapData = await generateSpendingHeatmap(userId);
        res.json({
            success: true,
            ...heatmapData
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. GET /api/report - Weekly AI Report
router.get('/report', async (req, res) => {
    try {
        const userId = getUserId(req);
        const report = await generateWeeklyReport(userId);
        res.json({
            success: true,
            report
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. GET /api/personality - Financial Personality
router.get('/personality', async (req, res) => {
    try {
        const userId = getUserId(req);
        const personality = await getFinancialPersonality(userId);
        res.json({
            success: true,
            personality
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. GET /api/expenses - Transaction history table & Excel export
router.get('/expenses', async (req, res) => {
    try {
        const userId = getUserId(req);
        const limit = parseInt(req.query.limit) || 200;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        
        let expenses;
        if (startDate && endDate) {
            expenses = await getAllExpensesBetween(userId, startDate, endDate);
        } else {
            expenses = await getAllExpenses(userId, limit);
        }

        if (req.query.export === 'excel' || req.query.export === 'csv') {
            res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=PennyAI_Expenses_${Date.now()}.csv`);
            
            // UTF-8 BOM so Microsoft Excel opens rupee symbols & formatting perfectly
            let content = '\uFEFFDate,Category,Description,Amount (INR)\n';
            expenses.forEach(e => {
                let cleanDate = String(e.date || '').split('T')[0];
                const parts = cleanDate.split('-');
                if (parts.length === 3) {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthIdx = parseInt(parts[1], 10) - 1;
                    if (monthIdx >= 0 && monthIdx < 12) {
                        cleanDate = `${parts[2]}-${months[monthIdx]}-${parts[0]}`;
                    }
                }
                const desc = (e.description || '').replace(/"/g, '""');
                content += `"${cleanDate}","${e.category}","${desc}",${e.amount}\n`;
            });

            return res.send(content);
        }

        res.json({
            success: true,
            expenses
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7. GET /api/receipts - Receipt gallery transactions
router.get('/receipts', async (req, res) => {
    try {
        const userId = getUserId(req);
        const expenses = await getAllExpenses(userId, 50);
        // Filter ONLY transactions logged via receipt scan
        const receipts = expenses.filter(e => e.description && (e.description.includes('[Receipt]') || e.description.toLowerCase().includes('receipt')));
        res.json({
            success: true,
            receipts: receipts
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
