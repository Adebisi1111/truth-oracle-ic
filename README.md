# TruthOracle — Decentralized Fact Verification

**Continuously verifiable fact-checking with AI consensus on GenLayer.**

TruthOracle enables trustless fact verification where claims are assessed by AI validators using evidence URLs. When a claim is submitted, GenLayer validators independently retrieve and assess the evidence, reaching consensus on the verdict.

## How It Works

The agreement is machine-readable and includes:
- What needs to be done (claim text)
- Evidence URL (source material for verification)
- Category (Science, News, Finance, Tech, Sports, General)
- What counts as valid proof (AI consensus on evidence)

The submitter sends a claim with an evidence URL. GenLayer validators then:
1. **Retrieve** the evidence from the URL via equivalence principle
2. **Bind** the evidence to the claim on-chain
3. **Assess** the claim against the evidence independently
4. **Reach consensus** on the verdict (TRUE, FALSE, or INCONCLUSIVE)

**If consensus is reached** → verdict stored on-chain with confidence score and reasoning.
**If consensus fails** → INCONCLUSIVE verdict recorded.

Verification is checked when the claim is resolved — not after disputes.

## Key Features

- **Evidence Retrieval** — Contract fetches evidence via equivalence principle (all validators see same content)
- **AI Consensus** — Multiple validators independently assess the evidence
- **On-Chain Verdict** — Verdict, confidence, and reasoning stored immutably
- **Client-to-Contract Alignment** — Frontend sends exact signature: `submit_claim(string,string,string,string)`
- **End-to-End Testing** — Tests exercise the full client workflow

## Live

- **Frontend:** https://adebisi1111.github.io/truth-oracle-ic/
- **Contract:** `0xCeaB0725451D69c0bba38248DeA547872Cd73ccc` (GenLayer Bradbury)

## Client Workflow

The frontend encodes the transaction with all 4 arguments:

```javascript
var iface = new ethers.utils.Interface(['function submit_claim(string,string,string,string)']);
var data = iface.encodeFunctionData('submit_claim',[id,text,evidenceUrl,category]);
```

This ensures the client, backend, and contract are fully aligned on the canonical signature.

## Canonical Contract

The single canonical interface is `contracts/truth_oracle_canonical.py`:

```python
def submit_claim(self, claim_id: str, text: str, evidence_url: str, category: str) -> None:
```

**All clients must match this exact signature.**

## Who It's For

- **Researchers** who want verifiable fact-checking on-chain
- **Publishers** who need transparent evidence assessment
- **Developers** building applications that require trustless verification

## Why Now?

AI-generated content is exploding. TruthOracle provides a way to verify claims transparently, with evidence stored on-chain and consensus reached independently by multiple validators.

## Tech Stack

- **GenLayer** — AI-native blockchain for intelligent contracts
- **Python** — Smart contract development
- **Ethers.js** — Frontend blockchain interaction
- **React** — Frontend framework

## License

MIT
