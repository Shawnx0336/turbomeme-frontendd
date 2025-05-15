// State Management
let walletBalance = 500;
let tokensEarned = 0;
let currentBet = { multiplier: null, amount: 0 };
let lastInteraction = Date.now();
const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
let firstBetPlaced = false;

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
    const panel = document.getElementById('live-panel');
    panel.classList.toggle('active');
}

// Tab Switching
function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabId}-tab`);
    if (selectedTab) {
        selectedTab.style.display = 'block';
    }
    
    // Mark button as active
    const selectedBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('active');
    }
    
    // Update leaderboard data if showing leaderboard tab
    if (tabId === 'leaderboard') {
        updateLeaderboard();
    }
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
    
    setTimeout(() => {
        bar.style.display = 'none';
    }, duration);
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('visible');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('visible');
    }
}

// Handle overlay clicks for modals
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && modal.dataset.closeOnOverlay === 'true') {
                closeModal(modal.id);
            }
        });
    });
});

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Inactivity Detection
document.addEventListener('click', () => lastInteraction = Date.now());
document.addEventListener('input', () => lastInteraction = Date.now());
document.addEventListener('touchstart', () => lastInteraction = Date.now());

setInterval(() => {
    if (Date.now() - lastInteraction > INACTIVITY_THRESHOLD) {
        showModal('still-here-modal');
        lastInteraction = Date.now();
    }
}, 60000); // Check every minute

// Balance Check
function checkBalance() {
    if (walletBalance < 1 && !sessionStorage.getItem('low-balance-shown')) {
        showModal('low-balance-modal');
        sessionStorage.setItem('low-balance-shown', 'true');
    }
}

// Place Bet
function placeBet() {
    const amount = parseFloat(document.getElementById('bet-amount').value);
    const multiplier = document.getElementById('multiplier').value;
    
    if (!multiplier || amount <= 0) {
        showToast('Please select a multiplier and enter a bet amount', 'error');
        return;
    }
    
    if (walletBalance < amount) {
        showModal('low-balance-modal');
        return;
    }
    
    // Deduct balance
    walletBalance -= amount;
    document.getElementById('balance').textContent = `◎${walletBalance.toFixed(2)}`;
    
    // Show toast
    showToast(`Bet placed: ◎${amount.toFixed(2)} on ${multiplier}x!`, 'success');
    showNotification('Bet placed successfully!');
    
    // Check balance after bet
    checkBalance();
    
    // Show daily reward modal on first bet
    if (!firstBetPlaced && !sessionStorage.getItem('daily-reward-shown')) {
        firstBetPlaced = true;
        setTimeout(() => {
            showModal('daily-reward-modal');
            sessionStorage.setItem('daily-reward-shown', 'true');
        }, 1000);
    }
}

// Send Chat Message
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (text) {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML += `<div>Guest: ${text}</div>`;
        input.value = '';
        
        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        showToast('Message sent!', 'success');
    }
}

// Connect Phantom Wallet
function connectPhantom() {
    closeModal('connect-wallet-modal');
    showToast('Phantom wallet connected (mock)!', 'success');
}

// Claim Tokens
function claimTokens() {
    showToast(`${tokensEarned.toFixed(3)} $SPIN claimed!`, 'success');
}

// Daily Bonus
function claimDailyBonus() {
    tokensEarned += 0.01;
    document.getElementById('spin-balance').textContent = tokensEarned.toFixed(3);
    const spinBalanceModal = document.getElementById('spin-balance-modal');
    if (spinBalanceModal) {
        spinBalanceModal.textContent = tokensEarned.toFixed(3);
    }
    closeModal('daily-bonus-modal');
    showToast('0.01 $SPIN claimed!', 'success');
}

// Daily Reward
function claimDailyReward() {
    tokensEarned += 0.05;
    document.getElementById('spin-balance').textContent = tokensEarned.toFixed(3);
    const spinBalanceModal = document.getElementById('spin-balance-modal');
    if (spinBalanceModal) {
        spinBalanceModal.textContent = tokensEarned.toFixed(3);
    }
    closeModal('daily-reward-modal');
    showToast('0.05 $SPIN claimed!', 'success');
}

// Copy Win Link
function copyWinLink() {
    navigator.clipboard.writeText('https://solroulette.live/win/123456');
    showToast('Win link copied!', 'success');
}

// Tweet Win
function tweetWin() {
    window.open('https://twitter.com/intent/tweet?text=I%20just%20won%20big%20on%20SolRoulette%20LIVE!', '_blank');
    closeModal('big-win-modal');
    showToast('Win shared on X!', 'success');
}

// Retry Bet
function retryBet() {
    closeModal('retry-loss-modal');
    placeBet();
}

// Refill Demo SOL
function refillDemoSol() {
    walletBalance = 500;
    document.getElementById('balance').textContent = `◎${walletBalance.toFixed(2)}`;
    closeModal('low-balance-modal');
    showToast('Demo balance refilled to ◎500!', 'success');
    sessionStorage.removeItem('low-balance-shown');
}

// Unlock Multipliers
function unlockMultipliers() {
    document.querySelectorAll('#multiplier option[disabled]').forEach(option => {
        option.disabled = false;
    });
    closeModal('unlock-multipliers-modal');
    showToast('5x and 10x multipliers unlocked!', 'success');
}

// Copy Referral Link
function copyReferralLink() {
    navigator.clipboard.writeText('https://solroulette.live?ref=ABC123XYZ');
    showToast('Referral link copied!', 'success');
}

// Reset Guest Progress
function resetGuestProgress() {
    if (confirm('Are you sure you want to reset your demo progress?')) {
        walletBalance = 500;
        tokensEarned = 0;
        document.getElementById('balance').textContent = `◎${walletBalance.toFixed(2)}`;
        document.getElementById('spin-balance').textContent = tokensEarned.toFixed(3);
        const spinBalanceModal = document.getElementById('spin-balance-modal');
        if (spinBalanceModal) {
            spinBalanceModal.textContent = tokensEarned.toFixed(3);
        }
        showToast('Guest progress reset!', 'success');
    }
}

// Purchase Shop Item
function purchaseShopItem(itemId) {
    const cost = itemId === 'rocket_avatar' ? 10 : 5;
    const itemName = itemId === 'rocket_avatar' ? 'Rocket Avatar' : 'Fire Chat Emote';
    
    if (tokensEarned >= cost) {
        tokensEarned -= cost;
        document.getElementById('spin-balance').textContent = tokensEarned.toFixed(3);
        const spinBalanceModal = document.getElementById('spin-balance-modal');
        if (spinBalanceModal) {
            spinBalanceModal.textContent = tokensEarned.toFixed(3);
        }
        showToast(`Purchased ${itemName}!`, 'success');
    } else {
        showToast('Insufficient $SPIN tokens', 'error');
    }
}

// Activate Pro Mode
function activateProMode() {
    closeModal('pro-mode-modal');
    showToast('PRO MODE activated!', 'success');
}

// Initialize on page load
window.onload = function() {
    // Show welcome modal
    showModal('welcome-modal');
    showNotification('Welcome to SolRoulette LIVE!');
    
    // Initialize leaderboard
    updateLeaderboard();
    
    // Show daily bonus modal after delay
    if (!sessionStorage.getItem('daily-bonus-shown')) {
        setTimeout(() => {
            showModal('daily-bonus-modal');
            sessionStorage.setItem('daily-bonus-shown', 'true');
        }, 2000);
    }
    
    // Update initial displays
    document.getElementById('balance').textContent = `◎${walletBalance.toFixed(2)}`;
    document.getElementById('spin-balance').textContent = tokensEarned.toFixed(3);
    const spinBalanceModal = document.getElementById('spin-balance-modal');
    if (spinBalanceModal) {
        spinBalanceModal.textContent = tokensEarned.toFixed(3);
    }
    
    // Add chat input enter key support
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
};

// Timer Update (Mock)
let spinTimer = 25;
setInterval(() => {
    if (spinTimer <= 0) {
        spinTimer = 25;
    } else {
        spinTimer--;
    }
    document.getElementById('timer').textContent = `⏳ Next Spin: ${spinTimer}s`;
}, 1000);