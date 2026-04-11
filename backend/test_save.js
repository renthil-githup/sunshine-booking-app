const url = 'http://localhost:3000/save-daily-report';

const nowUtc = new Date();
const sgtFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' });
const currentSgtDateStr = sgtFormatter.format(nowUtc);

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        report_type: 'daily',
        report_date: currentSgtDateStr,
        report_text: 'Hello from test run!'
    })
}).then(r => r.json()).then(console.log).catch(console.error);
