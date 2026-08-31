# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# TruthOracle — Decentralized Fact Verification
#
# A GenLayer Intelligent Contract that verifies claims using independent AI
# consensus. Multiple validators fetch web evidence, analyze it with LLMs,
# and reach comparative consensus on whether a claim is TRUE, FALSE, or
# INCONCLUSIVE.
#
# WHY GENLAYER IS NECESSARY:
# Fact-checking requires fetching live web data and interpreting unstructured
# information — impossible for traditional smart contracts. GenLayer's
# comparative consensus ensures no single validator can manipulate the verdict.
#
# CONSENSUS DESIGN:
# - Leader: Fetches evidence, renders verdict (TRUE/FALSE/INCONCLUSIVE)
# - Validators: Independently fetch and analyze, compare with leader
# - Agreement: Verdict must match leader's conclusion
# - Finality: Majority of validators must agree for consensus
#
# VERDICT SCORING:
# - TRUE: Claim is supported by evidence
# - FALSE: Claim is contradicted by evidence
# - INCONCLUSIVE: Evidence is insufficient or conflicting

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ALLOWED_VERDICTS = ("TRUE", "FALSE", "INCONCLUSIVE")
MAX_EVIDENCE_LENGTH = 8000  # chars to feed to LLM


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@allow_storage
@dataclass
class Claim:
    id: str
    text: str
    evidence_url: str
    submitter: str
    timestamp: u256
    resolved: bool
    verdict: str
    consensus_rounds: u256


@allow_storage
@dataclass
class ValidatorResponse:
    verdict: str
    reasoning: str
    evidence_hash: str  # hash of evidence used


# ---------------------------------------------------------------------------
# Contract
# ---------------------------------------------------------------------------

class TruthOracle(gl.Contract):
    claims: TreeMap[str, Claim]
    claim_counter: u256
    # claim_id -> list of validator responses
    responses: TreeMap[str, DynArray[ValidatorResponse]]

    def __init__(self):
        pass

    # ---------- time ----------

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    # ---------- consensus ----------

    def _fetch_evidence(self, url: str) -> str:
        """Fetch web evidence from URL."""
        try:
            evidence = gl.nondet.web.render(url, mode="text")
        except Exception:
            raise gl.vm.UserError("EVIDENCE_UNREACHABLE")
        if not evidence:
            raise gl.vm.UserError("EVIDENCE_EMPTY")
        return evidence[:MAX_EVIDENCE_LENGTH]

    def _analyze_claim(self, claim_text: str, evidence: str) -> dict:
        """Analyze claim against evidence using LLM."""
        prompt = (
            f"Claim: {claim_text}\n\n"
            f"Evidence from web:\n{evidence}\n\n"
            f"Task: Determine if the claim is supported by the evidence.\n"
            f"Consider:\n"
            f"1. Does the evidence directly confirm or deny the claim?\n"
            f"2. Is the evidence from a credible source?\n"
            f"3. Is there enough information to make a determination?\n\n"
            f"Respond as JSON: {{\"verdict\": \"TRUE\"|\"FALSE\"|\"INCONCLUSIVE\", "
            f"\"reasoning\": \"brief explanation\"}}"
        )
        res = gl.nondet.exec_prompt(prompt, response_format="json")
        verdict = (res.get("verdict") or "").strip().upper()
        if verdict not in ALLOWED_VERDICTS:
            verdict = "INCONCLUSIVE"
        return {
            "verdict": verdict,
            "reasoning": res.get("reasoning", "")
        }

    def _verify_consensus(self, claim_id: str, claim: Claim) -> str:
        """Run GenLayer consensus to verify a claim."""
        evidence_url = claim.evidence_url
        claim_text = claim.text

        def leader() -> dict:
            evidence = self._fetch_evidence(evidence_url)
            result = self._analyze_claim(claim_text, evidence)
            result["evidence_hash"] = str(hash(evidence))
            return result

        def validator(leaders_res) -> bool:
            # Error classification: agree only when we reproduce the outcome
            if not isinstance(leaders_res, gl.vm.Return):
                leader_msg = getattr(leaders_res, "message", "")
                try:
                    leader()
                    return False  # leader errored, we succeeded
                except gl.vm.UserError as e:
                    return str(e.message) == str(leader_msg)
                except Exception:
                    return False
            try:
                mine = leader()
            except Exception:
                return False
            # Agree if verdicts match (allows for reasoning differences)
            return mine["verdict"] == leaders_res.calldata["verdict"]

        try:
            verified = gl.vm.run_nondet_unsafe(leader, validator)
        except gl.vm.UserError as e:
            raise gl.vm.UserError(f"Consensus failed: {e.message}")
        return verified["verdict"]

    # ---------- writes ----------

    @gl.public.write
    def submit_claim(self, claim_id: str, text: str, evidence_url: str) -> None:
        """Submit a claim for verification."""
        if not claim_id:
            raise gl.vm.UserError("claim_id required")
        if not text:
            raise gl.vm.UserError("claim text required")
        if not evidence_url.startswith("http"):
            raise gl.vm.UserError("evidence_url must be http(s)")
        if self.claims.get(claim_id, None) is not None:
            raise gl.vm.UserError(f"Claim {claim_id} already exists.")

        self.claims[claim_id] = Claim(
            id=claim_id,
            text=text,
            evidence_url=evidence_url,
            submitter=gl.message.sender_address.as_hex,
            timestamp=u256(self._now()),
            resolved=False,
            verdict="",
            consensus_rounds=u256(0)
        )

    @gl.public.write
    def resolve_claim(self, claim_id: str) -> str:
        """Trigger consensus resolution for a claim."""
        claim = self.claims.get(claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim {claim_id} not found.")
        if claim.resolved:
            raise gl.vm.UserError(f"Claim {claim_id} already resolved.")

        verdict = self._verify_consensus(claim_id, claim)

        claim.resolved = True
        claim.verdict = verdict
        claim.consensus_rounds = u256(1)
        self.claims[claim_id] = claim
        return verdict

    # ---------- views ----------

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        """Get claim details."""
        claim = self.claims.get(claim_id, None)
        if claim is None:
            return json.dumps({"claim_id": claim_id, "exists": False})
        return json.dumps({
            "claim_id": claim.id,
            "exists": True,
            "text": claim.text,
            "evidence_url": claim.evidence_url,
            "submitter": claim.submitter,
            "timestamp": int(claim.timestamp),
            "resolved": claim.resolved,
            "verdict": claim.verdict,
            "consensus_rounds": int(claim.consensus_rounds)
        })

    @gl.public.view
    def get_claims_count(self) -> str:
        """Get total number of claims."""
        return str(len(self.claims))

    @gl.public.view
    def now(self) -> str:
        return str(self._now())
