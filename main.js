// State Management
let walletBalance = 500;
let tokensEarned = 0;
let currentBet = { multiplier: null, amount: 0 };
let lastInteraction = Date.now();
const INACTIVITY_THRESHOLD = 5 * 60 * 1000;
let firstBetPlaced = false;
let connectedWallet = null;

// Connect Phantom Wallet (with fallback to deep link for mobile)
async function connectPhantom() {
    console.log("Attempting wallet connect...");

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
            // Phantom deep link fallback (mobile)
            const dappUrl = encodeURIComponent("https://turbomeme.fun");
            window.location.href = `https://phantom.app/ul/browse/${dappUrl}`;
        }
    }, 300);
}

// Auto-connect if already approved
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

// Attach connect listener to button
document.addEventListener("DOMContentLoaded", () => {
    const connectBtn = document.getElementById("connectWalletBtn");
    if (connectBtn) {
        connectBtn.addEventListener("click", connectPhantom);
    }
});
