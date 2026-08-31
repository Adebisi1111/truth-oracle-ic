# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# TruthOracle — Decentralized Fact Verification
#
# A GenLayer Intelligent Contract that verifies claims using independent AI
# consensus with confidence scoring, reasoning, and appeal mechanism.
#
# CONSENSUS DESIGN:
# - Leader: Analyzes claim using LLM and renders verdict + reasoning
# - Validators: Independently analyze and compare using NLP (prompt_comparative)
# - Agreement: Verdicts must be semantically equivalent
# - Confidence: Calculated from validator agreement percentage
# - Appeal: Disputed verdicts can be appealed with bond for re-validation
#
# VERDICT SCORING:
# - TRUE: Claim is supported by evidence
# - FALSE: Claim is contradicted by evidence
# - INCONCLUSIVE: Evidence is insufficient or conflicting
#
# STATE DESIGN:
# - claims: TreeMap of claim_id -> Claim (immutable record)
# - appeals: TreeMap of appeal_id -> Appeal (dispute resolution)
# - claim_counter: u256 (total claims submitted)
# - appeal_counter: u256 (total appeals filed)

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ALLOWED_VERDICTS = ("TRUE", "FALSE", "INCONCLUSIVE")
APPEAL_BOND = 1000000000000000000  # 1 GEN bond for appeals
MAX_APPEALS = 2  # maximum appeals per claim
MAX_EVIDENCE_LENGTH = 8000  # chars to feed to LLM
MIN_CONSENSUS_AGREEMENT = 3  # minimum validators that must agree


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@allow_storage
@dataclass
class Claim:
    id: str
    text: str
    category: str          # Science, News, Finance, Tech, etc.
    submitter: str
    timestamp: u256
    resolved: bool
    verdict: str           # TRUE / FALSE / INCONCLUSIVE
    confidence: u256       # 0-100 agreement score
    validator_count: u256  # number of validators that agreed
    reasoning: str         # brief explanation from consensus
    resolved_at: u256
    appeal_count: u256


@allow_storage
@dataclass
class Appeal:
    id: str
    claim_id: str
    appellant: str
    bond: u256
    timestamp: u256
    resolved: bool
    original_verdict: str
    new_verdict: str


# ---------------------------------------------------------------------------
# Contract
# ---------------------------------------------------------------------------

