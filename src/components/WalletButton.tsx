import { useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
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
  const { connected, wallets } = useWallet();
  const { balance, jitoSolBalance, loading } = useWalletBalance();

  // Notify parent when balances are loaded
  useEffect(() => {
    if (balance !== null && onBalanceLoaded) {
      onBalanceLoaded(balance, jitoSolBalance ?? 0);
    }
  }, [balance, jitoSolBalance, onBalanceLoaded]);

  const showIOSMessage = useMemo(() => {
    if (!isIOS()) return false;
    return wallets.length === 0 || wallets.every(w => w.readyState === 'NotDetected');
  }, [wallets]);

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
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
      {connected && !loading && balance !== null && (
        <span className="wallet-balance-display">
          {balance} SOL{jitoSolBalance && jitoSolBalance > 0 ? ` | ${jitoSolBalance} JitoSOL` : ''}
        </span>
      )}
      {connected && loading && (
        <span className="wallet-balance-display">Loading...</span>
      )}
    </div>
  );
}
