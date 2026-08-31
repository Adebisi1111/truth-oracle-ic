'use client';

import { useState } from 'react';

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

export default function Home() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimId, setClaimId] = useState('');
  const [claimText, setClaimText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
      } catch (err) {
        console.error('Wallet connection failed:', err);
      }
    } else {
      alert('Please install MetaMask');
    }
  };

  const submitClaim = async () => {
    if (!walletConnected) {
      alert('Please connect wallet first');
      return;
    }
    if (!claimId || !claimText || !evidenceUrl) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      // In production, this would call the GenLayer contract
      // For now, we simulate the submission
      const newClaim: Claim = {
        claim_id: claimId,
        exists: true,
        text: claimText,
        evidence_url: evidenceUrl,
        submitter: walletAddress,
        timestamp: Math.floor(Date.now() / 1000),
        resolved: false,
        verdict: '',
        consensus_rounds: 0,
      };
      setClaims([newClaim, ...claims]);
      setClaimId('');
      setClaimText('');
      setEvidenceUrl('');
      alert('Claim submitted! (Demo mode - connect to GenLayer for real transactions)');
    } catch (err) {
      console.error('Submission failed:', err);
      alert('Submission failed');
    }
    setLoading(false);
  };

  const resolveClaim = async (id: string) => {
    if (!walletConnected) {
      alert('Please connect wallet first');
      return;
    }
    setLoading(true);
    // Simulate resolution
    setClaims(claims.map(c => 
      c.claim_id === id 
        ? { ...c, resolved: true, verdict: ['TRUE', 'FALSE', 'INCONCLUSIVE'][Math.floor(Math.random() * 3)] }
        : c
    ));
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
            onClick={connectWallet}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              walletConnected
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
            }`}
          >
            {walletConnected
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
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
            Submit claims with evidence URLs. Independent AI validators fetch and analyze
            the evidence, then reach consensus on whether it's true, false, or inconclusive.
          </p>
        </div>

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
              placeholder="Enter your claim (e.g., 'Company X announced product Y on date Z')"
              value={claimText}
              onChange={(e) => setClaimText(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 resize-none"
            />
            <input
              type="url"
              placeholder="Evidence URL (e.g., https://example.com/article)"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={submitClaim}
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Claim'}
            </button>
          </div>
        </div>

        {/* Claims List */}
        <div className="space-y-4">
          <h3 className="text-white font-semibold text-lg">Claims</h3>
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
                      onClick={() => resolveClaim(claim.claim_id)}
                      disabled={loading}
                      className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <a
                    href={claim.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white/60 truncate max-w-xs"
                  >
                    🔗 {claim.evidence_url}
                  </a>
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
            <p className="text-white/40 text-sm">Multiple AI validators fetch and analyze evidence independently</p>
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
