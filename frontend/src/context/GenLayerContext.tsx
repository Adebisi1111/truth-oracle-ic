'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

// Declare window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: any;
    rabby?: any;
  }
}

const CONTRACT_ADDRESS = '0x0067D61d2b1992f9bC74e8d43d96dF98C5fccaf2';

interface Claim {
  claim_id: string;
  exists: boolean;
  text?: string;
  submitter?: string;
  timestamp?: number;
  resolved?: boolean;
  verdict?: string;
}

interface GenLayerContextType {
  client: any;
  account: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  submitClaim: (claimId: string, text: string) => Promise<string>;
  resolveClaim: (claimId: string) => Promise<string>;
  getClaim: (claimId: string) => Promise<Claim>;
  getClaimsCount: () => Promise<number>;
}

const GenLayerContext = createContext<GenLayerContextType>({
  client: null,
  account: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  submitClaim: async () => '',
  resolveClaim: async () => '',
  getClaim: async () => ({ claim_id: '', exists: false }),
  getClaimsCount: async () => 0,
});

export const useGenLayer = () => useContext(GenLayerContext);

// Detect wallet type
function detectWallet() {
  if (typeof window === 'undefined') return 'none';
  if (window.rabby) return 'rabby';
  if (window.ethereum?.isRabby) return 'rabby';
  if (window.ethereum?.isMetaMask) return 'metamask';
  if (window.ethereum) return 'unknown';
  return 'none';
}

export function GenLayerProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<any>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      const wallet = detectWallet();
      
      if (wallet === 'none') {
        alert('No wallet detected. Please install MetaMask or Rabby wallet extension.');
        setConnecting(false);
        return;
      }

      // Get the provider (Rabby and MetaMask both use window.ethereum)
      const provider = window.rabby?.provider || window.ethereum;
      
      if (!provider) {
        alert('Wallet provider not found. Please make sure your wallet is unlocked.');
        setConnecting(false);
        return;
      }

      // Check current chain and switch to GenLayer Bradbury if needed
      const currentChainId = await provider.request({ method: 'eth_chainId' });
      const bradburyChainId = '0x1065'; // 4221 in hex
      
      if (currentChainId !== bradburyChainId) {
        console.log('Current chain:', currentChainId, '- switching to GenLayer Bradbury...');
        try {
          // Try to switch to GenLayer Bradbury
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: bradburyChainId }],
          });
        } catch (switchError: any) {
          // If the network is not added, add it
          if (switchError.code === 4902) {
            console.log('Network not found, adding GenLayer Bradbury...');
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: bradburyChainId,
                chainName: 'GenLayer Bradbury Testnet',
                rpcUrls: ['https://rpc-bradbury.genlayer.com'],
                nativeCurrency: {
                  name: 'GEN',
                  symbol: 'GEN',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Request account access
      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        alert('No accounts found. Please unlock your wallet.');
        setConnecting(false);
        return;
      }
      
      const addr = accounts[0];
      
      // Create genlayer client with the wallet address
      const newClient = createClient({
        chain: testnetBradbury,
        account: addr
      });

      setClient(newClient);
      setAccount(addr);
      setConnected(true);
    } catch (err: any) {
      console.error('Connection failed:', err);
      if (err.code === 4001) {
        alert('Connection rejected by user.');
      } else if (err.code === -32002) {
        alert('Connection request already pending. Please check your wallet.');
      } else {
        alert('Connection failed: ' + (err.message || 'Unknown error'));
      }
    }
    setConnecting(false);
  };

  const disconnect = () => {
    setClient(null);
    setAccount(null);
    setConnected(false);
  };

  const submitClaim = async (claimId: string, text: string): Promise<string> => {
    if (!client || !connected) throw new Error('Not connected');
    
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'submit_claim',
      args: [claimId, text],
      value: 0,
    });

    return txHash;
  };

  const resolveClaim = async (claimId: string): Promise<string> => {
    if (!client || !connected) throw new Error('Not connected');
    
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'resolve_claim',
      args: [claimId],
      value: 0,
    });

    return txHash;
  };

  const getClaim = async (claimId: string): Promise<Claim> => {
    if (!client) throw new Error('Not connected');
    
    const result = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claim',
      args: [claimId],
      stateStatus: 'accepted',
    });

    return JSON.parse(result.data);
  };

  const getClaimsCount = async (): Promise<number> => {
    if (!client) throw new Error('Not connected');
    
    const result = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claims_count',
      args: [],
      stateStatus: 'accepted',
    });

    return parseInt(result.data);
  };

  return (
    <GenLayerContext.Provider
      value={{
        client,
        account,
        connected,
        connecting,
        connect,
        disconnect,
        submitClaim,
        resolveClaim,
        getClaim,
        getClaimsCount,
      }}
    >
      {children}
    </GenLayerContext.Provider>
  );
}
