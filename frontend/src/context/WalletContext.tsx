'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// GenLayer Context for wallet state
interface WalletContextType {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      // Check for MetaMask or any Ethereum wallet
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        setAddress(accounts[0]);
        setConnected(true);
        
        // Listen for account changes
        (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0]);
          } else {
            setAddress(null);
            setConnected(false);
          }
        });
      } else {
        alert('Please install a Web3 wallet like MetaMask');
      }
    } catch (err) {
      console.error('Connection failed:', err);
    }
    setConnecting(false);
  };

  const disconnect = () => {
    setAddress(null);
    setConnected(false);
  };

  return (
    <WalletContext.Provider value={{ address, connected, connecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
