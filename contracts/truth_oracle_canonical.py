# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# TruthOracle — Canonical Contract
# 
# Single canonical interface for decentralized fact verification.
# 
# SUBMIT → RESOLVE → READ path:
#   submit_claim(id, text, category) → stores claim on-chain
#   resolve_claim(id) → triggers AI consensus, stores verdict + reasoning
#   get_claim(id) → returns full claim with verdict, confidence, reasoning
#
# EVIDENCE ASSESSMENT:
#   Each verdict includes the AI reasoning (evidence assessment) that led to the verdict.
#   The reasoning field stores the LLM's explanation.

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *


ALLOWED_VERDICTS = ("TRUE", "FALSE", "INCONCLUSIVE")


@allow_storage
@dataclass
class Claim:
    id: str
    text: str
    category: str
    submitter: str
    timestamp: u256
    resolved: bool
    verdict: str           # TRUE / FALSE / INCONCLUSIVE
    confidence: u256       # 0-100
    reasoning: str         # AI evidence assessment
    resolved_at: u256


class TruthOracle(gl.Contract):
    claims: TreeMap[str, Claim]
    claim_counter: u256

    def __init__(self):
        pass

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    @gl.public.write
    def submit_claim(self, claim_id: str, text: str, category: str) -> None:
        """Submit a claim for verification."""
        if not claim_id or not text or not category:
            raise gl.vm.UserError("claim_id, text, and category required")
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
            reasoning="",
            resolved_at=u256(0)
        )
        self.claim_counter += u256(1)

    @gl.public.write
    def resolve_claim(self, claim_id: str) -> str:
        """Resolve a claim using AI consensus. Stores verdict + reasoning on-chain."""
        claim = self.claims.get(claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim {claim_id} not found.")
        if claim.resolved:
            raise gl.vm.UserError(f"Claim {claim_id} already resolved.")

        # AI consensus: analyze claim and produce verdict + reasoning
        def get_analysis() -> dict:
            prompt = (
                f"Fact-check this claim: '{claim.text}'\n"
                f"Category: {claim.category}\n\n"
                f"Use your knowledge to determine if this claim is TRUE, FALSE, or INCONCLUSIVE.\n"
                f"Consider:\n"
                f"1. Is this claim factually accurate?\n"
                f"2. Are there nuances or exceptions?\n"
                f"3. Is there enough information to decide?\n\n"
                f"Respond as JSON: {{\"verdict\": \"TRUE\"|\"FALSE\"|\"INCONCLUSIVE\", "
                f"\"confidence\": 0-100, \"reasoning\": \"brief explanation\"}}"
            )
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            verdict = (res.get("verdict") or "").strip().upper()
            if verdict not in ALLOWED_VERDICTS:
                verdict = "INCONCLUSIVE"
            confidence = min(max(int(res.get("confidence") or 50), 0), 100)
            reasoning = res.get("reasoning", "")
            return {"verdict": verdict, "confidence": confidence, "reasoning": reasoning}

        principle = (
            "The verdicts should agree on whether the claim is true, false, or inconclusive. "
            "Minor wording differences in reasoning are acceptable as long as the final "
            "verdict category matches. Confidence scores should be within 20 points."
        )

        try:
            result = gl.eq_principle.prompt_comparative(get_analysis, principle)
        except gl.vm.UserError:
            result = {"verdict": "INCONCLUSIVE", "confidence": 0, "reasoning": "Consensus failed"}

        # Store verdict, confidence, AND reasoning on-chain
        claim.resolved = True
        claim.verdict = result["verdict"]
        claim.confidence = u256(result["confidence"])
        claim.reasoning = result["reasoning"]
        claim.resolved_at = u256(self._now())
        self.claims[claim_id] = claim
        return result["verdict"]

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        """Get full claim including verdict and reasoning."""
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
            "reasoning": claim.reasoning,
            "resolved_at": int(claim.resolved_at)
        })

    @gl.public.view
    def get_claims_count(self) -> str:
        return str(len(self.claims))

    @gl.public.view
    def now(self) -> str:
        return str(self._now())
