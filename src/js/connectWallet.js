import { state } from './state.js';
import { showToast } from './toast.js';
import { Connection, clusterApiUrl } from '@solana/web3.js';

const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

export async function connectWallet(walletType) {
  let solana;
  let deeplink;

  switch (walletType) {
    case 'phantom':
      solana = window.phantom?.solana;
      deeplink = 'phantom://';
      break;
    case 'solflare':
      solana = window.solflare;
      deeplink = 'solflare://';
      break;
    case 'walletconnect':
      showToast('WalletConnect not implemented yet', 'error');
      return;
    default:
      showToast('Invalid wallet type', 'error');
      return;
  }

  if (!solana) {
    showToast(`Please install ${walletType.charAt(0).toUpperCase() + walletType.slice(1)}. <a href="${walletType === 'phantom' ? 'https://phantom.app' : 'https://solflare.com'}" target="_blank">Download</a>`, 'error');
    return;
  }

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Wallet connection timed out')), 10000)
  );

  try {
    const response = await Promise.race([
      solana.connect(),
      timeout
    ]);
    const address = response.publicKey.toString();
    state.setWalletConnected(address, walletType);
    updateWalletUI();
    showToast(`Connected to ${walletType}: ${address.slice(0, 4)}...${address.slice(-4)}`, 'success');
    trackEvent('wallet_connect', walletType);
  } catch (err) {
    console.error('Wallet Connection Error:', err);
    showToast(`Failed to connect ${walletType}. Please open the app manually or install it from <a href="${walletType === 'phantom' ? 'https://apps.apple.com/app/phantom-crypto-wallet/id1598432977' : 'https://solflare.com'}" target="_blank">App Store</a>`, 'error');
    if (deeplink) {
      window.location.href = deeplink;
    }
  }
}

export function disconnectWallet() {
  const { selectedWallet } = state;
  if (selectedWallet && window[selectedWallet]?.disconnect) {
    window[selectedWallet].disconnect();
  }
  state.clearWallet();
  updateWalletUI();
  showToast('Wallet disconnected', 'info');
  trackEvent('wallet_disconnect', selectedWallet || 'unknown');
}

export function updateWalletUI() {
  const walletBtn = document.getElementById('walletBtn');
  const connectBtn = document.getElementById('connectButton');
  if (state.isWalletConnected && state.walletAddress) {
    walletBtn.textContent = `Connected: ${state.walletAddress.slice(0, 4)}...${state.walletAddress.slice(-4)}`;
    connectBtn.classList.add('hidden');
  } else {
    walletBtn.textContent = 'Connect Wallet';
    connectBtn.classList.remove('hidden');
  }
}

export async function autoReconnect() {
  state.restoreWallet();
  if (state.isWalletConnected && state.selectedWallet) {
    await connectWallet(state.selectedWallet);
  }
}
