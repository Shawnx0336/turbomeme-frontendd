// State Management
let walletBalance = 500;
let tokensEarned = 0;
let currentBet = { multiplier: null, amount: 0 };
let lastInteraction = Date.now();
const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
let firstBetPlaced = false;
let connectedWallet = null;

// Connect Phantom Wallet (Real)
async function connectPhantom() {
    if (window.solana && window.solana.isPhantom) {
        try {
            const resp = await window.solana.connect();
            connectedWallet = resp.publicKey.toString();

            document.getElementById("walletStatus").textContent = "Connected";
            document.getElementById("walletAddress").textContent =
                connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);

            closeModal('connect-wallet-modal');
            showToast('Phantom wallet connected!', 'success');
        } catch (err) {
            showToast('Wallet connection cancelled', 'error');
        }
    } else {
        window.open("https://phantom.app", "_blank");
    }
}

// Auto-reconnect on page load
window.addEventListener("load", async () => {
    if (window.solana && window.solana.isPhantom) {
        try {
            const res = await window.solana.connect({ onlyIfTrusted: true });
            connectedWallet = res.publicKey.toString();
            document.getElementById("walletStatus").textContent = "Connected";
            document.getElementById("walletAddress").textContent =
                connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);
        } catch {
            // Not yet connected
        }
    }
});

// Mock Leaderboard Data
const mockLeaderboard = {
    wager: [
        { user: "SolWhale", avatar: "🐋", value: "◎100.00" },
        { user: "CryptoKing", avatar: "👑", value: "◎75.50" },
        { user: "MoonBet", avatar: "🚀", value: "◎50.25" }
    ],
    streak: [
        { user: "LuckyAce", avatar: "🌟", value: "8 wins" },
        { user: "SolWhale", avatar: "🐋", value: "5 wins" },
        { user: "BetMaster", avatar: "⚡", value: "4 wins" }
    ],
    'ten-x': [
        { user: "10xHunter", avatar: "🎯", value: "3 times" },
        { user: "CryptoKing", avatar: "👑", value: "2 times" },
        { user: "RiskTaker", avatar: "💎", value: "1 time" }
    ]
};

// Toggle Live Panel
function toggleLivePanel() {
    document.getElementById('live-panel').classList.toggle('active');
}

// Tab Switching
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const selectedTab = document.getElementById(`${tabId}-tab`);
    if (selectedTab) selectedTab.style.display = 'block';
    const selectedBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (selectedBtn) selectedBtn.classList.add('active');
    if (tabId === 'leaderboard') updateLeaderboard();
}

// Update Leaderboard
function updateLeaderboard() {
    const sections = ['wager', 'streak', 'ten-x'];
    sections.forEach(section => {
        const container = document.getElementById(`${section}-leaderboard`);
        if (container && mockLeaderboard[section]) {
            container.innerHTML = mockLeaderboard[section].map(entry => `
                <div class="leaderboard-entry">
                    <span>${entry.avatar} ${entry.user}</span>
                    <span>${entry.value}</span>
                </div>
            `).join('');
        }
    });
}

// Notification Bar
function showNotification(message, duration = 5000) {
    const bar = document.getElementById('notificationBar');
    bar.textContent = message;
    bar.style.display = 'block';
    setTimeout(() => bar.style.display = 'none', duration);
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('visible');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('visible');
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && modal.dataset.closeOnOverlay === 'true') {
                closeModal(modal.id);
            }
        });
    });
});

// Toasts
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Inactivity Trigger
document.addEventListener('click', () => lastInteraction = Date.now());
document.addEventListener('input', () => lastInteraction = Date.now());
document.addEventListener('touchstart', () => lastInteraction = Date.now());

setInterval(() => {
    if (Date.now() - lastInteraction > INACTIVITY_THRESHOLD) {
        showModal('still-here-modal');
        lastInteraction = Date.now();
    }
}, 60000);

// Demo Wallet Balance Logic
function checkBalance() {
    if (walletBalance < 1 && !sessionStorage.getItem('low-balance-shown')) {
        showModal('low-balance-modal');
        sessionStorage.setItem('low-balance-shown', 'true');
    }
}

// Place Bet (Mock)
function placeBet() {
    const amount = parseFloat(document.getElementById('bet-amount').value);
    const multiplier = document.getElementById('multiplier').value;
    if (!multiplier || amount <= 0) return showToast('Select a multiplier and amount', 'error');
    if (walletBalance < amount) return showModal('low-balance-modal');

    walletBalance -= amount;
    document.getElementById('balance').textContent = `◎${walletBalance.toFixed(2)}`;
    showToast(`Bet placed: ◎${amount.toFixed(2)} on ${multiplier}x!`, 'success');
    showNotification('Bet placed successfully!');
    checkBalance();

    if (!firstBetPlaced && !sessionStorage.getItem('daily-reward-shown')) {
        firstBetPlaced = true;
        setTimeout(() => {
            showModal('daily-reward-modal');
            sessionStorage.setItem('daily-reward-shown', 'true');
        }, 1000);
    }
}

// Chat (Mock)
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    document.getElementById('chat-messages').innerHTML += `<div>Guest: ${text}</div>`;
    input.value = '';
    document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
    showToast('Message sent!', 'success');
}

// Claim Rewards (Mock)
function claimTokens() {
    showToast(`${tokensEarned.toFixed(3)} $SPIN claimed!`, 'success');
}
function claimDailyBonus() {
    tokensEarned += 0.01;
    updateSpinBalance();
    closeModal('daily-bonus-modal');
    showToast('0.01 $SPIN claimed!', 'success');
}
function claimDailyReward() {
    tokensEarned += 0.05;
    updateSpinBalance();
    closeModal('daily-reward-modal');
    showToast('0.05 $SPIN claimed!', 'success');
}

// Utility
function updateSpinBalance() {
    document.getElementById('spin-balance').textContent = tokensEarned.toFixed(3);
    const modalEl = document.getElementById('spin-balance-modal');
    if (modalEl) modalEl.textContent = tokensEarned.toFixed(3);
}

// On Load
window.onload = () => {
    showModal('welcome-modal');
    showNotification('Welcome to SolRoulette LIVE!');
    updateLeaderboard();

    if (!sessionStorage.getItem('daily-bonus-shown')) {
        setTimeout(() => {
            showModal('daily-bonus-modal');
            sessionStorage.setItem('daily-bonus-shown', 'true');
        }, 2000);
    }

    document.getElementById('balance').textContent = `◎${walletBalance.toFixed(2)}`;
    updateSpinBalance();

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
};

// Spin Timer (Mock)
let spinTimer = 25;
setInterval(() => {
    if (spinTimer <= 0) spinTimer = 25;
    else spinTimer--;
    document.getElementById('timer').textContent = `⏳ Next Spin: ${spinTimer}s`;
}, 1000);
