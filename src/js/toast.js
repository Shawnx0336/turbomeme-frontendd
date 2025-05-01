export function showToast(message, type = 'info') {
  Toastify({
    text: message,
    duration: 5000,
    close: true,
    gravity: 'top',
    position: 'center',
    backgroundColor: type === 'success' ? '#00ff88' : type === 'error' ? '#ff6b00' : '#00c2ff',
    className: 'toast-notification',
    escapeMarkup: false
  }).showToast();
}
