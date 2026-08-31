'use client';

import { useState } from 'react';
import { useGenLayer } from '@/context/GenLayerContext';

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

export default function Home() {
  const { account, connected, connecting, connect, submitClaim, resolveClaim, getClaim } = useGenLayer();
  
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimId, setClaimId] = useState('');
  const [claimText, setClaimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmitClaim = async () => {
    if (!connected) {
      alert('Please connect wallet first');
      return;
    }
    if (!claimId || !claimText) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const txHash = await submitClaim(claimId, claimText);
      
      // Fetch the newly created claim
      const newClaim = await getClaim(claimId);
      setClaims([newClaim, ...claims]);
      
      // Clear form
      setClaimId('');
      setClaimText('');
      
      alert(`Claim submitted! TX: ${txHash}`);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setError(err.message || 'Submission failed');
    }
    setLoading(false);
  };

  const handleResolveClaim = async (id: string) => {
    if (!connected) {
      alert('Please connect wallet first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const txHash = await resolveClaim(id);
      
      // Fetch updated claim
      const updated = await getClaim(id);
      setClaims(claims.map(c => c.claim_id === id ? updated : c));
      
      alert(`Claim resolved! TX: ${txHash}`);
    } catch (err: any) {
      console.error('Resolution failed:', err);
      setError(err.message || 'Resolution failed');
    }
    setLoading(false);
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'TRUE': return 'bg-green-100 text-green-800 border-green-200';
      case 'FALSE': return 'bg-red-100 text-red-800 border-red-200';
      case 'INCONCLUSIVE': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const loadClaim = async (id: string) => {
    if (!connected) {
      alert('Please connect wallet first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const claim = await getClaim(id);
      if (claim.exists) {
        // Check if claim already in list
        const existing = claims.find(c => c.claim_id === id);
        if (existing) {
          setClaims(claims.map(c => c.claim_id === id ? claim : c));
        } else {
          setClaims([claim, ...claims]);
        }
      } else {
        alert('Claim not found');
      }
    } catch (err: any) {
      console.error('Load failed:', err);
      setError(err.message || 'Load failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">TruthOracle</h1>
              <p className="text-white/50 text-xs">Decentralized Fact Verification</p>
            </div>
          </div>
          <button
            onClick={connect}
            disabled={connecting || connected}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              connected
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
            }`}
          >
            {connecting
              ? 'Connecting...'
              : connected
              ? `${account?.slice(0, 6)}...${account?.slice(-4)}`
              : 'Connect Wallet'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Verify Anything with AI Consensus
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Submit claims and our AI consensus mechanism will verify them using
            independent validator analysis.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Form */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-semibold text-lg mb-4">Submit a Claim</h3>
          <div className="grid gap-4">
            <input
              type="text"
              placeholder="Claim ID (unique identifier)"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
            <textarea
              placeholder="Enter your claim (e.g., 'The Earth orbits the Sun')"
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 resize-none"
            />
            <button
              onClick={handleSubmitClaim}
              disabled={loading || !connected}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Submitting...' : connected ? 'Submit Claim' : 'Connect Wallet to Submit'}
            </button>
          </div>
        </div>

        {/* Lookup Claim */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-semibold text-lg mb-4">Lookup Claim</h3>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter claim ID to lookup"
              id="lookupClaimId"
              className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={() => {
                const id = (document.getElementById('lookupClaimId') as HTMLInputElement).value;
                if (id) loadClaim(id);
              }}
              disabled={loading || !connected}
              className="px-6 py-3 rounded-lg bg-purple-500/20 text-purple-400 font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
            >
              Lookup
            </button>
          </div>
        </div>

        {/* Claims List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-white font-semibold text-lg">Claims</h3>
            <span className="text-white/40 text-sm">{claims.length} total</span>
          </div>
          {claims.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40">No claims yet. Submit the first one above!</p>
            </div>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.claim_id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white/40 text-xs font-mono">#{claim.claim_id}</span>
                      {claim.resolved && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getVerdictColor(claim.verdict || '')}`}>
                          {claim.verdict}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium">{claim.text}</p>
                  </div>
                  {!claim.resolved && (
                    <button
                      onClick={() => handleResolveClaim(claim.claim_id)}
                      disabled={loading || !connected}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>by {claim.submitter?.slice(0, 6)}...{claim.submitter?.slice(-4)}</span>
                  <span>{claim.timestamp ? new Date(claim.timestamp * 1000).toLocaleString() : ''}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="text-2xl mb-2">🔍</div>
            <h4 className="text-white font-medium mb-1">Independent Verification</h4>
            <p className="text-white/40 text-sm">Multiple AI validators analyze claims independently</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="text-2xl mb-2">🤝</div>
            <h4 className="text-white font-medium mb-1">Consensus Mechanism</h4>
            <p className="text-white/40 text-sm">Verdict reached when majority of validators agree</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="text-2xl mb-2">⛓️</div>
            <h4 className="text-white font-medium mb-1">On-Chain Record</h4>
            <p className="text-white/40 text-sm">All claims and verdicts immutably stored on GenLayer</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-white/30 text-sm">
          TruthOracle — Built on GenLayer | Contract: {CONTRACT_ADDRESS.slice(0, 10)}...
        </div>
      </footer>
    </div>
  );
}
