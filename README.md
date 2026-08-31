# TruthOracle — Decentralized Fact Verification

A GenLayer Intelligent Contract that verifies claims using independent AI consensus. Multiple validators fetch web evidence, analyze it with LLMs, and reach comparative consensus on whether a claim is TRUE, FALSE, or INCONCLUSIVE.

## How It Works

1. **Submit** — User submits a claim with evidence URL
2. **Fetch** — Leader fetches web evidence and analyzes with LLM
3. **Validate** — Validators independently fetch and analyze
4. **Consensus** — Verdict recorded when majority agrees

## Contract Methods

| Method | Type | Description |
|---|---|---|
| `submit_claim(claim_id, text, evidence_url)` | write | Submit a claim for verification |
| `resolve_claim(claim_id)` | write | Trigger consensus resolution |
| `get_claim(claim_id)` | view | Get claim details |
| `get_claims_count()` | view | Get total claims |

## Consensus Design

- **Leader**: Fetches evidence, renders verdict (TRUE/FALSE/INCONCLUSIVE)
- **Validators**: Independently fetch and analyze, compare with leader
- **Agreement**: Verdict must match leader's conclusion
- **Finality**: Majority of validators must agree

## Verdict Scoring

- **TRUE**: Claim is supported by evidence
- **FALSE**: Claim is contradicted by evidence
- **INCONCLUSIVE**: Evidence is insufficient or conflicting

## Deployed Contract

- **Address**: `0xA8c8986bd62AD9dD7445232213Eb5C03adE31D7d`
- **Network**: GenLayer Bradbury Testnet
- **Explorer**: https://explorer-bradbury.genlayer.com/address/0xA8c8986bd62AD9dD7445232213Eb5C03adE31D7d

## Why GenLayer is Necessary

Fact-checking requires fetching live web data and interpreting unstructured information — impossible for traditional smart contracts. GenLayer's comparative consensus ensures no single validator can manipulate the verdict.
