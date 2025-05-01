import { connectWallet, disconnectWallet, updateWalletUI, autoReconnect } from './connectWallet.js';
import { launchToken } from './launchToken.js';
import { refreshTrending, createSimilarToken, viewCoin, buyToken, sellToken } from './coinPage.js';
import { showToast } from './toast.js';
import { state } from './state.js';

function toggleNav() {
  const navLinks = document.getElementById('navLinks');
  const hamburger = document.querySelector('.hamburger');
  const isExpanded = navLinks.classList.toggle('active');
  hamburger.setAttribute('aria-expanded', isExpanded);
}

function showPage(pageId) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  trackEvent('page_view', pageId);
}

function setActive(link) {
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
  link.setAttribute('aria-current', 'page');
}

function previewImage() {
  const fileInput = document.getElementById('token-image');
  const preview = document.getElementById('image-preview');
  const file = fileInput.files[0];

  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.', 'error');
      fileInput.value = '';
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showToast('Only PNG or JPG files are allowed.', 'error');
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
  }
}

function validateForm(step) {
  if (step === 1) {
    const name = document.getElementById('token-name').value;
    const symbol = document.getElementById('token-symbol').value;
    if (name.length < 3) {
      showToast('Token name must be at least 3 characters.', 'error');
      return false;
    }
    if (!/^[A-Z]{3,5}$/.test(symbol)) {
      showToast('Symbol must be 3–5 uppercase letters.', 'error');
      return false;
    }
  } else if (step === 2) {
    const supply = document.getElementById('total-supply').value;
    const decimals = document.getElementById('decimals').value;
    if (supply < 1) {
      showToast('Total supply must be at least 1.', 'error');
      return false;
    }
    if (decimals < 0 || decimals > 18) {
      showToast('Decimals must be between 0 and 18.', 'error');
      return false;
    }
  }
  return true;
}

