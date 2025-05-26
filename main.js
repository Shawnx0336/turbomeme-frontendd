
// State Management
let walletBalance = 500;
let tokensEarned = 0;
let currentBet = { multiplier: null, amount: 0 };
let lastInteraction = Date.now();
const INACTIVITY_THRESHOLD = 5 * 60 * 1000;
let firstBetPlaced = false;
let connectedWallet = null;

// Connect Phantom Wallet (with proper deep linking for mobile)
async function connectPhantom() {
    console.log("Connect attempt");

    setTimeout(async () => {
        if (window.solana && window.solana.isPhantom) {
            try {
                const resp = await window.solana.connect();
                connectedWallet = resp.publicKey.toString();
                document.getElementById("connectWalletBtn").textContent =
                    connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);
                showToast("Phantom wallet connected!", "success");
            } catch (err) {
                console.error("Phantom connect error:", err);
                showToast("Wallet connection cancelled", "error");
            }
        } else {
            const dappUrl = encodeURIComponent("https://turbomeme.fun");
            window.location.href = `phantom://browse/${dappUrl}`;
        }
    }, 300);
}

// Auto-reconnect on load
window.addEventListener("load", async () => {
    setTimeout(async () => {
        if (window.solana && window.solana.isPhantom) {
            try {
                const res = await window.solana.connect({ onlyIfTrusted: true });
                connectedWallet = res.publicKey.toString();
                document.getElementById("connectWalletBtn").textContent =
                    connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);
                showToast("Wallet auto-connected", "success");
            } catch {
                console.warn("Not yet connected.");
            }
        }
    }, 500);
});

// DOM Loaded Hook
document.addEventListener("DOMContentLoaded", () => {
    const connectBtn = document.getElementById("connectWalletBtn");
    if (connectBtn) {
        connectBtn.addEventListener("click", connectPhantom);
    }
});
