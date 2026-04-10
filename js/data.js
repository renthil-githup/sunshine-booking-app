// js/data.js

const StorageKey = "salesAndBookingRecords";

function getRecords() {
    const data = localStorage.getItem(StorageKey);
    return data ? JSON.parse(data) : [];
}

function saveRecords(records) {
    localStorage.setItem(StorageKey, JSON.stringify(records));
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
    deleteRecord
};
