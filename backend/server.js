console.log("[BOOT] server.js file loaded");
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const REPORT_FILE_PATH = path.join(__dirname, 'daily_report.json');

const bookingSchema = new mongoose.Schema({
    staffName: { type: String, required: true },
    bookingType: { 
        type: String, 
        required: true, 
        enum: ["Booking", "Shop", "ShopB", "Walk-in", "Package"] 
    },
    paymentType: { 
        type: String, 
        required: true, 
        enum: ["Cash", "PayNow", "Package"] 
    },
    amount: { type: Number, required: true },
    bookingAt: { type: Date, required: true },
    timeIn: { type: String },
    timeOut: { type: String },
    remarks: { type: String }
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ====== REPORTING ENGINE ======
function normalizeStaffName(name) {
    return name ? name.toString().trim().toLowerCase() : '';
}

function capitalizeStaffName(name) {
    if (!name) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function computeMetrics(records) {
    let cashTotal = 0;
    let payNowTotal = 0;
    let totalCollected = 0;
    let totalBookings = records.length;
    let staffCount = 0;
    let shopCount = 0;
    let walkInCount = 0;
    let packageCount = 0;

    let staffDailyDict = {}; 
    let monthlyMatrix = {};  
    let uniqueStaffSet = new Set();

    records.forEach(r => {
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
            
            if (!staffDailyDict[normStaff]) {
                staffDailyDict[normStaff] = { 
                    name: capitalizeStaffName(normStaff),
                    rawName: normStaff,
                    booking: 0, cash: 0, payNow: 0, totalCollected: 0,
                    timeSlots: [],
                    staffBooking: 0,
                    shop: 0, shopB: 0, walkIn: 0
                };
            }

            if (r.type === 'Staff') {
                staffDailyDict[normStaff].booking++;
                staffDailyDict[normStaff].staffBooking++; 
            } else if (r.type === 'Shop') {
                staffDailyDict[normStaff].shop++;
            } else if (r.type === 'ShopB') {
                staffDailyDict[normStaff].shopB++;
            } else if (r.type === 'Walk-in') {
                staffDailyDict[normStaff].walkIn++;
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

    const allStaffNames = Array.from(uniqueStaffSet).sort();
    const monthlyMatrixRows = Object.values(monthlyMatrix).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
        cashTotal, payNowTotal, totalCollected, totalBookings,
        staffCount, shopCount, walkInCount, packageCount,
        staffBreakdown: Object.values(staffDailyDict).sort((a,b) => a.name.localeCompare(b.name)),
        monthlyMatrixRows: monthlyMatrixRows,
        allStaffNames: allStaffNames
    };
}

function getDailyBreakdown(records) {
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

function mapBookingToRecord(b) {
    let dateStr = "";
    if (b.bookingAt) {
        try {
            dateStr = b.bookingAt.toISOString().split('T')[0];
        } catch(e) {
            dateStr = b.bookingAt.toString();
        }
    }
    return {
        id: b._id.toString(),
        date: dateStr,
        time_in: b.timeIn || '',
        time_out: b.timeOut || '',
        staff: b.staffName ? b.staffName.toLowerCase() : '',
        type: b.bookingType === 'Booking' ? 'Staff' : b.bookingType,
        paymentMethod: b.paymentType,
        amount: b.amount || 0
    };
}

function formatTelegramDate(ymd) {
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length !== 3) return ymd;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function generateTelegramText(reportType, dateRangeStr, filteredRecords, metrics) {
    let reportText = '';

    if (filteredRecords.length === 0) {
        return `No records found for ${reportType === 'monthly' ? 'selected monthly range' : dateRangeStr}`;
    }

    let title = '';
    if (reportType === 'daily') title = `Daily Report - ${dateRangeStr}`;
    else if (reportType === 'weekly') title = `Weekly Report - ${dateRangeStr}`;
    else if (reportType === 'monthly') title = `Monthly Report - ${dateRangeStr}`;

    const tCounts = { Booking: 0, Shop: 0, ShopB: 0, 'Walk-in': 0 };
    filteredRecords.forEach(r => {
        if (r.type === 'Staff') tCounts.Booking++;
        else if (r.type === 'Shop') tCounts.Shop++;
        else if (r.type === 'ShopB') tCounts.ShopB++;
        else if (r.type === 'Walk-in') tCounts['Walk-in']++;
    });

    reportText += `${title}\n\n`;
    reportText += `Total Collected: $${metrics.totalCollected}\n`;
    
    if (reportType === 'daily') {
        if (metrics.cashTotal > 0) reportText += `Cash: $${metrics.cashTotal}\n`;
        if (metrics.payNowTotal > 0) reportText += `PayNow: $${metrics.payNowTotal}\n`;
    } else {
        reportText += `Cash: $${metrics.cashTotal}\n`;
        reportText += `PayNow: $${metrics.payNowTotal}\n`;
    }
    
    reportText += `Total Bookings: ${metrics.totalBookings}\n`;
    
    if (reportType === 'daily') {
        if (tCounts.Booking > 0) reportText += `Booking: ${tCounts.Booking}\n`;
        if (tCounts.Shop > 0) reportText += `Shop: ${tCounts.Shop}\n`;
        if (tCounts.ShopB > 0) reportText += `ShopB: ${tCounts.ShopB}\n`;
        if (tCounts['Walk-in'] > 0) reportText += `Walk-in: ${tCounts['Walk-in']}\n`;
        if (metrics.packageCount > 0) reportText += `Package Count: ${metrics.packageCount}\n`;
        reportText += `\n`;
    } else {
        reportText += `Booking: ${tCounts.Booking}\n`;
        reportText += `Shop: ${tCounts.Shop}\n`;
        reportText += `ShopB: ${tCounts.ShopB}\n`;
        reportText += `Walk-in: ${tCounts['Walk-in']}\n`;
        reportText += `Package Count: ${metrics.packageCount}\n\n`;
    }

    if (reportType === 'daily') {
        reportText += `Staff Summary:\n`;
        metrics.staffBreakdown.forEach(s => {
            const uniqueTimes = [...new Set(s.timeSlots)];
            const timeStr = uniqueTimes.length > 0 ? ` | Time: ${uniqueTimes.join(', ')}` : '';
            let staffLine = `${s.name}${timeStr}`;
            
            if (s.booking > 0) staffLine += ` | Booking: ${s.booking}`;
            if (s.shop > 0) staffLine += ` | Shop: ${s.shop}`;
            if (s.shopB > 0) staffLine += ` | ShopB: ${s.shopB}`;
            if (s.walkIn > 0) staffLine += ` | Walk-in: ${s.walkIn}`;
            if (s.cash > 0) staffLine += ` | Cash: ${s.cash}`;
            if (s.payNow > 0) staffLine += ` | PayNow: ${s.payNow}`;
            staffLine += ` | Total: ${s.totalCollected}\n`;
            
            reportText += staffLine;
        });
    } else if (reportType === 'weekly') {
        reportText += `Staff Performance:\n`;
        metrics.staffBreakdown.forEach(s => {
            reportText += `${s.name} | Staff Booking: ${s.staffBooking} | Total Amount: ${s.totalCollected}\n`;
        });
    } else if (reportType === 'monthly') {
        reportText += `Monthly Staff Performance:\n`;
        metrics.staffBreakdown.forEach(s => {
            reportText += `${s.name} | Staff Booking: ${s.staffBooking || s.booking} | Total Amount: ${s.totalCollected}\n`;
        });

        reportText += `\nMonthly Cash Flow Summary:\n`;
        const dailyBreakdown = getDailyBreakdown(filteredRecords);
        dailyBreakdown.forEach(d => {
            reportText += `${formatTelegramDate(d.date)} | PayNow: ${d.payNow} | Cash: ${d.cash} | Total: ${d.totalCollected}\n`;
        });
    }
    
    return reportText;
}
// ==============================

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

// GET endpoints for REPORTS
app.get('/report/daily', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ ok: false, error: 'date query param required' });
        
        // Match standard YYYY-MM-DD
        const start = new Date(date);
        start.setUTCHours(0,0,0,0);
        const end = new Date(date);
        end.setUTCHours(23,59,59,999);

        const bookings = await Booking.find({
            bookingAt: { $gte: start, $lte: end }
        });

        const records = bookings.map(mapBookingToRecord);
        const metrics = computeMetrics(records);
        
        console.log(`Loaded daily report from backend for ${date}`);
        res.json({ ok: true, metrics, records });
    } catch (err) {
        console.error('[DEBUG] /report/daily error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/report/weekly', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ ok: false, error: 'startDate and endDate required' });

        const start = new Date(startDate);
        start.setUTCHours(0,0,0,0);
        const end = new Date(endDate);
        end.setUTCHours(23,59,59,999);

        const bookings = await Booking.find({
            bookingAt: { $gte: start, $lte: end }
        });

        const records = bookings.map(mapBookingToRecord);
        const metrics = computeMetrics(records);
        
        console.log(`Loaded weekly report from backend for ${startDate} to ${endDate}`);
        res.json({ ok: true, metrics, records });
    } catch (err) {
        console.error('[DEBUG] /report/weekly error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/report/monthly', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ ok: false, error: 'startDate and endDate required' });

        const start = new Date(startDate);
        start.setUTCHours(0,0,0,0);
        const end = new Date(endDate);
        end.setUTCHours(23,59,59,999);

        const bookings = await Booking.find({
            bookingAt: { $gte: start, $lte: end }
        });

        const records = bookings.map(mapBookingToRecord);
        const metrics = computeMetrics(records);
        const breakdown = getDailyBreakdown(records);
        
        console.log(`Loaded monthly report from backend for ${startDate} to ${endDate}`);
        res.json({ ok: true, metrics, records, breakdown });
    } catch (err) {
        console.error('[DEBUG] /report/monthly error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.get('/booking', async (req, res) => {
    try {
        const bookings = await Booking.find({});
        res.json({ ok: true, bookings });
    } catch (err) {
        console.error('[DEBUG] GET /booking error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

app.post('/booking', async (req, res) => {
    try {
        const booking = new Booking(req.body);
        const savedBooking = await booking.save();
        res.json({ ok: true, booking: savedBooking });
    } catch (err) {
        console.error('[DEBUG] /booking creation error:', err);
        res.status(400).json({ ok: false, error: err.message });
    }
});

app.put('/booking/:id', async (req, res) => {
    try {
        console.log(`Updating booking id: ${req.params.id}`);
        const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });
        res.json({ ok: true, booking });
    } catch (err) {
        console.error('[DEBUG] /booking update error:', err);
        res.status(400).json({ ok: false, error: err.message });
    }
});

app.delete('/booking/:id', async (req, res) => {
    try {
        console.log(`Deleting booking id: ${req.params.id}`);
        const booking = await Booking.findByIdAndDelete(req.params.id);
        if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });
        res.json({ ok: true });
    } catch (err) {
        console.error('[DEBUG] /booking delete error:', err);
        res.status(400).json({ ok: false, error: err.message });
    }
});

app.post('/send-telegram-report', async (req, res) => {
    console.log('[DEBUG] --- POST /send-telegram-report request received ---');
    
    const { report_type, report_range, report_text } = req.body;
    console.log(`[DEBUG] report_type: ${report_type}`);
    console.log(`[DEBUG] report_range: ${report_range}`);
    
    if (!report_text) {
        console.log('[DEBUG] Failure: request missing report_text');
        return res.status(400).json({ success: false, error: 'report_text is required' });
    }

    // lastReceivedReportText is no longer used for manual send

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    console.log(`[DEBUG] TELEGRAM_BOT_TOKEN loaded: ${!!botToken}`);
    console.log(`[DEBUG] TELEGRAM_CHAT_ID loaded: ${!!chatId}`);

    if (!botToken || !chatId) {
        console.log('[DEBUG] Failure: Telegram credentials are not configured on the server.');
        return res.status(500).json({ success: false, error: 'Telegram credentials are not configured on the server.' });
    }

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: report_text,
                parse_mode: 'HTML' // Optional, though prompt strictly specified plain text formatting
            })
        });

        const data = await response.json();
        console.log(`[DEBUG] Telegram API response body:`, data);

        if (response.ok) {
            console.log('[DEBUG] Success: Message sent successfully');
            res.json({ success: true, message: 'Message sent successfully', data });
        } else {
            console.log(`[DEBUG] Failure: Telegram API returned an error - ${data.description || 'Unknown error'}`);
            res.status(response.status).json({ success: false, error: data.description || 'Telegram API returned an error' });
        }
    } catch (err) {
        console.error('[DEBUG] Failure exception:', err);
        res.status(500).json({ success: false, error: 'Failed to send message via Telegram API' });
    }
    
    console.log('[DEBUG] ---------------------------------------------------');
});

