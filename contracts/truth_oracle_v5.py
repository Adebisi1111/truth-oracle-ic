# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# TruthOracle v5 - Based on working v2 with consensus

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
    submitter: str
    timestamp: u256
    resolved: bool
    verdict: str
    confidence: u256
    reasoning: str
    resolved_at: u256

class TruthOracle(gl.Contract):
    claims: TreeMap[str, Claim]
    claim_counter: u256

    def __init__(self):
        pass

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    @gl.public.write
    def submit_claim(self, claim_id: str, text: str) -> None:
        if not claim_id:
            raise gl.vm.UserError("claim_id required")
        if not text:
            raise gl.vm.UserError("claim text required")
        if self.claims.get(claim_id, None) is not None:
            raise gl.vm.UserError(f"Claim {claim_id} already exists.")

        self.claims[claim_id] = Claim(
            id=claim_id,
            text=text,
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
        claim = self.claims.get(claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim {claim_id} not found.")
        if claim.resolved:
            raise gl.vm.UserError(f"Claim {claim_id} already resolved.")

        def get_analysis() -> dict:
            prompt = (
                f"Fact-check this claim: '{claim.text}'\n\n"
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
            return {"verdict": verdict, "confidence": confidence, "reasoning": reasoning}

        principle = (
            "The verdicts should agree on whether the claim is true, false, or inconclusive. "
            "Minor wording differences in reasoning are acceptable as long as the final "
            "verdict category matches. Confidence scores should be within 20 points of each other."
        )
        
        try:
            verified = gl.eq_principle.prompt_comparative(get_analysis, principle)
            verdict = verified.get("verdict", "INCONCLUSIVE")
            confidence = int(verified.get("confidence", 50))
            reasoning = verified.get("reasoning", "")
        except gl.vm.UserError:
            verdict = "INCONCLUSIVE"
            confidence = 0
            reasoning = "Consensus failed"

        claim.resolved = True
        claim.verdict = verdict
        claim.confidence = u256(confidence)
        claim.reasoning = reasoning
        claim.resolved_at = u256(self._now())
        self.claims[claim_id] = claim
        return verdict

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        claim = self.claims.get(claim_id, None)
        if claim is None:
            return json.dumps({"claim_id": claim_id, "exists": False})
        return json.dumps({
            "claim_id": claim.id,
            "exists": True,
            "text": claim.text,
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
