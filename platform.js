const Platform = {
    currentUser: null,
    userData: null,
    confirmCallback: null,

    init(activePage) {
        this.currentUser = localStorage.getItem('tacts_currentUser');
        
        // Security Check: Redirect to login if no user is found
        if (!this.currentUser && activePage !== 'login') {
            window.location.href = 'login.html';
            return;
        }

        // Run setup structures
        if (activePage === 'login') {
            this.injectCustomAlertHTML();
        } else if (this.currentUser) {
            this.loadUserData();
            this.generateDummyUsers(); 
            this.renderLayout(activePage);
            this.updateDisplay();
            this.setupSizingControls(); 
            this.injectCustomAlertHTML(); 
        }
    },

    showAlert(message, title = "System Notification") {
        const backdrop = document.getElementById('custom-alert-overlay');
        const titleEl = document.getElementById('custom-alert-title-text');
        const msgEl = document.getElementById('custom-alert-msg-text');
        
        if (backdrop && titleEl && msgEl) {
            titleEl.innerText = title;
            msgEl.innerText = message;
            backdrop.style.display = 'flex';
        } else {
            alert(message);
        }
    },

    showConfirm(message, callback, title = "Warning Action Required") {
        const backdrop = document.getElementById('custom-confirm-overlay');
        const titleEl = document.getElementById('custom-confirm-title-text');
        const msgEl = document.getElementById('custom-confirm-msg-text');
        
        if (backdrop && titleEl && msgEl && typeof callback === 'function') {
            titleEl.innerText = title;
            msgEl.innerText = message;
            this.confirmCallback = callback; 
            backdrop.style.display = 'flex';
        } else {
            if (confirm(message)) callback();
        }
    },

    handleConfirmChoice(approved) {
        document.getElementById('custom-confirm-overlay').style.display = 'none';
        if (approved && this.confirmCallback) {
            this.confirmCallback(); 
        }
        this.confirmCallback = null; 
    },

    injectCustomAlertHTML() {
        if (!document.getElementById('custom-alert-overlay')) {
            const alertWrapper = document.createElement('div');
            alertWrapper.id = 'custom-alert-overlay';
            alertWrapper.className = 'custom-alert-backdrop';
            alertWrapper.innerHTML = `
                <div class="custom-alert-box">
                    <div class="custom-alert-title" id="custom-alert-title-text">Notification</div>
                    <div class="custom-alert-message" id="custom-alert-msg-text">Message goes here.</div>
                    <button class="custom-alert-btn" onclick="document.getElementById('custom-alert-overlay').style.display='none'">OK</button>
                </div>
            `;
            document.body.appendChild(alertWrapper);
        }

        if (!document.getElementById('custom-confirm-overlay')) {
            const confirmWrapper = document.createElement('div');
            confirmWrapper.id = 'custom-confirm-overlay';
            confirmWrapper.className = 'custom-alert-backdrop'; 
            confirmWrapper.innerHTML = `
                <div class="custom-confirm-box">
                    <div class="custom-alert-title" id="custom-confirm-title-text">Confirm Action</div>
                    <div class="custom-alert-message" id="custom-confirm-msg-text">Are you certain you wish to proceed?</div>
                    <div class="custom-confirm-buttons">
                        <button class="btn-confirm-action btn-confirm-no" id="modal-confirm-no-btn" onclick="Platform.handleConfirmChoice(false)">Cancel</button>
                        <button class="btn-confirm-action btn-confirm-yes" id="modal-confirm-yes-btn" onclick="Platform.handleConfirmChoice(true)">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmWrapper);
        }
    },

    checkUserExists(username) {
        if (!username) return false;
        return localStorage.getItem('tacts_user_' + username.trim()) !== null;
    },

    login(username) {
        if (!username || username.trim() === '') return;
        const cleanName = username.trim();
        localStorage.setItem('tacts_currentUser', cleanName);
        window.location.href = 'index.html';
    },

    logout() {
        localStorage.removeItem('tacts_currentUser');
        window.location.href = 'login.html';
    },

    loadUserData() {
        let data = localStorage.getItem('tacts_user_' + this.currentUser);
        if (data) {
            this.userData = JSON.parse(data);
        } else {
            this.userData = { 
                balance: 1000, 
                history: [], 
                stats: { totalWon: 0, slots: 0, sugar: 0, crash: 0, coinflip: 0, mines: 0 } 
            };
            this.saveUserData();
        }
        this.balance = this.userData.balance;
    },

    saveUserData() {
        this.balance = this.userData.balance;
        localStorage.setItem('tacts_user_' + this.currentUser, JSON.stringify(this.userData));
    },

    adjustBalance(amount) {
        this.userData.balance += amount;
        if(this.userData.balance < 0) this.userData.balance = 0;
        this.saveUserData();
        this.updateDisplay();
    },

    deposit() {
        if (this.currentUser !== 'TactAdmin') {
            this.showAlert("Only TactAdmin can authorize deposits.", "Access Denied");
            return;
        }
        this.adjustBalance(1000);
    },

    recordGame(gameId, betAmount, winAmount) {
        this.userData.history.unshift({
            game: gameId,
            bet: betAmount,
            win: winAmount,
            date: new Date().toLocaleString()
        });

        if (this.userData.history.length > 50) this.userData.history.pop();

        if (winAmount > betAmount) {
            let profit = winAmount - betAmount;
            this.userData.stats.totalWon += profit;
            if (this.userData.stats[gameId] !== undefined) {
                this.userData.stats[gameId] += profit;
            }
        }
        this.saveUserData();
    },

    updateDisplay() {
        const balEl = document.getElementById('global-balance');
        if(balEl) balEl.innerText = this.userData.balance.toFixed(2);
    },

    renderLayout(activePage) {
        const isAdmin = this.currentUser === 'TactAdmin';

        document.getElementById('sidebar-container').innerHTML = `
            <div class="logo">🎲 TACT'S CASINO</div>
            <div style="padding: 0 20px; margin-bottom: 15px; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Games</div>
            <a href="index.html" class="nav-item ${activePage === 'home' ? 'active' : ''}">🏠 Lobby</a>
            <a href="slots.html" class="nav-item ${activePage === 'slots' ? 'active' : ''}">🎰 Foodie Slots</a>
            <a href="sugar-rush.html" class="nav-item ${activePage === 'sugar' ? 'active' : ''}">🍬 Sugar Rush</a>
            <a href="crash.html" class="nav-item ${activePage === 'crash' ? 'active' : ''}">📈 Crash</a>
            <a href="coinflip.html" class="nav-item ${activePage === 'coinflip' ? 'active' : ''}">🪙 Coin Flip</a>
            <a href="mines.html" class="nav-item ${activePage === 'mines' ? 'active' : ''}">💣 Mines</a>
            <a href="plinko.html" class="nav-item ${activePage === 'plinko' ? 'active' : ''}">🔽 Plinko</a>
            <a href="hilo.html" class="nav-item ${activePage === 'hilo' ? 'active' : ''}">📉 HiLo</a>
            
            <div style="padding: 20px 20px 5px; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Community</div>
            <a href="leaderboard.html" class="nav-item ${activePage === 'leaderboard' ? 'active' : ''}">🏆 Leaderboard</a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">👤 My Profile</a>
            ${isAdmin ? `<a href="admin.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}" style="color: var(--warning);">🛠️ Admin Panel</a>` : ''}
        `;

        const depositBtnStyles = isAdmin 
            ? 'background: var(--accent); cursor: pointer;' 
            : 'background: var(--bg-hover); color: var(--text-muted); cursor: not-allowed; opacity: 0.5;';

        document.getElementById('topbar-container').innerHTML = `
            <div style="margin-right: auto; color: var(--text-muted); display: flex; align-items: center; gap: 10px;">
                Playing as: <strong style="color: var(--accent);">${this.currentUser}</strong>
                ${isAdmin ? '<span style="background: var(--warning); color: #000; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">ADMIN</span>' : ''}
            </div>
            <div style="display: flex; gap: 5px; margin-right: 15px;">
                <button class="btn-mode" id="global-btn-theater" style="background: var(--bg-hover); color: var(--text-muted); border: 1px solid #475569; padding: 4px 10px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; font-weight: bold;">🎬 Theater</button>
                <button class="btn-mode" id="global-btn-fullscreen" style="background: var(--bg-hover); color: var(--text-muted); border: 1px solid #475569; padding: 4px 10px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; font-weight: bold;">🖥️ Fullscreen</button>
            </div>
            <div class="balance-display">
                <span>💰</span> <div id="global-balance">${this.userData.balance.toFixed(2)}</div>
            </div>
            <button class="btn-deposit" style="${depositBtnStyles}" ${isAdmin ? 'onclick="Platform.deposit()"' : 'disabled'}>Deposit</button>
            <button class="btn-deposit" style="background: var(--danger);" onclick="Platform.logout()">Logout</button>
        `;
    },

    setupSizingControls() {
        const btnTheater = document.getElementById('global-btn-theater');
        const btnFullscreen = document.getElementById('global-btn-fullscreen');

        if (btnTheater) {
            btnTheater.onclick = () => {
                document.body.classList.toggle('theater-mode');
                btnTheater.style.background = document.body.classList.contains('theater-mode') ? 'var(--accent)' : 'var(--bg-hover)';
                btnTheater.style.color = document.body.classList.contains('theater-mode') ? '#fff' : 'var(--text-muted)';
            };
        }

        if (btnFullscreen) {
            btnFullscreen.onclick = () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(err => console.log(err));
                    btnFullscreen.style.background = 'var(--accent)';
                    btnFullscreen.style.color = '#fff';
                } else {
                    document.exitFullscreen();
                    btnFullscreen.style.background = 'var(--bg-hover)';
                    btnFullscreen.style.color = 'var(--text-muted)';
                }
            };
        }
    },

    generateDummyUsers() {
        if (!localStorage.getItem('tacts_user_HighRoller99')) {
            localStorage.setItem('tacts_user_HighRoller99', JSON.stringify({ balance: 54000, history: [], stats: { totalWon: 12500, slots: 5000, sugar: 0, crash: 7500 }}));
            localStorage.setItem('tacts_user_LuckyLucy', JSON.stringify({ balance: 8200, history: [], stats: { totalWon: 4200, sugar: 4000, crash: 0, slots: 0 }}));
            localStorage.setItem('tacts_user_CryptoKing', JSON.stringify({ balance: 150, history: [], stats: { totalWon: 800, slots: 0, sugar: 0, crash: 0 }}));
        }
    }
};