function nextStep(step) {
  if (!validateForm(step - 1)) return;
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`).classList.add('active');
  document.querySelectorAll('.progress-step').forEach((prog, index) => {
    prog.classList.toggle('active', index < step);
  });

  if (step === 4) {
    const fields = {
      name: document.getElementById('token-name').value,
      symbol: document.getElementById('token-symbol').value,
      description: document.getElementById('token-description').value || 'N/A',
      supply: document.getElementById('total-supply').value,
      decimals: document.getElementById('decimals').value,
      treasuryFee: document.getElementById('treasury-fee').value,
      renounceMint: document.getElementById('renounce-mint').checked,
      allowFreeze: document.getElementById('allow-freeze').checked,
      imageUploaded: document.getElementById('token-image').files.length > 0 ? 'Yes' : 'No'
    };
    document.getElementById('review-text').innerHTML = `
      <strong>Name:</strong> ${DOMPurify.sanitize(fields.name)}<br>
      <strong>Symbol:</strong> ${DOMPurify.sanitize(fields.symbol)}<br>
      <strong>Description:</strong> ${DOMPurify.sanitize(fields.description)}<br>
      <strong>Total Supply:</strong> ${DOMPurify.sanitize(fields.supply)}<br>
      <strong>Decimals:</strong> ${DOMPurify.sanitize(fields.decimals)}<br>
      <strong>Treasury Fee:</strong> ${DOMPurify.sanitize(fields.treasuryFee)}%<br>
      <strong>Image Uploaded:</strong> ${DOMPurify.sanitize(fields.imageUploaded)}<br>
      <strong>Renounce Mint Authority:</strong> ${fields.renounceMint ? 'Yes' : 'No'}<br>
      <strong>Allow Token Freeze:</strong> ${fields.allowFreeze ? 'Yes' : 'No'}
    `;
  }
}

function prevStep(step) {
  nextStep(step);
}

function showConfirmation() {
  if (!state.isWalletConnected) {
    showToast('Please connect your wallet first.', 'error');
    return;
  }
  const fields = {
    name: document.getElementById('token-name').value,
    symbol: document.getElementById('token-symbol').value,
    description: document.getElementById('token-description').value || 'N/A',
    supply: document.getElementById('total-supply').value,
    decimals: document.getElementById('decimals').value,
    treasuryFee: document.getElementById('treasury-fee').value,
    renounceMint: document.getElementById('renounce-mint').checked,
    allowFreeze: document.getElementById('allow-freeze').checked,
    image: document.getElementById('image-preview').src
  };
  document.getElementById('modal-review').innerHTML = `
    <li><strong>Name:</strong> ${DOMPurify.sanitize(fields.name)}</li>
    <li><strong>Symbol:</strong> ${DOMPurify.sanitize(fields.symbol)}</li>
    <li><strong>Description:</strong> ${DOMPurify.sanitize(fields.description)}</li>
    <li><strong>Total Supply:</strong> ${DOMPurify.sanitize(fields.supply)}</li>
    <li><strong>Decimals:</strong> ${DOMPurify.sanitize(fields.decimals)}</li>
    <li><strong>Treasury Fee:</strong> ${DOMPurify.sanitize(fields.treasuryFee)}%</li>
    <li><strong>Renounce Mint Authority:</strong> ${fields.renounceMint ? 'Yes' : 'No'}</li>
    <li><strong>Allow Token Freeze:</strong> ${fields.allowFreeze ? 'Yes' : 'No'}</li>
    <li><strong>Image:</strong><br>${fields.image ? `<img src="${fields.image}" style="max-width: 100px; border-radius: 8px; margin-top: 1rem;" alt="Token Image" loading="lazy">` : 'No image uploaded'}</li>
  `;
  document.getElementById('confirmationModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('confirmationModal').style.display = 'none';
}

function saveFormState() {
  const formData = {
    'token-name': document.getElementById('token-name').value,
    'token-symbol': document.getElementById('token-symbol').value,
    'token-description': document.getElementById('token-description').value,
    'total-supply': document.getElementById('total-supply').value,
    'decimals': document.getElementById('decimals').value,
    'treasury-fee': document.getElementById('treasury-fee').value,
    'renounce-mint': document.getElementById('renounce-mint').checked,
    'allow-freeze': document.getElementById('allow-freeze').checked
  };
  sessionStorage.setItem('tokenForm', JSON.stringify(formData));
}

function restoreFormState() {
  const saved = sessionStorage.getItem('tokenForm');
  if (saved) {
    const formData = JSON.parse(saved);
    Object.keys(formData).forEach(key => {
      const el = document.getElementById(key);
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = formData[key];
        } else {
          el.value = formData[key];
        }
      }
    });
    if (document.getElementById('token-image').files.length) {
      previewImage();
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  refreshTrending();
  trackEvent('page_load', 'init');
  await autoReconnect();
  restoreFormState();

  // Navigation
  document.getElementById('link-create').addEventListener('click', e => {
    e.preventDefault();
    showPage('create-page');
    setActive(e.target);
  });
  document.getElementById('link-trending').addEventListener('click', e => {
    e.preventDefault();
    showPage('trending-page');
    setActive(e.target);
  });
  document.querySelector('.hamburger').addEventListener('click', toggleNav);

  // Wallet
  document.getElementById('walletBtn').addEventListener('click', () => {
    if (state.isWalletConnected) {
      disconnectWallet();
    } else {
      document.getElementById('walletModal').style.display = 'flex';
    }
  });
  document.getElementById('connectButton').addEventListener('click', () => {
    document.getElementById('walletModal').style.display = 'flex';
  });
  document.querySelectorAll('.wallet-option').forEach(btn => {
    btn.addEventListener('click', () => {
      connectWallet(btn.dataset.wallet);
      document.getElementById('walletModal').style.display = 'none';
    });
  });

  // Form
  document.getElementById('tokenForm').addEventListener('input', saveFormState);
  document.getElementById('token-image').addEventListener('change', previewImage);
  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', () => nextStep(parseInt(btn.dataset.step)));
  });
  document.querySelectorAll('.prev-btn').forEach(btn => {
    btn.addEventListener('click', () => prevStep(parseInt(btn.dataset.step)));
  });
  document.querySelector('#step4 .launch-btn').addEventListener('click', showConfirmation);
  document.querySelector('.modal .prev-btn').addEventListener('click', closeModal);
  document.querySelector('.modal .launch-btn').addEventListener('click', launchToken);

  // Trending
  document.querySelector('.refresh-btn').addEventListener('click', refreshTrending);
  document.getElementById('tokenCardsContainer').addEventListener('click', e => {
    if (e.target.classList.contains('create-coin-btn')) {
      createSimilarToken(e.target.dataset.name, e.target.dataset.symbol);
    } else if (e.target.classList.contains('view-coin-btn')) {
      viewCoin({
        name: e.target.dataset.name,
        symbol: e.target.dataset.symbol,
        marketcap: e.target.dataset.marketcap,
        contract: e.target.dataset.contract,
        image: e.target.dataset.image
      });
    }
  });

  // Buy/Sell
  document.querySelector('.buy-btn').addEventListener('click', buyToken);
  document.querySelector('.sell-btn').addEventListener('click', sellToken);

  // Keyboard accessibility
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('walletModal').style.display = 'none';
    }
  });
});
