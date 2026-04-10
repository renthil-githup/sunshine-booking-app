// js/components.js

function createDashboardHTML(metrics) {
    return `
        <div class="dashboard-grid">
            <div class="stat-box">
                <h3>Total Collected</h3>
                <div class="stat-value text-money">$${metrics.totalCollected.toFixed(2)}</div>
            </div>
            <div class="stat-box">
                <h3>Total Bookings</h3>
                <div class="stat-value text-booking">${metrics.totalBookings}</div>
            </div>
            <div class="stat-box">
                <h3>Cash</h3>
                <div class="stat-value text-money">$${metrics.cashTotal.toFixed(2)}</div>
            </div>
            <div class="stat-box">
                <h3>PayNow</h3>
                <div class="stat-value text-money">$${metrics.payNowTotal.toFixed(2)}</div>
            </div>
            <div class="stat-box">
                <h3>Packages</h3>
                <div class="stat-value text-package">${metrics.packageCount}</div>
            </div>
        </div>
    `;
}

function createDailyStaffSessionsHTML(records) {
    if (records.length === 0) return `<p style="color:var(--text-secondary); text-align:center;">No records data.</p>`;

    // Group by normalized and capitalized staff
    const staffGroups = {};
    records.forEach(r => {
        let nStaff = window.Metrics.normalizeStaffName(r.staff) || 'Unknown';
        let capStaff = window.Metrics.capitalizeStaffName(nStaff);
        if (!staffGroups[capStaff]) staffGroups[capStaff] = [];
        staffGroups[capStaff].push(r);
    });

    let html = '';
    
    // Sort staff names alphabetically
    const staffNames = Object.keys(staffGroups).sort();
    
    staffNames.forEach(staff => {
        html += `<div class="card table-responsive" style="margin-bottom: 20px;">`;
        html += `<h2 style="text-transform: uppercase;">${staff}</h2>`;
        html += `<table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Amount</th>
                            <th>Payment</th>
                            <th>Booking Type</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        // sort by time ascending
        staffGroups[staff].sort((a,b) => (a.time_in || '').localeCompare(b.time_in || ''));
        
        staffGroups[staff].forEach(r => {
            const amtDisp = r.paymentMethod === 'Package' ? 'N/A' : `$${r.amount.toFixed(2)}`;
            html += `
                <tr>
                    <td>${r.time_in || '-'}</td>
                    <td class="text-money">${amtDisp}</td>
                    <td>${r.paymentMethod}</td>
                    <td>${r.type}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
    });

    return html;
}

function createWeeklyTableHTML(staffList, startDate, endDate) {
    if (staffList.length === 0) return `<p style="color:var(--text-secondary); text-align:center;">No staff data.</p>`;

    let sStr = new Date(startDate).toLocaleDateString('en-GB'); // DD/MM/YYYY approx
    let eStr = new Date(endDate).toLocaleDateString('en-GB');

    let html = `
    <div class="table-responsive card">
        <h2 style="font-size:1.1rem;">STAFF PERFORMANCE (${sStr} - ${eStr})</h2>
        <table>
            <thead>
                <tr>
                    <th>Staff</th>
                    <th>Staff Booking</th>
                    <th>Total Amount</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    staffList.forEach(s => {
        html += `
            <tr>
                <td>${s.name}</td>
                <td class="text-booking">${s.staffBooking}</td>
                <td class="text-money" style="font-weight:700;">$${s.totalCollected.toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    return html;
}

function createMonthlyGridHTML(monthlyMatrixRows, allStaffNames) {
    if (monthlyMatrixRows.length === 0) return `<p style="color:var(--text-secondary); text-align:center;">No monthly data.</p>`;

    let html = `
    <div class="table-responsive card">
        <h2>Monthly Staff Grid</h2>
        <table style="white-space: nowrap;">
            <thead>
                <tr>
                    <th>Date</th>
    `;

    // Dynamic headers based on alphabetically sorted unique staff
    allStaffNames.forEach(staffName => {
        let capName = window.Metrics.capitalizeStaffName(staffName);
        html += `<th>${capName} Booking</th><th>${capName} Amount</th>`;
    });

    html += `</tr></thead><tbody>`;

    // Rows by date
    monthlyMatrixRows.forEach(row => {
        html += `<tr><td>${row.date}</td>`;
        allStaffNames.forEach(staffName => {
            const data = row[staffName] || { booking: 0, amount: 0 };
            html += `
                <td class="text-booking">${data.booking}</td>
                <td class="text-money">$${data.amount.toFixed(2)}</td>
            `;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

window.Components = {
    createDashboardHTML,
    createDailyStaffSessionsHTML,
    createWeeklyTableHTML,
    createMonthlyGridHTML
};