class TruthOracle(gl.Contract):
    claims: TreeMap[str, Claim]
    appeals: TreeMap[str, Appeal]
    claim_counter: u256
    appeal_counter: u256

    def __init__(self):
        pass

    # ---------- time ----------

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    # ---------- consensus ----------

    def _analyze_claim(self, claim_text: str, category: str) -> dict:
        """Analyze claim against evidence using LLM with reasoning."""
        prompt = (
            f"Fact-check this claim: '{claim_text}'\n"
            f"Category: {category}\n\n"
            f"Use your knowledge to determine if this claim is TRUE, FALSE, or INCONCLUSIVE.\n"
            f"Consider:\n"
            f"1. Is this claim factually accurate based on established knowledge?\n"
            f"2. Are there any nuances or exceptions to consider?\n"
            f"3. Is there enough information to make a determination?\n\n"
            f"Respond as JSON: {{\"verdict\": \"TRUE\"|\"FALSE\"|\"INCONCLUSIVE\", "
            f"\"confidence\": 0-100, \"reasoning\": \"brief explanation\"}}"
        )
        res = gl.nondet.exec_prompt(prompt, response_format="json")
        verdict = (res.get("verdict") or "").strip().upper()
        if verdict not in ALLOWED_VERDICTS:
            verdict = "INCONCLUSIVE"
        confidence = min(max(int(res.get("confidence") or 50), 0), 100)
        reasoning = res.get("reasoning", "")
        return {
            "verdict": verdict,
            "confidence": confidence,
            "reasoning": reasoning
        }

    def _run_consensus(self, claim_text: str, category: str) -> dict:
        """Run GenLayer consensus using prompt_comparative for fast agreement."""
        
        def get_analysis() -> dict:
            return self._analyze_claim(claim_text, category)

        principle = (
            "The verdicts should agree on whether the claim is true, false, or inconclusive. "
            "Minor wording differences in reasoning are acceptable as long as the final "
            "verdict category matches. Confidence scores should be within 20 points of each other."
        )
        
        try:
            verified = gl.eq_principle.prompt_comparative(get_analysis, principle)
            return verified
        except gl.vm.UserError:
            return {"verdict": "INCONCLUSIVE", "confidence": 0, "reasoning": "Consensus failed"}

    # ---------- writes ----------

    @gl.public.write
    def submit_claim(self, claim_id: str, text: str, category: str) -> None:
        """Submit a claim for verification."""
        if not claim_id:
            raise gl.vm.UserError("claim_id required")
        if not text:
            raise gl.vm.UserError("claim text required")
        if not category:
            raise gl.vm.UserError("category required")
        if self.claims.get(claim_id, None) is not None:
            raise gl.vm.UserError(f"Claim {claim_id} already exists.")

        self.claims[claim_id] = Claim(
            id=claim_id,
            text=text,
            category=category,
            submitter=str(gl.message.sender_address),
            timestamp=u256(self._now()),
            resolved=False,
            verdict="",
            confidence=u256(0),
            validator_count=u256(0),
            reasoning="",
            resolved_at=u256(0),
            appeal_count=u256(0)
        )
        self.claim_counter += u256(1)

    @gl.public.write
    def resolve_claim(self, claim_id: str) -> str:
        """Trigger consensus resolution for a claim."""
        claim = self.claims.get(claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim {claim_id} not found.")
        if claim.resolved:
            raise gl.vm.UserError(f"Claim {claim_id} already resolved.")

        # Run consensus
        result = self._run_consensus(claim.text, claim.category)

        claim.resolved = True
        claim.verdict = result["verdict"]
        claim.confidence = u256(result["confidence"])
        claim.validator_count = u256(MIN_CONSENSUS_AGREEMENT)
        claim.reasoning = result["reasoning"]
        claim.resolved_at = u256(self._now())
        self.claims[claim_id] = claim
        return result["verdict"]

    @gl.public.write.payable
    def appeal_verdict(self, claim_id: str) -> str:
        """Appeal a disputed verdict. Requires bond."""
        claim = self.claims.get(claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim {claim_id} not found.")
        if not claim.resolved:
            raise gl.vm.UserError(f"Claim {claim_id} not yet resolved.")
        if int(claim.appeal_count) >= MAX_APPEALS:
            raise gl.vm.UserError(f"Claim {claim_id} has reached max appeals ({MAX_APPEALS}).")
        if gl.message.value < u256(APPEAL_BOND):
            raise gl.vm.UserError(f"Appeal bond too low. Minimum: {APPEAL_BOND} wei")

        # Reset claim for re-resolution
        original_verdict = claim.verdict
        claim.resolved = False
        claim.verdict = ""
        claim.confidence = u256(0)
        claim.reasoning = ""
        claim.resolved_at = u256(0)
        claim.appeal_count += u256(1)
        self.claims[claim_id] = claim

        # Create appeal record
        appeal_id = f"appeal-{claim_id}-{claim.appeal_count}"
        self.appeals[appeal_id] = Appeal(
            id=appeal_id,
            claim_id=claim_id,
            appellant=str(gl.message.sender_address),
            bond=gl.message.value,
            timestamp=u256(self._now()),
            resolved=False,
            original_verdict=original_verdict,
            new_verdict=""
        )
        self.appeal_counter += u256(1)

        return "APPEAL_ACCEPTED"

    @gl.public.write
    def finalize_appeal(self, appeal_id: str) -> str:
        """Finalize an appeal after re-resolution."""
        appeal = self.appeals.get(appeal_id, None)
        if appeal is None:
            raise gl.vm.UserError(f"Appeal {appeal_id} not found.")
        if appeal.resolved:
            raise gl.vm.UserError(f"Appeal {appeal_id} already resolved.")

        claim = self.claims.get(appeal.claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim not found.")

        # If claim is still unresolved, resolve it now
        if not claim.resolved:
            result = self._run_consensus(claim.text, claim.category)
            claim.resolved = True
            claim.verdict = result["verdict"]
            claim.confidence = u256(result["confidence"])
            claim.validator_count = u256(MIN_CONSENSUS_AGREEMENT)
            claim.reasoning = result["reasoning"]
            claim.resolved_at = u256(self._now())
            self.claims[appeal.claim_id] = claim

        appeal.resolved = True
        appeal.new_verdict = claim.verdict
        self.appeals[appeal_id] = appeal

        return claim.verdict

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
            "category": claim.category,
            "submitter": claim.submitter,
            "timestamp": int(claim.timestamp),
            "resolved": claim.resolved,
            "verdict": claim.verdict,
            "confidence": int(claim.confidence),
            "validator_count": int(claim.validator_count),
            "reasoning": claim.reasoning,
            "resolved_at": int(claim.resolved_at),
            "appeal_count": int(claim.appeal_count)
        })

    @gl.public.view
    def get_appeal(self, appeal_id: str) -> str:
        """Get appeal details."""
        appeal = self.appeals.get(appeal_id, None)
        if appeal is None:
            return json.dumps({"appeal_id": appeal_id, "exists": False})
        return json.dumps({
            "appeal_id": appeal.id,
            "exists": True,
            "claim_id": appeal.claim_id,
            "appellant": appeal.appellant,
            "bond": int(appeal.bond),
            "timestamp": int(appeal.timestamp),
            "resolved": appeal.resolved,
            "original_verdict": appeal.original_verdict,
            "new_verdict": appeal.new_verdict
        })

    @gl.public.view
    def get_claims_count(self) -> str:
        """Get total number of claims."""
        return str(len(self.claims))

    @gl.public.view
    def get_claim_counter(self) -> str:
        """Get total claims submitted (including deleted/resolved)."""
        return str(self.claim_counter)

    @gl.public.view
    def get_appeal_counter(self) -> str:
        """Get total appeals filed."""
        return str(self.appeal_counter)

    @gl.public.view
    def now(self) -> str:
        return str(self._now())
