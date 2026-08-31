'use client';

import { useState, useEffect } from 'react';
import { useGenLayer } from '@/context/GenLayerContext';

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

export default function Home() {
  const { account, client, connected, connecting, connect, submitClaim, resolveClaim, getClaim } = useGenLayer();
  
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [claimId, setClaimId] = useState('');
  const [claimText, setClaimText] = useState('');
  const [claimCategory, setClaimCategory] = useState('General');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load all claims from blockchain
  const loadAllClaims = async () => {
    if (!connected || !client) return;
    setLoading(true);
    setError(null);
    try {
      // Get all claims by iterating through known IDs
      // We'll use a simple approach: check claim-1, claim-2, etc. until we hit a non-existent one
      const allClaims: Claim[] = [];
      let i = 1;
      while (true) {
        try {
          const claimRes: any = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_claim',
            args: [`claim-${i}`],
            stateStatus: 'accepted',
          });
          const data = claimRes?.data ?? claimRes;
          if (data && data !== 'undefined') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.exists) allClaims.push(parsed);
              else break;
            } catch (e) { break; }
          } else break;
        } catch (e) { break; }
        i++;
        if (i > 100) break; // safety limit
      }
      setClaims(allClaims);
    } catch (err: any) {
      console.error('Failed to load claims:', err);
      setError('Failed to load claims: ' + (err.message || 'Unknown error'));
    }
    setLoading(false);
  };

  // Load claims on connect
  useEffect(() => {
    if (connected) loadAllClaims();
  }, [connected]);

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
      
      // Add to local state immediately
      const newClaim: Claim = {
        claim_id: claimId,
        exists: true,
        text: claimText,
        category: claimCategory,
        submitter: account || '',
        timestamp: Math.floor(Date.now() / 1000),
        resolved: false,
        verdict: '',
        confidence: 0,
        validator_count: 0,
        reasoning: '',
        resolved_at: 0,
        appeal_count: 0,
      };
      setClaims([newClaim, ...claims]);
      
      // Clear form
      setClaimId('');
      setClaimText('');
      setClaimCategory('General');
      
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
    setResolving(id);
    setError(null);
    try {
      const txHash = await resolveClaim(id);
      
      // Update local state after a delay for AI consensus
      setTimeout(async () => {
        const updated = await getClaim(id);
        setClaims(claims.map(c => c.claim_id === id ? updated : c));
        setResolving(null);
      }, 5000);
      
      alert(`Resolution transaction sent! TX: ${txHash}\nWaiting for AI consensus...`);
    } catch (err: any) {
      console.error('Resolution failed:', err);
      setError(err.message || 'Resolution failed');
      setResolving(null);
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'TRUE': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'FALSE': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'INCONCLUSIVE': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredClaims = claims.filter(c => {
    if (filter === 'pending' && c.resolved) return false;
    if (filter === 'resolved' && !c.resolved) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.claim_id.toLowerCase().includes(q) ||
        c.text?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
            <select
              value={claimCategory}
              onChange={(e) => setClaimCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="General">General</option>
              <option value="Science">Science</option>
              <option value="News">News</option>
              <option value="Finance">Finance</option>
              <option value="Tech">Tech</option>
              <option value="Sports">Sports</option>
            </select>
            <button
              onClick={handleSubmitClaim}
              disabled={loading || !connected}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Submitting...' : connected ? 'Submit Claim' : 'Connect Wallet to Submit'}
            </button>
          </div>
        </div>

        {/* Claims Browser */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="text-white font-semibold text-lg">Claims</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search claims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500"
              />
              <div className="flex gap-1">
                {(['all', 'pending', 'resolved'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      filter === f
                        ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {claims.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
              <p className="text-white/40">No claims yet. Submit the first one above!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredClaims.map((claim) => (
                <div
                  key={claim.claim_id}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-white/40 text-xs font-mono">#{claim.claim_id}</span>
                    {claim.resolved && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getVerdictColor(claim.verdict || '')}`}>
                        {claim.verdict}
                      </span>
                    )}
                  </div>
                  <p className="text-white font-medium mb-3 line-clamp-2">{claim.text}</p>
                  {claim.category && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-3">
                      {claim.category}
                    </span>
                  )}
                  {claim.resolved && (
                    <div className="p-3 bg-white/5 rounded-lg mb-3">
                      <div className="flex items-center gap-3 text-xs text-white/60 mb-2">
                        <span>Confidence: {claim.confidence}%</span>
                        <span>Validators: {claim.validator_count}</span>
                      </div>
                      {claim.reasoning && (
                        <p className="text-white/70 text-sm line-clamp-3">{claim.reasoning}</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-xs text-white/40">
                      by {claim.submitter?.slice(0, 6)}...{claim.submitter?.slice(-4)}
                    </div>
                    {!claim.resolved && (
                      <button
                        onClick={() => handleResolveClaim(claim.claim_id)}
                        disabled={resolving === claim.claim_id || !connected}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                      >
                        {resolving === claim.claim_id ? 'Resolving...' : 'Resolve'}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-white/30 mt-2">
                    {claim.timestamp ? new Date(claim.timestamp * 1000).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-white">{claims.length}</div>
            <div className="text-white/40 text-sm">Total Claims</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-green-400">{claims.filter(c => c.verdict === 'TRUE').length}</div>
            <div className="text-white/40 text-sm">True</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-red-400">{claims.filter(c => c.verdict === 'FALSE').length}</div>
            <div className="text-white/40 text-sm">False</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-yellow-400">{claims.filter(c => c.verdict === 'INCONCLUSIVE').length}</div>
            <div className="text-white/40 text-sm">Inconclusive</div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
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
