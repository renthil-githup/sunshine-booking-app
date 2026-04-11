console.log("[BOOT] server.js file loaded");
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const REPORT_FILE_PATH = path.join(__dirname, 'daily_report.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ ok: true });
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
    console.log("[SCHEDULER] Cron job triggered.");
    
    const nowUtc = new Date();
    // Explicitly use Singapore time to get YYYY-MM-DD
    const sgtFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' });
    const currentSgtDateStr = sgtFormatter.format(nowUtc);
    
    console.log(`[SCHEDULER] Current UTC time: ${nowUtc.toISOString()}`);
    console.log(`[SCHEDULER] Current Singapore date used for comparison: ${currentSgtDateStr}`);
    
    if (!fs.existsSync(REPORT_FILE_PATH)) {
        console.log("[SCHEDULER] Failure: daily_report.json file not found. No valid daily report available for auto send");
        return;
    }

    try {
        const fileData = fs.readFileSync(REPORT_FILE_PATH, 'utf8');
        const report = JSON.parse(fileData);
        
        console.log(`[SCHEDULER] Found saved report from: ${report.report_date} (saved at ${report.saved_at})`);
        
        if (report.report_date !== currentSgtDateStr) {
            console.log(`[SCHEDULER] Failure: Report date ${report.report_date} does not match today's SGT date ${currentSgtDateStr}. No valid daily report available for auto send`);
            return;
        }

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        if (!botToken || !chatId) {
            console.log("[SCHEDULER] Failure: Telegram credentials missing.");
            return;
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: report.report_text,
                parse_mode: 'HTML'
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log("[SCHEDULER] Success: Auto report sent via Telegram.");
        } else {
            console.log(`[SCHEDULER] Failure: Telegram API returned an error - ${data.description || 'Unknown error'}`);
        }
    } catch (err) {
        console.error("[SCHEDULER] Failure exception:", err);
    }
});
console.log(`[SCHEDULER] Cron job scheduled with expression: ${CRON_SCHEDULE}`);

app.listen(PORT, () => {
    console.log(`[STARTUP] Backend server successfully started.`);
    console.log(`[STARTUP] Listening on PORT: ${PORT}`);
});
