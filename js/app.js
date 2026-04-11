// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const navButtons = document.querySelectorAll('.nav-btn');

    function switchTab(tabId) {
        // Update nav UI
        navButtons.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Render screen
        if (tabId === 'entry') {
            EntryScreen.render(mainContent);
        } else if (tabId === 'records') {
            RecordsScreen.render(mainContent);
        } else if (tabId === 'reports') {
            ReportsScreen.render(mainContent);
        }
    }

    // Bind nav buttons
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');

    async function initializeApp() {
        if (window.Data && window.Data.fetchBookingsFromBackend) {
            await window.Data.fetchBookingsFromBackend();
        }
        switchTab('entry');
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function showApp() {
        loginScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        initializeApp();
    }

    function requireLogin() {
        loginScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        
        loginBtn.innerHTML = 'Log In';
        loginBtn.disabled = false;
        loginError.style.display = 'none';

        console.log("Login screen ready");
    }

    function checkAuth() {
        let token = localStorage.getItem('token');
        if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
            console.log("Token found, loading app");
            showApp();
        } else {
            console.log("No token found, showing login");
            requireLogin();
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        loginBtn.innerHTML = '<i data-lucide="loader"></i> Processing...';
        if (window.lucide) lucide.createIcons();
        loginBtn.disabled = true;
        loginError.style.display = 'none';

        try {
            const apiBase = (window.Config && window.Config.API_BASE_URL) ? window.Config.API_BASE_URL : 'https://sunshine-backend-w14m.onrender.com';
            const res = await fetch(`${apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            loginBtn.innerHTML = 'Log In';
            loginBtn.disabled = false;

            if (res.ok && data.ok && data.token) {
                localStorage.setItem('token', data.token);
                showApp();
            } else {
                loginError.textContent = data.error || 'Invalid credentials';
                loginError.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
            loginBtn.innerHTML = 'Log In';
            loginBtn.disabled = false;
            loginError.textContent = 'Server connection failed';
            loginError.style.display = 'block';
        }
    });

    window.logout = function() {
        localStorage.removeItem('token');
        requireLogin();
    };

    window.AppMain = { switchTab, logout };

    console.log("App init start");
    checkAuth();
});