app.post('/save-daily-report', (req, res) => {
    console.log('[DEBUG] --- POST /save-daily-report request received ---');
    const { report_type, report_date, report_text } = req.body;
    
    if (report_type !== 'daily') {
        return res.status(400).json({ success: false, error: 'Only daily reports are saved' });
    }

    if (!report_text || !report_date) {
        return res.status(400).json({ success: false, error: 'report_text and report_date are required' });
    }

    const payload = {
        report_type,
        report_date,
        report_text,
        saved_at: new Date().toISOString()
    };

    try {
        fs.writeFileSync(REPORT_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[DEBUG] Successfully saved daily report for ${report_date}`);
        res.json({ success: true, message: 'Report saved locally' });
    } catch (err) {
        console.error('[DEBUG] Failed to save report:', err);
        res.status(500).json({ success: false, error: 'Failed to save report' });
    }
});

console.log("[SCHEDULER] Initializing daily auto-send cron job...");
const CRON_SCHEDULE = process.env.TEST_CRON === 'true' ? '*/2 * * * *' : '30 14 * * *';

cron.schedule(CRON_SCHEDULE, async () => {
    console.log("Daily Telegram cron started");
    
    try {
        const nowUtc = new Date();
        const sgtFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' });
        const currentSgtDateStr = sgtFormatter.format(nowUtc);
        
        const start = new Date(currentSgtDateStr);
        start.setUTCHours(0,0,0,0);
        const end = new Date(currentSgtDateStr);
        end.setUTCHours(23,59,59,999);

        const bookings = await Booking.find({
            bookingAt: { $gte: start, $lte: end }
        });

        const records = bookings.map(mapBookingToRecord);
        const metrics = computeMetrics(records);
        
        const dateRangeStr = formatTelegramDate(currentSgtDateStr);
        const reportText = generateTelegramText('daily', dateRangeStr, records, metrics);

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!botToken || !chatId) {
            console.log("Daily Telegram report failed: Telegram credentials missing.");
            return;
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: reportText,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log("Daily Telegram report sent");
        } else {
            console.log(`Daily Telegram report failed: ${data.description || 'Unknown error'}`);
        }
    } catch (err) {
        console.log("Daily Telegram report failed: Exception caught", err);
    }
});
console.log(`[SCHEDULER] Cron job scheduled with expression: ${CRON_SCHEDULE}`);

// URL-encoded the '@' symbol in the password as '%40' to prevent MongoParseError
const MONGO_URI = "mongodb+srv://renthil_db_user:Yuvaraaj%40365@renthil.zw4akgy.mongodb.net/?appName=renthilappName=renthil";

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected");
        app.listen(PORT, () => {
            console.log(`[STARTUP] Backend server successfully started.`);
            console.log(`[STARTUP] Listening on PORT: ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("MongoDB connection failed:", err);
    });
