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

// Connect Button Event Binding
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("connectPhantomBtn");
  if (btn) btn.addEventListener("click", connectPhantom);
});
