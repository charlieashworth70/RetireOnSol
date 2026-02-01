import { useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWalletBalance } from '../hooks/useWalletBalance';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

interface WalletButtonProps {
  onBalanceLoaded?: (solBalance: number, jitoSolBalance: number) => void;
}

export function WalletButton({ onBalanceLoaded }: WalletButtonProps) {
  const { connected, disconnect, publicKey, wallets } = useWallet();
  const { setVisible } = useWalletModal();
  const { balance, jitoSolBalance, loading } = useWalletBalance();

  // Notify parent when balances are loaded
  useEffect(() => {
    if (balance !== null && onBalanceLoaded) {
      onBalanceLoaded(balance, jitoSolBalance ?? 0);
    }
  }, [balance, jitoSolBalance, onBalanceLoaded]);

  const showIOSMessage = useMemo(() => {
    if (!isIOS()) return false;
    // No wallets detected on iOS = user is in Safari, not a wallet browser
    return wallets.length === 0 || wallets.every(w => w.readyState === 'NotDetected');
  }, [wallets]);

  const handleClick = () => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  // iOS Safari with no wallet available
  if (showIOSMessage && !connected) {
    return (
      <div className="wallet-ios-hint">
        <span className="wallet-ios-icon">📱</span>
        <span className="wallet-ios-text">Open in your wallet&apos;s browser</span>
        <span className="wallet-ios-detail">
          Open Phantom or Solflare app → Browser tab → paste this URL
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`wallet-btn ${connected ? 'connected' : ''}`}
      onClick={handleClick}
    >
      {connected ? (
        <>
          <span className="wallet-address">{shortAddress}</span>
          {loading ? (
            <span className="wallet-balance">Loading...</span>
          ) : balance !== null ? (
            <span className="wallet-balance">
              {balance} SOL{jitoSolBalance && jitoSolBalance > 0 ? ` | ${jitoSolBalance} JitoSOL` : ''}
            </span>
          ) : null}
        </>
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
}
