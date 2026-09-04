# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# TruthOracle — Canonical Contract
# 
# Single canonical interface for decentralized fact verification.
# This is the OFFICIAL contract — all clients must match this exact signature.
#
# SUBMIT → RESOLVE → READ path:
#   submit_claim(claim_id, text, evidence_url, category) → stores claim + evidence URL
#   resolve_claim(id) → retrieves evidence, triggers AI consensus, stores verdict + reasoning
#   get_claim(id) → returns full claim with verdict, confidence, reasoning
#
# EVIDENCE RETRIEVAL & ASSESSMENT:
#   Each claim includes an evidence URL. During resolution, the contract retrieves
#   the evidence via gl.nondet.web.render and binds it to the claim before
#   validators assess. This ensures deterministic verification.

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
    evidence_url: str
    evidence_content: str
    category: str
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
    def submit_claim(self, claim_id: str, text: str, evidence_url: str,
                     category: str) -> None:
        """Submit a claim with evidence URL for verification.
        
        CANONICAL SIGNATURE — DO NOT CHANGE:
        submit_claim(claim_id: str, text: str, evidence_url: str, category: str)
        """
        if not claim_id or not text or not evidence_url or not category:
            raise gl.vm.UserError("claim_id, text, evidence_url, and category required")
        if self.claims.get(claim_id, None) is not None:
            raise gl.vm.UserError(f"Claim {claim_id} already exists.")

        self.claims[claim_id] = Claim(
            id=claim_id,
            text=text,
            evidence_url=evidence_url,
            evidence_content="",
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
        """Resolve a claim using AI consensus. Retrieves evidence and stores verdict + reasoning.
        
        Steps:
        1. Retrieve evidence content from URL via gl.nondet.web.render
        2. Bind evidence to claim on-chain
        3. Trigger AI consensus with evidence context
        4. Store verdict + reasoning
        """
        claim = self.claims.get(claim_id, None)
        if claim is None:
            raise gl.vm.UserError(f"Claim {claim_id} not found.")
        if claim.resolved:
            raise gl.vm.UserError(f"Claim {claim_id} already resolved.")

        # Step 1: Retrieve evidence content from URL
        evidence_content = self._retrieve_evidence(claim.evidence_url)
        
        # Step 2: Bind evidence to claim BEFORE validator assessment
        claim.evidence_content = evidence_content
        self.claims[claim_id] = claim

        # Step 3: AI consensus with evidence context
        def get_analysis() -> dict:
            prompt = (
                f"Claim: '{claim.text}'\n"
                f"Category: {claim.category}\n"
                f"Evidence URL: {claim.evidence_url}\n"
                f"Evidence Content: {evidence_content[:2000] if evidence_content else 'No content retrieved'}\n\n"
                f"Task: Assess whether the evidence supports this claim.\n"
                f"Consider:\n"
                f"1. Does the evidence directly support or contradict the claim?\n"
                f"2. Is the evidence credible and relevant?\n"
                f"3. Is there sufficient evidence to make a determination?\n\n"
                f"Respond as JSON: {{\"verdict\": \"TRUE\"|\"FALSE\"|\"INCONCLUSIVE\", "
                f"\"confidence\": 0-100, \"reasoning\": \"detailed evidence assessment\"}}"
            )
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            verdict = (res.get("verdict") or "").strip().upper()
            if verdict not in ALLOWED_VERDICTS:
                verdict = "INCONCLUSIVE"
            confidence = min(max(int(res.get("confidence") or 50), 0), 100)
            reasoning = res.get("reasoning", "")
            return {"verdict": verdict, "confidence": confidence, "reasoning": reasoning}

        principle = (
            "The verdicts must agree on whether the evidence supports the claim. "
            "Validators must independently assess the evidence and reach the same conclusion. "
            "Confidence scores should be within 20 points."
        )

        try:
            result = gl.eq_principle.prompt_comparative(get_analysis, principle)
        except gl.vm.UserError:
            result = {"verdict": "INCONCLUSIVE", "confidence": 0, "reasoning": "Consensus failed"}

        # Step 4: Store verdict + reasoning
        claim.resolved = True
        claim.verdict = result["verdict"]
        claim.confidence = u256(result["confidence"])
        claim.reasoning = result["reasoning"]
        claim.resolved_at = u256(self._now())
        self.claims[claim_id] = claim
        return result["verdict"]

    def _retrieve_evidence(self, evidence_url: str) -> str:
        """Retrieve evidence content from URL using equivalence principle.
        
        Uses gl.nondet.web.render for deterministic fetch — all validators
        see the same content without needing direct internet access.
        """
        def leader() -> dict:
            result = gl.nondet.web.render(evidence_url, mode="text")
            return {"content": result}

        def validator(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            return leader()["content"] == leader_result.calldata["content"]

        try:
            result = gl.vm.run_nondet_unsafe(leader, validator)
            return result["content"]
        except:
            return ""

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        """Get full claim including verdict, reasoning, and evidence."""
        claim = self.claims.get(claim_id, None)
        if claim is None:
            return json.dumps({"claim_id": claim_id, "exists": False})
        return json.dumps({
            "claim_id": claim.id,
            "exists": True,
            "text": claim.text,
            "evidence_url": claim.evidence_url,
            "evidence_content": claim.evidence_content[:500] if claim.evidence_content else "",
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
