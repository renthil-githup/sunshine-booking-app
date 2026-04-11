// js/screens/records.js

function renderRecordsScreen(container) {
    const records = Data.getRecords().sort((a,b) => new Date(b.date) - new Date(a.date));

    let html = `
        <div class="card">
            <h2>All Records</h2>
            <div id="records-list">
    `;

    if (records.length === 0) {
        html += `<p style="color:var(--text-secondary); text-align:center;">No records found.</p>`;
    } else {
        records.forEach(r => {
            const amountDisp = r.paymentMethod === 'Package' ? '<span class="text-package">Package</span>' : `<span class="text-money">$${r.amount.toFixed(2)}</span>`;
            
            // Format Staff Name safely
            const dispStaff = r.staff ? r.staff.charAt(0).toUpperCase() + r.staff.slice(1) : '';

            // Calculate duration
            let timeStr = "";
            let durationStr = "";
            if (r.time_in && r.time_out) {
                timeStr = `${r.time_in} - ${r.time_out}`;
                
                const t1 = r.time_in.split(':');
                const t2 = r.time_out.split(':');
                const minIn = parseInt(t1[0]) * 60 + parseInt(t1[1]);
                const minOut = parseInt(t2[0]) * 60 + parseInt(t2[1]);
                const diff = minOut - minIn;
                
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                durationStr = `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
            }

            // Format edited tag
            const isEdited = (r.created_at !== r.updated_at) && r.updated_at ? '<span style="font-size:0.75rem; color:var(--text-secondary); background:var(--border-color); padding: 2px 6px; border-radius:4px; margin-left:6px;">Edited</span>' : '';

            html += `
                <div class="record-item">
                    <div class="record-details">
                        <div class="record-title">${r.type} ${dispStaff ? '- ' + dispStaff : ''} ${isEdited}</div>
                        <div class="record-meta">${r.date} ${timeStr ? '&bull; ' + timeStr + ' (' + durationStr + ')' : ''} &bull; ${r.paymentMethod}</div>
                    </div>
                    <div class="record-amount">
                        ${amountDisp}
                    </div>
                    <div class="actions">
                        <button class="action-btn edit" onclick="RecordsScreen.handleEdit('${r.id}')">
                            <i data-lucide="edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="RecordsScreen.handleDelete('${r.id}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    html += `</div></div>`;
    container.innerHTML = html;
    
    // Initialize icons for the dynamic HTML
    if (window.lucide) {
        lucide.createIcons();
    }
}

function handleEdit(id) {
    console.log(`Clicked edit for booking id: ${id}`);
    if (window.EntryScreen && window.EntryScreen.fillForEdit) {
        window.EntryScreen.fillForEdit(id);
        if (window.AppMain && window.AppMain.switchTab) {
            window.AppMain.switchTab('entry');
        }
    }
}

async function handleDelete(id) {
    console.log(`Clicked delete for booking id: ${id}`);
    if (confirm("Are you sure you want to delete this record?")) {
        try {
            const btn = document.querySelector(`.action-btn.delete[onclick="RecordsScreen.handleDelete('${id}')"]`);
            if (btn) btn.innerHTML = '<i data-lucide="loader"></i>';
            if (window.lucide) lucide.createIcons();

            const res = await window.fetchWithAuth(`https://sunshine-backend-w14m.onrender.com/booking/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            
            console.log(`DELETE response:`, data);
            
            if (res.ok && data.ok) {
                if (window.Data && window.Data.fetchBookingsFromBackend) {
                    await window.Data.fetchBookingsFromBackend();
                }
                renderRecordsScreen(document.getElementById('main-content'));
            } else {
                alert('Failed to delete: ' + (data.error || 'Server error'));
                renderRecordsScreen(document.getElementById('main-content'));
            }
        } catch (err) {
            console.error(err);
            alert('Network error during deletion');
            renderRecordsScreen(document.getElementById('main-content'));
        }
    }
}

window.RecordsScreen = { 
    render: renderRecordsScreen,
    handleEdit,
    handleDelete
};
