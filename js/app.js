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

    // Initial load
    switchTab('entry');
    
    // Initialize icons for the base HTML
    if (window.lucide) {
        lucide.createIcons();
    }
    
    window.AppMain = { switchTab };
});
