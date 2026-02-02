import { type FC, type ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';

// Default styles for the wallet modal
import '@solana/wallet-adapter-react-ui/styles.css';

// Detect mobile platforms
const isMobileAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

const isMobileIOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // Phantom's public RPC — more reliable than api.mainnet-beta.solana.com (heavily rate-limited)
  const endpoint = useMemo(() => 'https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ', []);

  const wallets = useMemo(() => {
    // On Android, use MWA adapter for native app support
    if (isMobileAndroid()) {
      return [
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: 'RetireOnSol',
            uri: 'https://charlieashworth70.github.io/RetireOnSol/',
            icon: 'https://charlieashworth70.github.io/RetireOnSol/icons/icon.svg',
          },
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          cluster: 'mainnet-beta',
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        }),
      ];
    }
    
    // On iOS, use explicit wallet adapters (no MWA support on iOS)
    // iOS wallets connect via deep links (phantom://, solflare://, etc.)
    if (isMobileIOS()) {
      return [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
      ];
    }
    
    // On desktop, returning empty array allows Wallet Standard to auto-detect
    return [];
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
