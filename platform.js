const Platform = {
    currentUser: null,   // Firebase Auth user object
    userData: null,      // Firestore user document data
    confirmCallback: null,

    // Convenience getter so game pages can still use Platform.balance
    get balance() { return this.userData ? this.userData.balance : 0; },

    init(activePage) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (!user) {
                // Not logged in
                if (activePage !== 'login') window.location.href = 'login.html';
                else this.injectCustomAlertHTML();
                return;
            }

            // Already logged in — bounce away from login page
            if (activePage === 'login') {
                window.location.href = 'index.html';
                return;
            }

            this.currentUser = user;
            await this.loadUserData();
            this.renderLayout(activePage);
            this.updateDisplay();
            this.setupSizingControls();
            this.injectCustomAlertHTML();
            // Reveal the game stage and signal other scripts that Platform is ready
            document.body.classList.add('platform-ready');
            document.dispatchEvent(new CustomEvent('platform:ready'));
        });
    },

    async loadUserData() {
        const uid = this.currentUser.uid;
        const ref = firebase.firestore().collection('users').doc(uid);
        const snap = await ref.get();

        if (snap.exists) {
            this.userData = snap.data();
        } else {
            // First time this user hits the app — seed their data
            this.userData = {
                username: this.currentUser.displayName,
                balance: 1000,
                history: [],
                stats: { totalWon: 0, slots: 0, sugar: 0, crash: 0, coinflip: 0, mines: 0, plinko: 0, hilo: 0 }
            };
            await ref.set(this.userData);
        }
    },

    saveUserData() {
        // Fire-and-forget — no need to await in game logic
        const uid = this.currentUser.uid;
        firebase.firestore().collection('users').doc(uid).set(this.userData).catch(console.error);
    },

    adjustBalance(amount) {
        this.userData.balance += amount;
        if (this.userData.balance < 0) this.userData.balance = 0;
        this.saveUserData();
        this.updateDisplay();
    },

    deposit() {
        const username = this.currentUser.displayName;
        if (username !== 'TactAdmin') {
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
            const profit = winAmount - betAmount;
            this.userData.stats.totalWon += profit;
            if (this.userData.stats[gameId] !== undefined) {
                this.userData.stats[gameId] += profit;
            }
        }
        this.saveUserData();
    },

    logout() {
        firebase.auth().signOut().then(() => {
            window.location.href = 'login.html';
        });
    },

    updateDisplay() {
        const balEl = document.getElementById('global-balance');
        if (balEl) balEl.innerText = this.userData.balance.toFixed(2);
    },

    renderLayout(activePage) {
        const username = this.currentUser.displayName;
        const isAdmin = username === 'TactAdmin';
        const avatarLetter = username.charAt(0).toUpperCase();

        document.getElementById('sidebar-container').innerHTML = `
            <div class="logo" style="cursor:pointer;transition:0.2s;" onclick="window.location.href='index.html'" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                <img src="logo.png" alt="" class="logo-img"> TACT'S CASINO
            </div>
            <div class="logo-divider"></div>

            <div class="nav-section-label">Games</div>
            <a href="index.html"      class="nav-item ${activePage === 'home'     ? 'active' : ''}">🏠 Lobby</a>
            <a href="slots.html"      class="nav-item ${activePage === 'slots'    ? 'active' : ''}">🎰 Foodie Slots</a>
            <a href="sugar-rush.html" class="nav-item ${activePage === 'sugar'    ? 'active' : ''}">🍬 Sugar Rush</a>
            <a href="crash.html"      class="nav-item ${activePage === 'crash'    ? 'active' : ''}">📈 Crash</a>
            <a href="coinflip.html"   class="nav-item ${activePage === 'coinflip' ? 'active' : ''}">🪙 Coin Flip</a>
            <a href="mines.html"      class="nav-item ${activePage === 'mines'    ? 'active' : ''}">💣 Mines</a>
            <a href="plinko.html"     class="nav-item ${activePage === 'plinko'   ? 'active' : ''}">🔽 Plinko</a>
            <a href="hilo.html"       class="nav-item ${activePage === 'hilo'     ? 'active' : ''}">📉 HiLo</a>

            <div class="nav-section-label" style="margin-top:20px;">Community</div>
            <a href="leaderboard.html" class="nav-item ${activePage === 'leaderboard' ? 'active' : ''}">🏆 Leaderboard</a>
            <a href="profile.html"     class="nav-item ${activePage === 'profile'     ? 'active' : ''}">👤 My Profile</a>
            ${isAdmin ? `<a href="admin.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}" style="color:var(--warning);">🛠️ Admin Panel</a>` : ''}
        `;

        const depositStyle = isAdmin
            ? 'background:var(--accent);cursor:pointer;'
            : 'background:var(--bg-hover);color:var(--text-muted);cursor:not-allowed;opacity:0.5;';

        document.getElementById('topbar-container').innerHTML = `
            <div class="user-info">
                <div class="user-avatar">${avatarLetter}</div>
                <div class="user-label">
                    Playing as <strong>${username}</strong>
                    ${isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}
                </div>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="btn-mode" id="global-btn-theater">🎬 Theater</button>
                <button class="btn-mode" id="global-btn-fullscreen">🖥️ Fullscreen</button>
            </div>
            <div class="balance-display">
                <span>💰</span><div id="global-balance">${this.userData.balance.toFixed(2)}</div>
            </div>
            <button class="btn-deposit" style="${depositStyle}" ${isAdmin ? 'onclick="Platform.deposit()"' : 'disabled'}>Deposit</button>
            <button class="btn-deposit" style="background:var(--danger);" onclick="Platform.logout()">Logout</button>
        `;
    },

    setupSizingControls() {
        const btnTheater    = document.getElementById('global-btn-theater');
        const btnFullscreen = document.getElementById('global-btn-fullscreen');

        if (btnTheater) {
            btnTheater.onclick = () => {
                document.body.classList.toggle('theater-mode');
                const on = document.body.classList.contains('theater-mode');
                btnTheater.style.background = on ? 'var(--accent)' : '';
                btnTheater.style.color      = on ? '#fff' : '';
            };
        }

        if (btnFullscreen) {
            btnFullscreen.onclick = () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(console.error);
                    btnFullscreen.style.background = 'var(--accent)';
                    btnFullscreen.style.color = '#fff';
                } else {
                    document.exitFullscreen();
                    btnFullscreen.style.background = '';
                    btnFullscreen.style.color = '';
                }
            };
        }
    },

    showAlert(message, title = "System Notification") {
        const backdrop = document.getElementById('custom-alert-overlay');
        const titleEl  = document.getElementById('custom-alert-title-text');
        const msgEl    = document.getElementById('custom-alert-msg-text');
        if (backdrop && titleEl && msgEl) {
            titleEl.innerText = title;
            msgEl.innerText   = message;
            backdrop.style.display = 'flex';
        } else {
            alert(message);
        }
    },

    showConfirm(message, callback, title = "Warning Action Required") {
        const backdrop = document.getElementById('custom-confirm-overlay');
        const titleEl  = document.getElementById('custom-confirm-title-text');
        const msgEl    = document.getElementById('custom-confirm-msg-text');
        if (backdrop && titleEl && msgEl && typeof callback === 'function') {
            titleEl.innerText = title;
            msgEl.innerText   = message;
            this.confirmCallback = callback;
            backdrop.style.display = 'flex';
        } else {
            if (confirm(message)) callback();
        }
    },

    handleConfirmChoice(approved) {
        document.getElementById('custom-confirm-overlay').style.display = 'none';
        if (approved && this.confirmCallback) this.confirmCallback();
        this.confirmCallback = null;
    },

    injectCustomAlertHTML() {
        if (!document.getElementById('custom-alert-overlay')) {
            const el = document.createElement('div');
            el.id = 'custom-alert-overlay';
            el.className = 'custom-alert-backdrop';
            el.innerHTML = `
                <div class="custom-alert-box">
                    <div class="custom-alert-title" id="custom-alert-title-text">Notification</div>
                    <div class="custom-alert-message" id="custom-alert-msg-text">Message goes here.</div>
                    <button class="custom-alert-btn" onclick="document.getElementById('custom-alert-overlay').style.display='none'">OK</button>
                </div>`;
            document.body.appendChild(el);
        }

        if (!document.getElementById('custom-confirm-overlay')) {
            const el = document.createElement('div');
            el.id = 'custom-confirm-overlay';
            el.className = 'custom-alert-backdrop';
            el.innerHTML = `
                <div class="custom-confirm-box">
                    <div class="custom-alert-title" id="custom-confirm-title-text">Confirm Action</div>
                    <div class="custom-alert-message" id="custom-confirm-msg-text">Are you certain you wish to proceed?</div>
                    <div class="custom-confirm-buttons">
                        <button class="btn-confirm-action btn-confirm-no"  onclick="Platform.handleConfirmChoice(false)">Cancel</button>
                        <button class="btn-confirm-action btn-confirm-yes" onclick="Platform.handleConfirmChoice(true)">Confirm</button>
                    </div>
                </div>`;
            document.body.appendChild(el);
        }
    }
};
