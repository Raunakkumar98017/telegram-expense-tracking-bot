const express = require('express');
const router = express.Router();
const {
    getAllExpenses,
    getMonthSpend,
    getTodaySpend,
    getBudget,
    getStreak,
    getDailyExpensesMap
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
        const monthSpend = await getMonthSpend(userId);
        const todaySpend = await getTodaySpend(userId);
        const budget = (await getBudget(userId)) || 5000;
        const streak = await getStreak(userId);

        const budgetLeft = Math.max(0, budget - monthSpend);
        const burnRatePct = Math.min(100, Math.round((monthSpend / budget) * 100));

        res.json({
            success: true,
            totalSpent: monthSpend,
            budget,
            budgetLeft,
            todaySpend,
            streak,
            burnRatePct
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. GET /api/trends - Charts data (Pie chart categories & Monthly line chart)
router.get('/trends', async (req, res) => {
    try {
        const userId = getUserId(req);
        const expenses = await getAllExpenses(userId, 200);

        // Category breakdown
        const categoryMap = {};
        expenses.forEach(e => {
            categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
        });

        // Monthly trend (by day)
        const dailyMap = await getDailyExpensesMap(userId, 30);

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

// 6. GET /api/expenses - Transaction history table
router.get('/expenses', async (req, res) => {
    try {
        const userId = getUserId(req);
        const limit = parseInt(req.query.limit) || 50;
        const expenses = await getAllExpenses(userId, limit);
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
        // Filter transactions with store or receipt notes
        const receipts = expenses.filter(e => e.description && (e.description.toLowerCase().includes('receipt') || e.description.toLowerCase().includes('mart') || e.description.toLowerCase().includes('store') || e.category === 'Groceries'));
        res.json({
            success: true,
            receipts: receipts.length > 0 ? receipts : expenses.slice(0, 6)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
