// js/screens/reports.js

let currentReportType = 'daily';
let selectedDailyDate = new Date().toISOString().split('T')[0];

let customStartDate = '';
let customEndDate = '';

function initDefaultDates() {
    // defaults
    const now = new Date();
    
    // This Week (Mon-Sun)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    // This Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
        thisWeekStart: monday.toISOString().split('T')[0],
        thisWeekEnd: sunday.toISOString().split('T')[0],
        thisMonthStart: startOfMonth.toISOString().split('T')[0],
        thisMonthEnd: endOfMonth.toISOString().split('T')[0],
        today: new Date().toISOString().split('T')[0]
    };
}

function renderReportsScreen(container) {
    const dates = initDefaultDates();

    // Default inject based on mode if empty
    if (currentReportType === 'weekly' && !customStartDate) {
        customStartDate = dates.thisWeekStart;
        customEndDate = dates.thisWeekEnd;
    } else if (currentReportType === 'monthly' && !customStartDate) {
        customStartDate = dates.thisMonthStart;
        customEndDate = dates.thisMonthEnd;
    }

    let html = `
        <div class="header-flex">
            <h2>Reports</h2>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-export" style="background-color:var(--text-secondary);" onclick="ReportsScreen.resetView()">
                    <i data-lucide="refresh-cw"></i>
                    Reset View
                </button>
                <button class="btn btn-export" onclick="ReportsScreen.handleExport()">
                    <i data-lucide="download"></i>
                    Export Excel
                </button>
                <button id="btn-telegram" class="btn btn-export" style="background-color:#0088cc; color: white;" onclick="ReportsScreen.handleSendTelegram()">
                    <i data-lucide="send"></i>
                    Send to Telegram
                </button>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab-btn ${currentReportType === 'daily' ? 'active' : ''}" onclick="ReportsScreen.setTab('daily')">Daily</button>
            <button class="tab-btn ${currentReportType === 'weekly' ? 'active' : ''}" onclick="ReportsScreen.setTab('weekly')">Weekly</button>
            <button class="tab-btn ${currentReportType === 'monthly' ? 'active' : ''}" onclick="ReportsScreen.setTab('monthly')">Monthly</button>
        </div>
    `;

    // Filters UI
    if (currentReportType === 'daily') {
        html += `
            <div style="margin-bottom: 20px; display:flex; gap:10px; align-items:center;">
                <label>Date:</label>
                <input type="date" value="${selectedDailyDate}" onchange="ReportsScreen.setDailyDate(this.value)" style="width: auto;">
            </div>
        `;
    } else {
        html += `
            <div style="margin-bottom: 10px; display:flex; gap:10px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <label>Start:</label>
                    <input type="date" value="${customStartDate}" onchange="ReportsScreen.setCustomDate('start', this.value)" style="width: 130px;">
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <label>End:</label>
                    <input type="date" value="${customEndDate}" onchange="ReportsScreen.setCustomDate('end', this.value)" style="width: 130px;">
                </div>
            </div>
            <div style="margin-bottom: 20px; display:flex; gap:10px; font-size: 0.85rem;">
                <button class="btn" style="padding: 6px; width:auto;" onclick="ReportsScreen.applyShortcut('thisWeek')">This Week</button>
                <button class="btn" style="padding: 6px; width:auto;" onclick="ReportsScreen.applyShortcut('last7')">Last 7 Days</button>
                <button class="btn" style="padding: 6px; width:auto;" onclick="ReportsScreen.applyShortcut('thisMonth')">This Month</button>
            </div>
        `;
    }

    html += `<div id="report-content"></div>`;
    
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
    
    renderReportContent();
}

function setDailyDate(val) {
    selectedDailyDate = val;
    renderReportContent();
}

function setCustomDate(type, val) {
    if (type === 'start') customStartDate = val;
    if (type === 'end') customEndDate = val;
    renderReportContent();
}

function applyShortcut(shortcut) {
    const dates = initDefaultDates();
    if (shortcut === 'thisWeek') {
        customStartDate = dates.thisWeekStart;
        customEndDate = dates.thisWeekEnd;
    } else if (shortcut === 'thisMonth') {
        customStartDate = dates.thisMonthStart;
        customEndDate = dates.thisMonthEnd;
    } else if (shortcut === 'last7') {
        const d = new Date();
        const e = new Date();
        d.setDate(e.getDate() - 6);
        customStartDate = d.toISOString().split('T')[0];
        customEndDate = e.toISOString().split('T')[0];
    }
    renderReportsScreen(document.getElementById('main-content'));
}

