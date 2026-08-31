'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const CONTRACT_ADDRESS = '0xA8c8986bd62AD9dD7445232213Eb5C03adE31D7d';

interface Claim {
  claim_id: string;
  exists: boolean;
  text?: string;
  evidence_url?: string;
  submitter?: string;
  timestamp?: number;
  resolved?: boolean;
  verdict?: string;
  consensus_rounds?: number;
}

interface GenLayerContextType {
  client: any;
  account: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  submitClaim: (claimId: string, text: string, evidenceUrl: string) => Promise<string>;
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

export function GenLayerProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<any>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      // Create client with testnet bradbury
      const newClient = createClient({
        chain: testnetBradbury,
      });

      // Connect wallet (MetaMask)
      await newClient.connect();

      // Get account
      const accounts = await newClient.getAddresses();
      const addr = accounts[0] || null;

      setClient(newClient);
      setAccount(addr);
      setConnected(true);
    } catch (err) {
      console.error('Connection failed:', err);
      alert('Connection failed. Make sure MetaMask is installed and unlocked.');
    }
    setConnecting(false);
  };

  const disconnect = () => {
    setClient(null);
    setAccount(null);
    setConnected(false);
  };

  const submitClaim = async (claimId: string, text: string, evidenceUrl: string): Promise<string> => {
    if (!client || !connected) throw new Error('Not connected');
    
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'submit_claim',
      args: [claimId, text, evidenceUrl],
      value: 0,
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: 'ACCEPTED',
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

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: 'ACCEPTED',
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
