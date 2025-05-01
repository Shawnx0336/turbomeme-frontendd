import { showToast } from './toast.js';

export function refreshTrending() {
  const container = document.getElementById('tokenCardsContainer');
  container.innerHTML = [
    generateTokenCard('Elon Alt', '$DUROV2025', '$50K', 'So123...abc', 'https://via.placeholder.com/100?text=Elon'),
    generateTokenCard('LOLcats', '$LOLCATS', '$24K', 'So456...def', 'https://via.placeholder.com/100?text=LOL'),
    generateTokenCard('NutJob', '$NUT', '$51K', 'So789...ghi', null),
    generateTokenCard('BONK TRUMP', '$BONKTRUMP', '$53K', 'Soabc...jkl', 'https://via.placeholder.com/100?text=Bonk')
  ].join('');
}

function generateTokenCard(name, symbol, marketcap, contract, imageUrl) {
  const image = imageUrl ? `<img src="${imageUrl}" class="token-image" alt="${DOMPurify.sanitize(name)} Image" loading="lazy" style="display: block;">` : '';
  return `
    <div class="token-card" role="listitem">
      ${image}
      <h2 class="token-name">${DOMPurify.sanitize(name)}</h2>
      <p class="token-symbol">${DOMPurify.sanitize(symbol)}</p>
      <p class="token-marketcap">Market Cap: ${DOMPurify.sanitize(marketcap)}</p>
      <p class="token-address">Contract: <a href="https://explorer.solana.com/address/${contract}" target="_blank" rel="noopener noreferrer">${DOMPurify.sanitize(contract.slice(0, 6))}...</a></p>
      <button class="create-coin-btn" data-name="${DOMPurify.sanitize(name)}" data-symbol="${DOMPurify.sanitize(symbol)}" aria-label="Create similar token">+ Create Similar</button>
      <button class="view-coin-btn" data-name="${DOMPurify.sanitize(name)}" data-symbol="${DOMPurify.sanitize(symbol)}" data-marketcap="${DOMPurify.sanitize(marketcap)}" data-contract="${DOMPurify.sanitize(contract)}" data-image="${imageUrl || ''}" aria-label="View token details">View Details</button>
    </div>
  `;
}

export function createSimilarToken(name, symbol) {
  document.getElementById('token-name').value = `${DOMPurify.sanitize(name)} Copy`;
  document.getElementById('token-symbol').value = DOMPurify.sanitize(symbol.slice(1, -1)) + '2';
  showPage('create-page');
  setActive(document.getElementById('link-create'));
  showToast(`Simulating creation of a similar token to ${name}`, 'info');
}

export function viewCoin({ name, symbol, marketcap, contract, image }) {
  document.getElementById('view-coin-title').textContent = DOMPurify.sanitize(name);
  document.getElementById('view-coin-symbol').textContent = DOMPurify.sanitize(symbol);
  document.getElementById('view-coin-marketcap').textContent = DOMPurify.sanitize(marketcap);
  const contractLink = document.getElementById('view-coin-contract');
  contractLink.href = `https://explorer.solana.com/address/${contract}`;
  contractLink.textContent = DOMPurify.sanitize(contract);
  const imageEl = document.getElementById('view-coin-image');
  if (image) {
    imageEl.src = image;
    imageEl.style.display = 'block';
  } else {
    imageEl.style.display = 'none';
  }
  showPage('view-coin-page');
}

export async function buyToken() {
  const btn = document.querySelector('.buy-btn');
  btn.setAttribute('data-loading', 'true');
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    showToast('Successfully bought token!', 'success');
  } catch {
    showToast('Failed to buy token.', 'error');
  } finally {
    btn.setAttribute('data-loading', 'false');
  }
}

export async function sellToken() {
  const btn = document.querySelector('.sell-btn');
  btn.setAttribute('data-loading', 'true');
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    showToast('Successfully sold token!', 'success');
  } catch {
    showToast('Failed to sell token.', 'error');
  } finally {
    btn.setAttribute('data-loading', 'false');
  }
}
