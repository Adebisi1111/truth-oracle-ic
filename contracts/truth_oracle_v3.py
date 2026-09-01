# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# TruthOracle v3 - Simplified for GenLayer TreeMap limits

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

        # Simple LLM analysis
        prompt = f"Fact-check: '{claim.text}'. Reply JSON: {{'verdict':'TRUE'|'FALSE'|'INCONCLUSIVE','reasoning':'explanation'}}"
        res = gl.nondet.exec_prompt(prompt, response_format="json")
        
        verdict = (res.get("verdict") or "INCONCLUSIVE").strip().upper()
        if verdict not in ALLOWED_VERDICTS:
            verdict = "INCONCLUSIVE"
        reasoning = res.get("reasoning", "")

        claim.resolved = True
        claim.verdict = verdict
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
            "reasoning": claim.reasoning,
            "resolved_at": int(claim.resolved_at)
        })

    @gl.public.view
    def get_claims_count(self) -> str:
        return str(len(self.claims))

    @gl.public.view
    def now(self) -> str:
        return str(self._now())
