// js/metrics.js

function getStartOfDay(dateString) {
    const d = new Date(dateString);
    d.setHours(0,0,0,0);
    return d;
}

// Helpers
function normalizeStaffName(name) {
    return name ? name.toString().trim().toLowerCase() : '';
}

function capitalizeStaffName(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function computeMetrics(records, targetFilters = {}) {
    // This function returns multiple structures useful for different views
    let cashTotal = 0;
    let payNowTotal = 0;
    let totalCollected = 0;
    let totalBookings = records.length;
    let staffCount = 0;
    let shopCount = 0;
    let walkInCount = 0;
    let packageCount = 0;

    let staffDailyDict = {}; // staffName -> { booking, cash, payNow, totalCollected, timeSlots }
    let monthlyMatrix = {};   // date -> { staffName -> {booking, amount} }
    let uniqueStaffSet = new Set();

    records.forEach(r => {
        // Core tracking
        if (r.type === 'Staff') staffCount++;
        else if (r.type === 'Shop') shopCount++;
        else if (r.type === 'Walk-in') walkInCount++;

        let isPackage = (r.paymentMethod === 'Package');
        let validAmount = isPackage ? 0 : r.amount;

        if (isPackage) {
            packageCount++;
        } else {
            if (r.paymentMethod === 'Cash') cashTotal += validAmount;
            else if (r.paymentMethod === 'PayNow') payNowTotal += validAmount;
            totalCollected += validAmount;
        }

        const normStaff = normalizeStaffName(r.staff);

        if (normStaff) {
            uniqueStaffSet.add(normStaff);
            
            // 1. Daily/Weekly Logic Map
            if (!staffDailyDict[normStaff]) {
                staffDailyDict[normStaff] = { 
                    name: capitalizeStaffName(normStaff),
                    rawName: normStaff,
                    booking: 0,
                    cash: 0,
                    payNow: 0,
                    totalCollected: 0,
                    timeSlots: [],
                    staffBooking: 0, // specific just for staff bookings not counting packages
                };
            }

            if (r.type === 'Staff') {
                staffDailyDict[normStaff].booking++;
                // In Weekly we show "Staff Booking" and the rule is to count it if it's 'Staff'
                // Wait: User said "Weekly report must show ONLY: Staff Booking... Total Amount... Rules: Do NOT include Shop, ShopB, Walk-in". Package money is 0 anyway so it won't impact Amount.
                // Wait: Did they restrict Package from Staff Booking count?
                // Rule 6: "Package counts as booking activity but NOT as money".
                staffDailyDict[normStaff].staffBooking++; 
            }
            
            if (r.time_in && r.time_out) {
                staffDailyDict[normStaff].timeSlots.push(`${r.time_in}-${r.time_out}`);
            }

            if (r.paymentMethod === 'Cash') {
                staffDailyDict[normStaff].cash += validAmount;
                staffDailyDict[normStaff].totalCollected += validAmount;
            } else if (r.paymentMethod === 'PayNow') {
                staffDailyDict[normStaff].payNow += validAmount;
                staffDailyDict[normStaff].totalCollected += validAmount;
            }

            // 2. Monthly Matrix Map (Row = Date)
            if (!monthlyMatrix[r.date]) {
                monthlyMatrix[r.date] = { date: r.date };
            }
            if (!monthlyMatrix[r.date][normStaff]) {
                monthlyMatrix[r.date][normStaff] = { booking: 0, amount: 0 };
            }
            
            if (r.type === 'Staff') {
                monthlyMatrix[r.date][normStaff].booking++;
            }
            monthlyMatrix[r.date][normStaff].amount += validAmount;
        }
    });

    Object.values(staffDailyDict).forEach(s => {
        s.timeSlots.sort((a, b) => a.localeCompare(b));
    });

    // Sort unique staff alphabetically for matrix columns
    const allStaffNames = Array.from(uniqueStaffSet).sort();

    // Sort monthly rows earliest to latest
    const monthlyMatrixRows = Object.values(monthlyMatrix).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
        cashTotal,
        payNowTotal,
        totalCollected,
        totalBookings,
        staffCount,
        shopCount,
        walkInCount,
        packageCount,
        staffBreakdown: Object.values(staffDailyDict).sort((a,b) => a.name.localeCompare(b.name)),
        monthlyMatrixRows: monthlyMatrixRows,
        allStaffNames: allStaffNames
    };
}

function filterRecordsByDateRange(records, filterType, startDate, endDate, customDate) {
    const now = customDate ? new Date(customDate) : new Date();
    now.setHours(0,0,0,0);

    return records.filter(r => {
        const recordDate = getStartOfDay(r.date);
        
        if (filterType === 'daily') {
            return recordDate.getTime() === now.getTime();
        } 
        else if (filterType === 'manual' || filterType === 'weekly' || filterType === 'monthly') {
            if (!startDate || !endDate) return true; // fallback
            const sDate = getStartOfDay(startDate);
            const eDate = getStartOfDay(endDate);
            eDate.setHours(23,59,59,999);
            return recordDate >= sDate && recordDate <= eDate;
        }
        return true;
    });
}

function getDailyBreakdown(records) {
    // Return grouped by date (YYYY-MM-DD), oldest to newest
    const grouped = {};
    records.forEach(r => {
        if (!grouped[r.date]) {
            grouped[r.date] = { date: r.date, cash: 0, payNow: 0, totalCollected: 0, booking: 0 };
        }
        grouped[r.date].booking++;
        
        let val = r.paymentMethod !== 'Package' ? r.amount : 0;

        if (r.paymentMethod === 'Cash') grouped[r.date].cash += val;
        if (r.paymentMethod === 'PayNow') grouped[r.date].payNow += val;
        grouped[r.date].totalCollected += val;
    });
    
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

window.Metrics = {
    normalizeStaffName,
    capitalizeStaffName,
    computeMetrics,
    filterRecordsByDateRange,
    getDailyBreakdown
};
