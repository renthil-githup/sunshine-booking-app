const Config = {
    API_BASE_URL: 'https://sunshine-backend-w14m.onrender.com'
};

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    
    if (!token) {
        if (window.AppMain && window.AppMain.logout) {
            window.AppMain.logout();
        } else {
            document.location.reload();
        }
        throw new Error("No token found. Login required.");
    }

    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = `Bearer ${token}`;
    
    if (!options.headers['Content-Type'] && options.body) {
        options.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
        alert("Session expired. Please log in again.");
        if (window.AppMain && window.AppMain.logout) {
            window.AppMain.logout();
        } else {
            localStorage.removeItem('token');
            location.reload();
        }
        throw new Error("Unauthorized");
    }

    return response;
}

window.Config = Config;
window.fetchWithAuth = fetchWithAuth;
