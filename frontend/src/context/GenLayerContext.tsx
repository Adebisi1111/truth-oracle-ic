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

const CONTRACT_ADDRESS = '0x5ADaFc3004fF89A869DEE967DFAe8091d982b60d';

interface Claim {
  claim_id: string;
  exists: boolean;
  text?: string;
  category?: string;
  submitter?: string;
  timestamp?: number;
  resolved?: boolean;
  verdict?: string;
  confidence?: number;
  validator_count?: number;
  reasoning?: string;
  resolved_at?: number;
  appeal_count?: number;
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

// Retry wrapper for rate limiting
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let attempt = 0;
  let delay = 4000;
  
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.error?.message ?? e?.message ?? '';
      if (msg.includes('-32005') || msg.includes('rate limit') || msg.includes('empty')) {
        console.warn(`Retry ${attempt + 1}/${maxAttempts} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        attempt++;
        continue;
      }
      throw e;
    }
  }
  throw new Error('Too many retries');
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

      const provider = window.rabby?.provider || window.ethereum;
      
      if (!provider) {
        alert('Wallet provider not found. Please make sure your wallet is unlocked.');
        setConnecting(false);
        return;
      }

      // Check current chain and switch to GenLayer Bradbury if needed
      const currentChainId = await provider.request({ method: 'eth_chainId' });
      const bradburyChainId = '0x107D'; // 4221 in hex
      
      if (currentChainId !== bradburyChainId) {
        console.log('Current chain:', currentChainId, '- switching to GenLayer Bradbury...');
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: bradburyChainId }],
          });
        } catch (switchError: any) {
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

      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        alert('No accounts found. Please unlock your wallet.');
        setConnecting(false);
        return;
      }
      
      const addr = accounts[0];
      
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
    
    console.log('Submitting claim...', { claimId, text });
    
    const txHash: string = await withRetry<string>(() => client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'submit_claim',
      args: [claimId, text, 'General'],
      value: 0,
    }));
    
    console.log('Submit tx hash:', txHash);

    const receipt = await withRetry<any>(() => client.waitForTransactionReceipt({
      hash: txHash,
      status: 'ACCEPTED',
    }));
    
    console.log('Submit receipt:', receipt);

    return txHash;
  };

  const resolveClaim = async (claimId: string): Promise<string> => {
    if (!client || !connected) throw new Error('Not connected');
    
    console.log('Resolving claim...', { claimId });
    
    const txHash: string = await withRetry<string>(() => client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'resolve_claim',
      args: [claimId],
      value: 0,
    }));
    
    console.log('Resolve tx hash:', txHash);

    const receipt = await withRetry<any>(() => client.waitForTransactionReceipt({
      hash: txHash,
      status: 'ACCEPTED',
    }));
    
    console.log('Resolve receipt:', receipt);

    return txHash;
  };

  const getClaim = async (claimId: string): Promise<Claim> => {
    if (!client) throw new Error('Not connected');
    
    // Wait for state to settle
    await new Promise(r => setTimeout(r, 3000));
    
    const result: any = await withRetry(() => client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claim',
      args: [claimId],
      stateStatus: 'accepted',
    }));

    console.log('getClaim raw result:', result);
    
    // Handle different response formats
    const data = result?.data ?? result;
    if (!data || data === 'undefined' || data === 'null') {
      return { claim_id: claimId, exists: false };
    }
    
    try {
      const parsed = JSON.parse(data);
      return parsed;
    } catch (e) {
      console.error('JSON parse error:', e, 'data:', data);
      return { claim_id: claimId, exists: false };
    }
  };

  const getClaimsCount = async (): Promise<number> => {
    if (!client) throw new Error('Not connected');
    
    const result: any = await withRetry(() => client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claims_count',
      args: [],
      stateStatus: 'accepted',
    }));

    return parseInt(result?.data || result || '0');
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
