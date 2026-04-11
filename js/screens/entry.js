// js/screens/entry.js

let currentEditId = null;

function renderEntryScreen(container) {
    const isEditMode = !!currentEditId;
    
    container.innerHTML = `
        <div class="card">
            <h2 id="entry-title">${isEditMode ? 'Edit Record' : 'Add New Record'}</h2>
            <form id="entry-form">
                <input type="hidden" id="record-id">
                
                <div class="form-group">
                    <label for="record-date">Date</label>
                    <input type="date" id="record-date" required>
                </div>
                
                <div class="form-group" style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label for="record-time-in">Time In</label>
                        <input type="time" id="record-time-in" required>
                    </div>
                    <div style="flex:1;">
                        <label for="record-time-out">Time Out</label>
                        <input type="time" id="record-time-out" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="record-staff">Staff Name (Optional)</label>
                    <input type="text" id="record-staff" placeholder="E.g., John">
                </div>
                
                <div class="form-group">
                    <label for="record-type">Booking Type</label>
                    <select id="record-type" required>
                        <option value="Staff">Staff</option>
                        <option value="Shop">Shop</option>
                        <option value="ShopB">ShopB</option>
                        <option value="Walk-in">Walk-in</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="record-payment">Payment Method</label>
                    <select id="record-payment" required>
                        <option value="Cash">Cash</option>
                        <option value="PayNow">PayNow</option>
                        <option value="Package">Package</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="record-amount">Amount ($)</label>
                    <input type="number" step="0.01" id="record-amount" required>
                </div>
                
                <div style="display:flex; gap:10px;">
                    <button type="submit" class="btn" style="flex:1;">${isEditMode ? 'Update Record' : 'Save Record'}</button>
                    ${isEditMode ? '<button type="button" class="btn" style="flex:1; background-color: var(--text-secondary);" onclick="EntryScreen.cancelEdit()">Cancel Edit</button>' : ''}
                </div>
            </form>
        </div>
    `;

    // Set default date to today
    const dateInput = document.getElementById('record-date');
    if (!dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    // Handle package auto-amount = 0
    const paymentInput = document.getElementById('record-payment');
    const amountInput = document.getElementById('record-amount');
    
    paymentInput.addEventListener('change', (e) => {
        if (e.target.value === 'Package') {
            amountInput.value = 0;
            // Optionally disable
            // amountInput.disabled = true;
        } else {
            // amountInput.disabled = false;
            // Clear if was 0 and switched to paying method
            if (amountInput.value === '0') amountInput.value = '';
        }
    });

    document.getElementById('entry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const timeIn = document.getElementById('record-time-in').value;
        const timeOut = document.getElementById('record-time-out').value;
        
        if (timeOut <= timeIn) {
            alert('Time Out must be later than Time In.');
            return;
        }
        
        const id = document.getElementById('record-id').value;
        const rawStaff = document.getElementById('record-staff').value.trim();
        // Lowercase strictly for internal data consistency before metrics
        const normStaff = rawStaff ? rawStaff.toLowerCase() : '';
        
        const record = {
            date: dateInput.value,
            time_in: timeIn,
            time_out: timeOut,
            staff: normStaff,
            type: document.getElementById('record-type').value,
            paymentMethod: paymentInput.value,
            amount: parseFloat(amountInput.value) || 0
        };

        if (id) {
            Data.updateRecord(id, record);
            alert('Record updated!');
            currentEditId = null; // Exit edit mode
            
            // Refresh Reports automatically if needed
            // Actually switch back to Records tab so user sees the change
            if (window.AppMain && window.AppMain.switchTab) {
                window.AppMain.switchTab('records');
                return; // Early return to avoid wiping while switching
            }
        } else {
            // Replace localStorage saving with backend POST request
            const backendType = record.type === 'Staff' ? 'Booking' : record.type;
            
            // Generate a valid ISO Date string from the date input
            let isoDate;
            try {
                isoDate = new Date(record.date).toISOString();
            } catch (e) {
                isoDate = new Date().toISOString(); // fallback if invalid
            }

            const payload = {
                staffName: rawStaff || "Unknown",
                bookingType: backendType,
                paymentType: record.paymentMethod,
                amount: record.amount,
                bookingAt: isoDate,
                timeIn: record.time_in,
                timeOut: record.time_out,
                remarks: ""
            };
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const prevText = submitBtn.innerHTML;
            
            try {
                console.log('Sending payload:', payload);
                submitBtn.innerHTML = 'Saving...';
                submitBtn.disabled = true;

                const response = await fetch('https://sunshine-backend-w14m.onrender.com/booking', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                console.log('Backend response:', result);
                
                submitBtn.innerHTML = prevText;
                submitBtn.disabled = false;

                if (response.ok && result.ok) {
                    alert('Booking saved successfully');
                    if (window.Data && window.Data.fetchBookingsFromBackend) {
                        await window.Data.fetchBookingsFromBackend();
                    }
                    // Optional: Reset form 
                    // e.target.reset();
                    // document.getElementById('record-id').value = '';
                    // dateInput.valueAsDate = new Date();
                } else {
                    alert('Failed to save booking: ' + (result.error || 'Server error'));
                    return; // Abort and keep user input
                }
            } catch (err) {
                console.error('Fetch error:', err);
                submitBtn.innerHTML = prevText;
                submitBtn.disabled = false;
                alert('Network error: Could not contact backend.');
                return; // Abort and keep user input
            }
        }
        
        // Reset form but keep date
        e.target.reset();
        document.getElementById('record-id').value = '';
        dateInput.valueAsDate = new Date();
    });

    // If we are in edit mode, populate the DOM now that it exists
    if (isEditMode) {
        populateFormForEdit(currentEditId);
    }
}

function populateFormForEdit(id) {
    const rawData = window.Data.getRecords().find(r => r.id === id);
    if (!rawData) return;
    
    document.getElementById('record-id').value = rawData.id;
    document.getElementById('record-date').value = rawData.date;
    document.getElementById('record-time-in').value = rawData.time_in || '';
    document.getElementById('record-time-out').value = rawData.time_out || '';
    document.getElementById('record-staff').value = rawData.staff ? window.Metrics.capitalizeStaffName(rawData.staff) : '';
    document.getElementById('record-type').value = rawData.type;
    document.getElementById('record-payment').value = rawData.paymentMethod;
    document.getElementById('record-amount').value = rawData.amount;
}

function fillForEdit(id) {
    currentEditId = id; // Flag the state so when render is called, it switches to Edit form
}

function cancelEdit() {
    currentEditId = null;
    renderEntryScreen(document.getElementById('main-content'));
}

window.EntryScreen = { 
    render: renderEntryScreen,
    fillForEdit,
    cancelEdit
};