function renderReportContent() {
    const contentDiv = document.getElementById('report-content');
    if (!contentDiv) return;

    const allRecords = Data.getRecords();
    let filteredRecords = [];

    if (currentReportType === 'daily') {
        filteredRecords = Metrics.filterRecordsByDateRange(allRecords, 'daily', null, null, selectedDailyDate);
    } else {
        filteredRecords = Metrics.filterRecordsByDateRange(allRecords, 'manual', customStartDate, customEndDate);
    }

    const metrics = Metrics.computeMetrics(filteredRecords);
    let html = "";
    
    if (currentReportType === 'daily') {
        html += Components.createDashboardHTML(metrics);
        html += Components.createDailyStaffSessionsHTML(filteredRecords);
        // REMOVE breakdown section completely for daily per instructions
    } else if (currentReportType === 'weekly') {
        // Do NOT show dashboard/extra cards
        html += Components.createWeeklyTableHTML(metrics.staffBreakdown, customStartDate, customEndDate);
        // Do NOT show breakdown per instructions
    } else if (currentReportType === 'monthly') {
        // Dashboard can remain for Monthly unless specified, user didn't explicitly forbid formatting cards for Monthly, but they did say Weekly: "Do NOT show dashboard". I will omit dashboard for monthly too to be clean.
        // Wait: User said "KEEP: Monthly breakdown section below."
        html += Components.createMonthlyGridHTML(metrics.monthlyMatrixRows, metrics.allStaffNames);
        
        // Breakdown Table (Monthly)
        html += `<div class="card table-responsive"><h2>Monthly Breakdown</h2><table>`;
        html += `
            <thead><tr><th>Date</th><th>Cash</th><th>PayNow</th><th>Total</th><th>Booking</th></tr></thead>
            <tbody>
        `;
        const breakdown = Metrics.getDailyBreakdown(filteredRecords);
        breakdown.forEach(d => {
            html += `<tr>
                <td>${d.date}</td>
                <td class="text-money">$${d.cash.toFixed(2)}</td>
                <td class="text-money">$${d.payNow.toFixed(2)}</td>
                <td class="text-money">$${d.totalCollected.toFixed(2)}</td>
                <td class="text-booking">${d.booking}</td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
    }

    contentDiv.innerHTML = html;
}

function setTab(tab) {
    currentReportType = tab;
    // reset manual states so they grab defaults
    customStartDate = '';
    customEndDate = '';
    renderReportsScreen(document.getElementById('main-content'));
}

function handleExport() {
    const allRecords = Data.getRecords();
    let filteredRecords = [];
    if (currentReportType === 'daily') {
        filteredRecords = Metrics.filterRecordsByDateRange(allRecords, 'daily', null, null, selectedDailyDate);
    } else {
        filteredRecords = Metrics.filterRecordsByDateRange(allRecords, 'manual', customStartDate, customEndDate);
    }
    
    const metrics = Metrics.computeMetrics(filteredRecords);
    let breakdownData = [];
    if (currentReportType === 'monthly') {
        breakdownData = Metrics.getDailyBreakdown(filteredRecords);
    } else if (currentReportType === 'daily') {
        breakdownData = filteredRecords;
    }
    
    let dateStrContext = currentReportType === 'daily' ? selectedDailyDate : `${customStartDate} to ${customEndDate}`;

    ExportExcel.generateExcel(currentReportType, metrics, breakdownData, dateStrContext);
}

function resetView() {
    currentReportType = 'daily';
    selectedDailyDate = new Date().toISOString().split('T')[0];
    customStartDate = '';
    customEndDate = '';
    renderReportsScreen(document.getElementById('main-content'));
}

// Telegram Logic
function formatTelegramDate(ymd) {
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length !== 3) return ymd;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function handleSendTelegram() {
    const btn = document.getElementById('btn-telegram');
    if (btn.disabled) return;

    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader"></i> Sending...';
    if (window.lucide) lucide.createIcons();

    let wakeupTimer = setTimeout(() => {
        if (btn.disabled) {
            btn.innerHTML = '<i data-lucide="loader"></i> Backend waking up...';
            if (window.lucide) lucide.createIcons();
        }
    }, 5000);

    try {
        const allRecords = Data.getRecords();
        let filteredRecords = [];
        let dateRangeStr = '';
        
        if (currentReportType === 'daily') {
            filteredRecords = Metrics.filterRecordsByDateRange(allRecords, 'daily', null, null, selectedDailyDate);
            dateRangeStr = formatTelegramDate(selectedDailyDate);
        } else {
            filteredRecords = Metrics.filterRecordsByDateRange(allRecords, 'manual', customStartDate, customEndDate);
            dateRangeStr = `${formatTelegramDate(customStartDate)} to ${formatTelegramDate(customEndDate)}`;
        }
        
        const metrics = Metrics.computeMetrics(filteredRecords);
        let reportText = '';

        if (filteredRecords.length === 0) {
            reportText = `No records found for ${currentReportType === 'monthly' ? 'selected monthly range' : dateRangeStr}`;
        } else {
            let title = '';
            if (currentReportType === 'daily') title = `Daily Report - ${dateRangeStr}`;
            else if (currentReportType === 'weekly') title = `Weekly Report - ${dateRangeStr}`;
            else if (currentReportType === 'monthly') title = `Monthly Report - ${dateRangeStr}`;

            const tCounts = { Booking: 0, Shop: 0, ShopB: 0, 'Walk-in': 0 };
            filteredRecords.forEach(r => {
                if (r.type === 'Staff') tCounts.Booking++;
                else if (r.type === 'Shop') tCounts.Shop++;
                else if (r.type === 'ShopB') tCounts.ShopB++;
                else if (r.type === 'Walk-in') tCounts['Walk-in']++;
            });

            reportText += `${title}\n\n`;
            reportText += `Total Collected: $${metrics.totalCollected}\n`;
            reportText += `Cash: $${metrics.cashTotal}\n`;
            reportText += `PayNow: $${metrics.payNowTotal}\n`;
            reportText += `Total Bookings: ${metrics.totalBookings}\n`;
            reportText += `Booking: ${tCounts.Booking}\n`;
            reportText += `Shop: ${tCounts.Shop}\n`;
            reportText += `ShopB: ${tCounts.ShopB}\n`;
            reportText += `Walk-in: ${tCounts['Walk-in']}\n`;
            reportText += `Package Count: ${metrics.packageCount}\n\n`;

            if (currentReportType === 'daily') {
                reportText += `Staff Summary:\n`;
                metrics.staffBreakdown.forEach(s => {
                    reportText += `${s.name} | Booking: ${s.booking} | Cash: ${s.cash} | PayNow: ${s.payNow} | Total: ${s.totalCollected}\n`;
                });
            } else if (currentReportType === 'weekly') {
                reportText += `Staff Performance:\n`;
                metrics.staffBreakdown.forEach(s => {
                    reportText += `${s.name} | Staff Booking: ${s.staffBooking} | Total Amount: ${s.totalCollected}\n`;
                });
            } else if (currentReportType === 'monthly') {
                reportText += `Monthly Staff Performance:\n`;
                metrics.staffBreakdown.forEach(s => {
                    reportText += `${s.name} | Staff Booking: ${s.staffBooking || s.booking} | Total Amount: ${s.totalCollected}\n`;
                });

                reportText += `\nMonthly Cash Flow Summary:\n`;
                const dailyBreakdown = window.Metrics.getDailyBreakdown(filteredRecords);
                dailyBreakdown.forEach(d => {
                    reportText += `${formatTelegramDate(d.date)} | PayNow: ${d.payNow} | Cash: ${d.cash} | Total: ${d.totalCollected}\n`;
                });
            }
        }

        const backendUrl = (window.Config && window.Config.API_BASE_URL) ? window.Config.API_BASE_URL : 'http://localhost:3000';
        
        const response = await fetch(`${backendUrl}/send-telegram-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report_type: currentReportType,
                report_range: dateRangeStr,
                report_text: reportText
            })
        });

        clearTimeout(wakeupTimer);

        const result = await response.json();
        
        if (result.success) {
            btn.innerHTML = '<i data-lucide="check-circle"></i> Successfully Sent!';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                if (window.lucide) lucide.createIcons();
            }, 3000);
        } else {
            throw new Error(result.error || 'Failed to send');
        }

    } catch (err) {
        console.error(err);
        if (typeof wakeupTimer !== 'undefined') clearTimeout(wakeupTimer);
        btn.innerHTML = `<i data-lucide="alert-circle"></i> ${err.message}`;
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }, 5000);
    }
}

window.ReportsScreen = {
    render: renderReportsScreen,
    setTab,
    setDailyDate,
    setCustomDate,
    applyShortcut,
    handleExport,
    resetView,
    handleSendTelegram
};
