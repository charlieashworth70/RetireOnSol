import { type FC, type ReactNode, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Default styles for the wallet modal
import '@solana/wallet-adapter-react-ui/styles.css';

// Detect mobile Android (for MWA adapter)
const isMobileAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // Phantom's public RPC — more reliable than api.mainnet-beta.solana.com (heavily rate-limited)
  const endpoint = useMemo(() => 'https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ', []);

  const wallets = useMemo(() => {
    // On Android, use MWA adapter for native app support
    // We remove explicit standard adapters (Phantom/Solflare) here to allow
    // the Wallet Standard protocol to auto-detect them without conflict.
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
    
    // On desktop/iOS, returning empty array allows Wallet Standard to auto-detect
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
