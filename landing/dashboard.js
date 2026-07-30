document.addEventListener('DOMContentLoaded', async () => {
    let donutChartInstance = null;
    let lineChartInstance = null;
    let gaugeChartInstance = null;

    // Get userId and user name from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId') || '';
    const userName = urlParams.get('name') || 'User';

    // Update Profile Display Header
    if (userName && userName !== 'User') {
        document.getElementById('user-greeting-name').innerText = userName;
        document.getElementById('user-profile-name').innerText = userName;
    }
    if (userId) {
        document.getElementById('user-profile-name').nextElementSibling.innerText = `ID: ${userId}`;
    }

    const queryParam = window.location.search || '';

    await loadDashboardData();

    // Export Handlers
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

    async function loadDashboardData() {
        try {
            // 1. Fetch Summary KPIs
            const resSummary = await fetch(`/api/summary${queryParam}`);
            const summary = await resSummary.json();

            if (summary.success) {
                document.getElementById('kpi-total-spent').innerText = `₹${summary.totalSpent.toFixed(2)}`;
                document.getElementById('kpi-budget-left').innerText = `₹${summary.budgetLeft.toFixed(2)}`;
                document.getElementById('kpi-today-spend').innerText = `₹${summary.todaySpend.toFixed(2)}`;
                document.getElementById('kpi-streak-days').innerText = `${summary.streak} Days`;
                
                document.getElementById('kpi-budget-pct').innerText = `${summary.burnRatePct}% of ₹${summary.budget.toLocaleString()}`;
                document.getElementById('kpi-budget-progress').style.width = `${Math.min(100, summary.burnRatePct)}%`;

                // Gauge Calculations
                const projected = summary.totalSpent * 1.25;
                const dailyAvg = summary.totalSpent / (new Date().getDate() || 1);

                document.getElementById('gauge-percent-text').innerText = `${summary.burnRatePct}%`;
                document.getElementById('gauge-monthly-budget').innerText = `₹${summary.budget.toLocaleString()}`;
                document.getElementById('gauge-projected-spend').innerText = `₹${Math.round(projected).toLocaleString()}`;
                document.getElementById('gauge-daily-avg').innerText = `₹${dailyAvg.toFixed(2)}`;

                renderBurnGauge(summary.burnRatePct);
            }

            // 2. Fetch Category & Trend Data for Charts
            const resTrends = await fetch(`/api/trends${queryParam}`);
            const trends = await resTrends.json();
            if (trends.success) {
                renderCategoryDonut(trends.categories);
                renderSpendingLineChart(trends.dailyTrend);
            }

            // 3. Fetch Weekly AI Report Insights
            const resReport = await fetch(`/api/report${queryParam}`);
            const reportData = await resReport.json();
            if (reportData.success && reportData.report) {
                const r = reportData.report;
                document.getElementById('rep-total-spent').innerText = `₹${r.weekTotal ? r.weekTotal.toFixed(2) : '0.00'}`;
                document.getElementById('rep-highest-cat').innerText = r.highestCategory || 'Food';
                document.getElementById('rep-top-exp').innerText = r.topExpense ? r.topExpense.description : 'Order';
                document.getElementById('rep-budget-used').innerText = `${r.budgetPct || 0}%`;

                document.getElementById('ai-speech-text').innerText = `"${r.aiAdvice || 'Keep tracking your daily expenses to stay in control!'}"`;
            }

            // 4. Fetch Financial Personality
            const resPers = await fetch(`/api/personality${queryParam}`);
            const persData = await resPers.json();
            if (persData.success && persData.personality) {
                const p = persData.personality;
                document.getElementById('p-hero-emoji').innerText = p.icon || '🦁';
                document.getElementById('p-hero-title').innerText = p.title || 'Big Spender';
                document.getElementById('p-hero-desc').innerText = p.description || '';
                document.getElementById('p-strengths-text').innerText = p.strength ? p.strength.replace('✔ ', '') : 'Generous';
                document.getElementById('p-weakness-text').innerText = p.weakness ? p.weakness.replace('✖ ', '') : 'Impulse buys';
                document.getElementById('p-recom-text').innerText = p.recommendation || 'Set weekly limits';
            }

            // 5. Fetch Heatmap Data
            const resHM = await fetch(`/api/heatmap${queryParam}`);
            const hmData = await resHM.json();
            if (hmData.success && hmData.dailyMap) {
                renderCalendarHeatmap(hmData.dailyMap);
            }

            // 6. Fetch Receipts Gallery
            const resRec = await fetch(`/api/receipts${queryParam}`);
            const recData = await resRec.json();
            if (recData.success) {
                renderReceiptsGallery(recData.receipts);
            }

            // 7. Fetch Recent Transactions
            const resExp = await fetch(`/api/expenses${queryParam}`);
            const expData = await resExp.json();
            if (expData.success) {
                document.getElementById('kpi-tx-count').innerText = expData.expenses.length;
                renderTransactionsTable(expData.expenses);
            }

        } catch (err) {
            console.error('Error loading dashboard data:', err);
        }
    }

    // --- DONUT CHART ---
    function renderCategoryDonut(categories) {
        const ctx = document.getElementById('categoryDonutChart').getContext('2d');
        const legendContainer = document.getElementById('donut-legend-container');
        legendContainer.innerHTML = '';

        const keys = Object.keys(categories);
        const values = Object.values(categories);

        if (keys.length === 0) {
            legendContainer.innerHTML = '<span class="text-muted" style="font-size:12px;">No categories logged yet.</span>';
            document.getElementById('donut-total-val').innerText = '₹0.00';
            if (donutChartInstance) donutChartInstance.destroy();
            return;
        }

        const totalSum = values.reduce((a, b) => a + b, 0);
        document.getElementById('donut-total-val').innerText = `₹${totalSum.toFixed(2)}`;

        const palette = ['#6c47ff', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#8b5cf6'];

        if (donutChartInstance) donutChartInstance.destroy();

        donutChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: keys,
                datasets: [{
                    data: values,
                    backgroundColor: palette.slice(0, keys.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });

        // Render custom legend
        keys.forEach((cat, idx) => {
            const val = values[idx];
            const pct = ((val / (totalSum || 1)) * 100).toFixed(1);
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <span class="lg-name">
                    <span class="lg-dot" style="background:${palette[idx % palette.length]}"></span>
                    ${cat}
                </span>
                <span class="lg-val">₹${val.toLocaleString()} (${pct}%)</span>
            `;
            legendContainer.appendChild(item);
        });
    }

    // --- LINE CHART ---
    function renderSpendingLineChart(dailyMap) {
        const ctx = document.getElementById('trendAreaChart').getContext('2d');
        const dates = Object.keys(dailyMap).sort();
        const amounts = dates.map(d => dailyMap[d]);

        if (lineChartInstance) lineChartInstance.destroy();

        const gradient = ctx.createLinearGradient(0, 0, 0, 180);
        gradient.addColorStop(0, 'rgba(108, 71, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(108, 71, 255, 0.0)');

        lineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Spend',
                    data: amounts,
                    borderColor: '#6c47ff',
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#6c47ff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
                    y: { grid: { color: '#e5e7eb' }, ticks: { color: '#9ca3af', font: { size: 10 } } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // --- BURN RATE SEMI-CIRCLE GAUGE ---
    function renderBurnGauge(percentage) {
        const ctx = document.getElementById('burnRateGaugeCanvas').getContext('2d');
        if (gaugeChartInstance) gaugeChartInstance.destroy();

        gaugeChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Remaining'],
                datasets: [{
                    data: [percentage, 100 - percentage],
                    backgroundColor: [
                        percentage > 90 ? '#ef4444' : (percentage > 75 ? '#f59e0b' : '#10b981'),
                        '#e5e7eb'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                cutout: '75%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }

    // --- CALENDAR HEATMAP ---
    function renderCalendarHeatmap(dailyMap) {
        const datesGrid = document.getElementById('heatmap-calendar-dates');
        datesGrid.innerHTML = '';

        const now = new Date();
        for (let i = 1; i <= 31; i++) {
            const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
            const amt = dailyMap[dateStr] || 0;

            let cls = 'gray';
            if (amt > 500) cls = 'red';
            else if (amt >= 200) cls = 'yellow';
            else if (amt > 0) cls = 'green';

            const circle = document.createElement('div');
            circle.className = `hm-circle ${cls}`;
            circle.title = `${dateStr}: ₹${amt}`;
            circle.innerText = i;
            datesGrid.appendChild(circle);
        }
    }

    // --- RECEIPTS GALLERY ---
    function renderReceiptsGallery(receipts) {
        const container = document.getElementById('receipts-gallery-scroll');
        container.innerHTML = '';

        if (!receipts || receipts.length === 0) {
            container.innerHTML = '<span class="text-muted" style="font-size:12px; padding: 10px 0;">No receipts logged yet. Upload a receipt photo to @MyKhataBot!</span>';
            return;
        }

        receipts.forEach(rc => {
            const paper = document.createElement('div');
            paper.className = 'receipt-paper-card';
            paper.innerHTML = `
                <div class="rc-paper-img"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                <span class="rc-store-title">${rc.description || rc.category}</span>
                <span class="rc-price">₹${rc.amount.toFixed(0)}</span>
                <span class="rc-date">${rc.date}</span>
            `;
            container.appendChild(paper);
        });
    }

    // --- TRANSACTIONS TABLE ---
    function renderTransactionsTable(expenses) {
        const tbody = document.getElementById('tx-rows-container');
        tbody.innerHTML = '';

        if (!expenses || expenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding:20px;">No transactions recorded yet. Send "spent 200 on lunch" in Telegram!</td></tr>';
            return;
        }

        expenses.forEach(tx => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tx.date}</td>
                <td><strong>${tx.description || tx.category}</strong></td>
                <td>${tx.category}</td>
                <td class="tx-amount-neg">- ₹${parseFloat(tx.amount).toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- EXPORT FUNCTIONS ---
    function exportCSV() {
        window.location.href = '/api/expenses?export=csv';
    }

    function exportPDF() {
        const element = document.getElementById('dashboard-export-area');
        const opt = {
            margin:       0.2,
            filename:     'MyKhataBot_Finance_Dashboard.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, backgroundColor: '#f8f9fc' },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    }
});
