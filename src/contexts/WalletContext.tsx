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

  // On desktop: empty array lets Wallet Standard auto-detect Phantom, Solflare, Backpack etc.
  // On mobile Android: add MWA adapter so it can connect to mobile wallets via MWA protocol
  const wallets = useMemo(() => {
    if (isMobileAndroid()) {
      return [
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: 'RetireOnSol',
            uri: 'https://charlieashworth70.github.io/RetireOnSol/',
            icon: 'icons/icon.svg',
          },
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          cluster: 'mainnet-beta',
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        }),
      ];
    }
    // Desktop + iOS: rely on Wallet Standard auto-detection
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
