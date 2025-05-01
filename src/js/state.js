export const state = {
  isWalletConnected: false,
  walletAddress: '',
  selectedWallet: null,
  setWalletConnected(address, walletType) {
    this.isWalletConnected = !!address;
    this.walletAddress = address || '';
    this.selectedWallet = walletType || null;
    sessionStorage.setItem('walletState', JSON.stringify({
      walletAddress: this.walletAddress,
      selectedWallet: this.selectedWallet
    }));
  },
  clearWallet() {
    this.isWalletConnected = false;
    this.walletAddress = '';
    this.selectedWallet = null;
    sessionStorage.removeItem('walletState');
  },
  restoreWallet() {
    const saved = sessionStorage.getItem('walletState');
    if (saved) {
      const { walletAddress, selectedWallet } = JSON.parse(saved);
      this.isWalletConnected = !!walletAddress;
      this.walletAddress = walletAddress;
      this.selectedWallet = selectedWallet;
    }
  }
};
