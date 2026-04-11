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
            console.log('Reloaded bookings from backend:', json.bookings);
            
            inMemoryRecords = json.bookings.map(b => ({
                id: b._id,
                date: b.bookingAt ? b.bookingAt.split('T')[0] : '', 
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

window.Data = {
    getRecords,
    fetchBookingsFromBackend
};
