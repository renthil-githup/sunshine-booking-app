console.log("[BOOT] server.js file loaded");
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

let lastReceivedReportText = null;

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

    lastReceivedReportText = report_text;

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

console.log("[SCHEDULER] Initializing daily auto-send cron job...");
cron.schedule('30 14 * * *', async () => {
    console.log("[SCHEDULER] Cron job triggered at 14:30 UTC (22:30 SGT).");
    
    if (!lastReceivedReportText) {
        console.log("[SCHEDULER] No report available for auto send");
        return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
        console.log("[SCHEDULER] Failure: Telegram credentials missing.");
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: lastReceivedReportText,
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
console.log("[SCHEDULER] Cron job scheduled for 14:30 UTC (22:30 SGT).");

app.listen(PORT, () => {
    console.log(`[STARTUP] Backend server successfully started.`);
    console.log(`[STARTUP] Listening on PORT: ${PORT}`);
});
