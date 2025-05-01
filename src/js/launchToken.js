import { state } from './state.js';
import { showToast } from './toast.js';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';

const BACKEND_URL = 'https://turbomeme.fun';
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

export async function launchToken() {
  if (!state.isWalletConnected) {
    showToast('Please connect your wallet first', 'error');
    return;
  }

  const formData = new FormData(document.getElementById('tokenForm'));
  const data = {
    name: formData.get('token-name'),
    symbol: formData.get('token-symbol'),
    decimals: parseInt(formData.get('decimals')),
    supply: parseInt(formData.get('total-supply')),
    treasuryFee: parseFloat(formData.get('treasury-fee')),
    renounceMint: formData.get('renounce-mint') === 'on',
    allowFreeze: formData.get('allow-freeze') === 'on',
    walletAddress: state.walletAddress
  };

  try {
    const response = await fetch(`${BACKEND_URL}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);

    const { transaction, mint } = await response.json();
    const transactionBytes = new Uint8Array(Buffer.from(transaction, 'base64'));
    const signedTx = await window[state.selectedWallet].signAndSendTransaction(transactionBytes);
    const signature = signedTx.signature;

    const status = await verifyTransaction(signature);
    if (status?.confirmationStatus !== 'finalized') {
      throw new Error('Transaction failed to finalize');
    }

    showToast('Token launched successfully!', 'success');
    showNotification(data.name, data.symbol, mint);

    document.getElementById('tokenForm').reset();
    nextStep(1);
    trackEvent('token_launch', 'success');
  } catch (err) {
    console.error('Launch Error:', err);
    showToast('Failed to launch token. Please try again.', 'error');
    trackEvent('token_launch', 'error');
  }
}

async function verifyTransaction(signature) {
  try {
    const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    return status.value[0];
  } catch (err) {
    console.error('Transaction Verification Error:', err);
    return null;
  }
}

function showNotification(name, symbol, mint) {
  const notification = document.getElementById('notification');
  document.getElementById('token-name').textContent = DOMPurify.sanitize(name);
  document.getElementById('token-symbol').textContent = DOMPurify.sanitize(symbol);
  document.getElementById('token-contract').textContent = DOMPurify.sanitize(mint);
  const solscanLink = document.getElementById('solscan-link');
  solscanLink.href = `https://solscan.io/token/${mint}`;
  solscanLink.textContent = DOMPurify.sanitize(`https://solscan.io/token/${mint}`);
  notification.classList.add('show');
  setTimeout(() => notification.classList.remove('show'), 10000);
}
