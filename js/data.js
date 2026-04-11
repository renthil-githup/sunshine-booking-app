// js/data.js

let inMemoryRecords = [];

function getRecords() {
    return inMemoryRecords;
}

function saveRecords(records) {
    inMemoryRecords = records;
    // localStorage no longer used for booking source of truth
}

async function fetchBookingsFromBackend() {
    try {
        const res = await fetch('https://sunshine-backend-w14m.onrender.com/booking');
        const json = await res.json();
        
        if (json.ok && json.bookings) {
            console.log('Loaded bookings from backend:', json.bookings);
            
            inMemoryRecords = json.bookings.map(b => ({
                id: b._id,
                date: b.bookingAt ? b.bookingAt.split('T')[0] : '', // Extract yyyy-mm-dd format
                time_in: b.timeIn || '',
                time_out: b.timeOut || '',
                staff: b.staffName ? b.staffName.toLowerCase() : '',
                type: b.bookingType === 'Booking' ? 'Staff' : b.bookingType,
                paymentMethod: b.paymentType,
                amount: b.amount || 0
            }));
            
            console.log('Rendered booking count:', inMemoryRecords.length);
        }
    } catch (e) {
        console.error('Failed to load bookings from backend:', e);
    }
}

function addRecord(record) {
    const records = getRecords();
    const now = new Date().toISOString();
    const newRecord = {
        ...record,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        amount: Number(record.amount) || 0,
        created_at: now,
        updated_at: now
    };
    records.push(newRecord);
    saveRecords(records);
    return newRecord;
}

function updateRecord(id, updatedFields) {
    const records = getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index !== -1) {
        records[index] = { 
            ...records[index], 
            ...updatedFields, 
            updated_at: new Date().toISOString() 
        };
        if (updatedFields.amount !== undefined) {
            records[index].amount = Number(updatedFields.amount) || 0;
        }
        saveRecords(records);
    }
}

function deleteRecord(id) {
    let records = getRecords();
    records = records.filter(r => r.id !== id);
    saveRecords(records);
}

window.Data = {
    getRecords,
    addRecord,
    updateRecord,
    deleteRecord,
    fetchBookingsFromBackend
};
