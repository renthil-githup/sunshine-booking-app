// js/exportExcel.js

function generateExcel(reportType, metrics, breakdownData, dateStrContext) {
    if (typeof XLSX === 'undefined') {
        alert("Excel export library is loading. Please try again in a moment.");
        return;
    }

    const wb = XLSX.utils.book_new();
    const summaryData = [];

    // Header context
    summaryData.push(["Report Type", reportType.toUpperCase()]);
    summaryData.push(["Context range", dateStrContext]);
    summaryData.push([]); // spacing

    if (reportType === 'daily') {
        // Daily: Overall metrics + Staff summary
        summaryData.push(["OVERALL SUMMARY"]);
        summaryData.push(["Cash Total", metrics.cashTotal.toFixed(2)]);
        summaryData.push(["PayNow Total", metrics.payNowTotal.toFixed(2)]);
        summaryData.push(["Total Collected", metrics.totalCollected.toFixed(2)]);
        summaryData.push(["Total Bookings", metrics.totalBookings]);
        summaryData.push(["Packages", metrics.packageCount]);
        summaryData.push([]);
        
        // Daily: Grouped Staff Sessions instead of aggregated view
        const staffGroups = {};
        breakdownData.forEach(r => {
            let nStaff = window.Metrics.normalizeStaffName(r.staff) || 'Unknown';
            let capStaff = window.Metrics.capitalizeStaffName(nStaff);
            if (!staffGroups[capStaff]) staffGroups[capStaff] = [];
            staffGroups[capStaff].push(r);
        });
        
        const staffNames = Object.keys(staffGroups).sort();
        
        staffNames.forEach(staff => {
            summaryData.push([staff.toUpperCase()]);
            summaryData.push(["Time", "Amount", "Payment", "Booking Type"]);
            
            // Sort ascending by time
            staffGroups[staff].sort((a,b) => (a.time_in || '').localeCompare(b.time_in || ''));
            
            staffGroups[staff].forEach(r => {
                let amount = r.paymentMethod === 'Package' ? 'N/A' : r.amount.toFixed(2);
                summaryData.push([
                    r.time_in || '-',
                    amount,
                    r.paymentMethod,
                    r.type
                ]);
            });
            summaryData.push([]); // spacing after each staff
        });
    } 
    else if (reportType === 'weekly') {
        // Weekly: Staff Performance ONLY
        summaryData.push([`STAFF PERFORMANCE (${dateStrContext})`]);
        summaryData.push(["Staff Name", "Staff Booking", "Total Amount"]);
        
        metrics.staffBreakdown.forEach(s => {
            summaryData.push([
                s.name, 
                s.staffBooking, 
                s.totalCollected.toFixed(2) // Total Amount = Cash + PayNow
            ]);
        });
    } 
    else if (reportType === 'monthly') {
        // Monthly: Matrix Pivot table
        summaryData.push(["MONTHLY STAFF GRID"]);
        
        let headerRow = ["Date"];
        metrics.allStaffNames.forEach(staffName => {
            let capName = window.Metrics.capitalizeStaffName(staffName);
            headerRow.push(`${capName} Booking`);
            headerRow.push(`${capName} Amount`);
        });
        summaryData.push(headerRow);

        metrics.monthlyMatrixRows.forEach(row => {
            let dataRow = [row.date];
            metrics.allStaffNames.forEach(staffName => {
                const data = row[staffName] || { booking: 0, amount: 0 };
                dataRow.push(data.booking);
                dataRow.push(data.amount.toFixed(2));
            });
            summaryData.push(dataRow);
        });

        summaryData.push([]);
        summaryData.push(["MONTHLY BREAKDOWN"]);
        summaryData.push(["Date", "Cash", "PayNow", "Total", "Booking"]);
        
        breakdownData.forEach(d => {
            summaryData.push([
                d.date, 
                d.cash.toFixed(2), 
                d.payNow.toFixed(2), 
                d.totalCollected.toFixed(2), 
                d.booking
            ]);
        });
    }

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Auto-width columns slightly
    ws['!cols'] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // Dynamic filename
    let friendlyName = reportType === 'monthly' ? 'Monthly' : (reportType === 'weekly' ? 'Weekly' : 'Daily');
    let now = new Date();
    let filenameDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileName = `${friendlyName}_Report_${filenameDate}.xlsx`;

    XLSX.writeFile(wb, fileName);
}

window.ExportExcel = {
    generateExcel
};
