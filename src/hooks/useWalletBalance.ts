import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useState, useEffect, useCallback } from 'react';
import { useDemoMode } from '../contexts/DemoContext';

const JITOSOL_MINT = new PublicKey('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn');
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

export interface WalletBalanceResult {
  balance: number | null;
  jitoSolBalance: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Extend window for Phantom
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      request: (args: { method: string; params?: unknown }) => Promise<unknown>;
    };
    solflare?: {
      isSolflare?: boolean;
      request: (args: { method: string; params?: unknown }) => Promise<unknown>;
    };
  }
}

async function getBalanceFromPhantom(publicKeyStr: string): Promise<number> {
  if (window.solana?.isPhantom) {
    try {
      const result = await window.solana.request({
        method: 'getBalance',
        params: { publicKey: publicKeyStr },
      });
      if (typeof result === 'number') {
        return result / LAMPORTS_PER_SOL;
      }
    } catch {
      // Fall through to alternative method
    }
  }
  throw new Error('Phantom balance request not available');
}

async function getBalanceFromDirectRPC(publicKeyStr: string): Promise<number> {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const pubkey = new PublicKey(publicKeyStr);
  const balance = await connection.getBalance(pubkey);
  return balance / LAMPORTS_PER_SOL;
}

async function getJitoSolBalance(publicKey: PublicKey): Promise<number> {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  try {
    const ata = await getAssociatedTokenAddress(JITOSOL_MINT, publicKey);
    const accountInfo = await connection.getTokenAccountBalance(ata);
    return Number(accountInfo.value.uiAmount ?? 0);
  } catch {
    // Account doesn't exist = 0 balance
    return 0;
  }
}

export function useWalletBalance(): WalletBalanceResult {
  const { publicKey, connected } = useWallet();
  const demo = useDemoMode();
  const [balance, setBalance] = useState<number | null>(null);
  const [jitoSolBalance, setJitoSolBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (demo.enabled) return;
    if (!publicKey || !connected) {
      setBalance(null);
      setJitoSolBalance(null);
      return;
    }

    const pubKeyStr = publicKey.toBase58();

    try {
      setLoading(true);
      setError(null);

      // Fetch SOL balance
      let sol: number;
      try {
        sol = await getBalanceFromPhantom(pubKeyStr);
      } catch {
        sol = await getBalanceFromDirectRPC(pubKeyStr);
      }

      // Fetch JitoSOL balance
      const jito = await getJitoSolBalance(publicKey);

      setBalance(Math.round(sol * 100) / 100);
      setJitoSolBalance(Math.round(jito * 100) / 100);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setError('Could not fetch balance');
      setBalance(null);
      setJitoSolBalance(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connected, demo.enabled]);

  useEffect(() => {
    if (demo.enabled) return;
    if (connected && publicKey) {
      fetchBalance();
    } else {
      setBalance(null);
      setJitoSolBalance(null);
      setError(null);
    }
  }, [connected, publicKey, fetchBalance, demo.enabled]);

  // Demo mode: return fake balances
  if (demo.enabled) {
    return {
      balance: demo.solBalance,
      jitoSolBalance: demo.jitoSolBalance,
      loading: false,
      error: null,
      refetch: async () => {},
    };
  }

  return { balance, jitoSolBalance, loading, error, refetch: fetchBalance };
}
