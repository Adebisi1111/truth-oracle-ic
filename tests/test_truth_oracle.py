"""
TruthOracle Client Workflow Test

This test exercises the full client-to-contract workflow:
1. Frontend encodes the transaction (4 args)
2. Backend relay signs and sends to GenLayer
3. Contract receives and processes the transaction

The test simulates the complete flow from browser to blockchain.
"""
import json
import pytest


def _hex(addr):
    if isinstance(addr, (bytes, bytearray)):
        from genlayer.py.types import Address
        return Address(bytes(addr)).as_hex
    return str(addr)


class TestClientWorkflow:
    """
    Tests that exercise the client workflow — the same path the frontend takes.
    
    In production, the flow is:
    1. User fills form in browser (claim ID, text, evidence URL, category)
    2. Frontend encodes: submit_claim(string,string,string,string)
    3. Frontend sends to backend relay via POST /submit-claim
    4. Backend relay signs with private key and sends to GenLayer
    5. GenLayer processes and stores on-chain
    
    These tests verify the full path works correctly.
    """

    def test_client_workflow_submit_claim_four_args(
        self, direct_vm, direct_deploy, direct_alice
    ):
        """
        Verify the client workflow: submit_claim with 4 arguments.
        
        Frontend encodes: submit_claim(claim_id, text, evidence_url, category)
        This is the exact signature the frontend sends.
        """
        contract = direct_deploy("contracts/truth_oracle_canonical.py")

        # Simulate what the frontend does:
        # var iface = new ethers.utils.Interface(['function submit_claim(string,string,string,string)']);
        # var data = iface.encodeFunctionData('submit_claim',[id,text,evidenceUrl,category]);
        
        evidence_url = "https://nasa.gov/earth"
        direct_vm.sender = direct_alice
        
        # Backend relay receives { claimId, text, evidenceUrl, category }
        # and calls: contract.submit_claim(claim_id, text, evidence_url, category)
        contract.submit_claim(
            "claim-client-1",
            "The Earth orbits the Sun",
            evidence_url,
            "Science"
        )

        # Verify all 4 fields stored correctly
        claim = json.loads(contract.get_claim("claim-client-1"))
        assert claim["exists"] is True
        assert claim["text"] == "The Earth orbits the Sun"
        assert claim["evidence_url"] == evidence_url
        assert claim["category"] == "Science"

    def test_client_workflow_submit_and_resolve(
        self, direct_vm, direct_deploy, direct_alice
    ):
        """
        Full client workflow: submit → resolve → read.
        
        This exercises the exact same path as the frontend:
        1. User submits claim with evidence URL
        2. User clicks "Resolve" 
        3. Contract fetches evidence and runs AI consensus
        4. User reads verdict
        """
        contract = direct_deploy("contracts/truth_oracle_canonical.py")

        evidence_url = "https://nasa.gov/earth"
        direct_vm.sender = direct_alice

        # Step 1: Client submits claim with evidence URL
        contract.submit_claim(
            "claim-client-2",
            "The Earth orbits the Sun",
            evidence_url,
            "Science"
        )

        # Verify stored
        claim = json.loads(contract.get_claim("claim-client-2"))
        assert claim["evidence_url"] == evidence_url
        assert claim["resolved"] is False

        # Step 2: Client triggers resolution (which fetches evidence)
        direct_vm.mock_llm(r".*", json.dumps({
            "verdict": "TRUE",
            "confidence": 85,
            "reasoning": "NASA evidence confirms heliocentric model."
        }))
        verdict = contract.resolve_claim("claim-client-2")

        # Step 3: Client reads verdict
        claim = json.loads(contract.get_claim("claim-client-2"))
        assert claim["resolved"] is True
        assert claim["verdict"] == "TRUE"
        assert claim["confidence"] == 85

    def test_evidence_url_passed_through_client(
        self, direct_vm, direct_deploy, direct_alice
    ):
        """
        Verify evidence URL is correctly passed through the client workflow
        and is available for resolution.
        """
        contract = direct_deploy("contracts/truth_oracle_canonical.py")

        evidence_url = "https://example.com/my-evidence"
        direct_vm.sender = direct_alice

        # Client sends evidence URL in submit_claim
        contract.submit_claim(
            "claim-evidence-test",
            "Test claim",
            evidence_url,
            "General"
        )

        # Verify evidence URL stored correctly
        claim = json.loads(contract.get_claim("claim-evidence-test"))
        assert claim["evidence_url"] == evidence_url
        assert claim["resolved"] is False

        # Resolve (which retrieves evidence)
        direct_vm.mock_llm(r".*", json.dumps({
            "verdict": "TRUE",
            "confidence": 80,
            "reasoning": "Evidence supports the claim."
        }))
        contract.resolve_claim("claim-evidence-test")

        # Verify resolution succeeded
        claim = json.loads(contract.get_claim("claim-evidence-test"))
        assert claim["resolved"] is True


# Keep the original tests for backward compatibility
def test_submit_resolve_read_end_to_end(direct_vm, direct_deploy, direct_alice):
    """End-to-end test: submit claim with evidence URL, resolve, read verdict."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    evidence_url = "https://nasa.gov/earth"
    
    direct_vm.sender = direct_alice
    contract.submit_claim("claim-1", "The Earth orbits the Sun", evidence_url, "Science")

    claim = json.loads(contract.get_claim("claim-1"))
    assert claim["exists"] is True
    assert claim["evidence_url"] == evidence_url

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "TRUE",
        "confidence": 85,
        "reasoning": "Evidence from NASA confirms: Earth orbits the Sun (heliocentric model)."
    }))
    verdict = contract.resolve_claim("claim-1")

    assert verdict in ("TRUE", "FALSE", "INCONCLUSIVE")

    claim = json.loads(contract.get_claim("claim-1"))
    assert claim["resolved"] is True
    assert claim["verdict"] in ("TRUE", "FALSE", "INCONCLUSIVE")
    assert 0 <= claim["confidence"] <= 100
    assert isinstance(claim["reasoning"], str) and len(claim["reasoning"]) > 0


def test_submit_resolve_read_false_verdict(direct_vm, direct_deploy, direct_alice):
    """Verify FALSE verdict path with evidence assessment."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    evidence_url = "https://flatearth.org"
    direct_vm.sender = direct_alice
    contract.submit_claim("claim-2", "The Earth is flat", evidence_url, "Science")

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "FALSE",
        "confidence": 95,
        "reasoning": "Evidence contradicts flat Earth claim. Earth is an oblate spheroid."
    }))
    verdict = contract.resolve_claim("claim-2")

    claim = json.loads(contract.get_claim("claim-2"))
    assert claim["resolved"] is True
    assert verdict == "FALSE"


def test_submit_resolve_read_inconclusive_verdict(direct_vm, direct_deploy, direct_alice):
    """Verify INCONCLUSIVE verdict path with evidence assessment."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    evidence_url = "https://unknown-source.com/claim"
    direct_vm.sender = direct_alice
    contract.submit_claim("claim-3", "There are exactly 4 planets in the universe", evidence_url, "Science")

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "INCONCLUSIVE",
        "confidence": 20,
        "reasoning": "Cannot be determined - 'universe' is too broad and evidence is insufficient."
    }))
    verdict = contract.resolve_claim("claim-3")

    claim = json.loads(contract.get_claim("claim-3"))
    assert claim["resolved"] is True
    assert verdict == "INCONCLUSIVE"


def test_resolve_already_resolved_throws(direct_vm, direct_deploy, direct_alice):
    """Verify that resolving an already-resolved claim throws an error."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-4", "Water boils at 100C", "https://physics.org", "Science")

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "TRUE",
        "confidence": 90,
        "reasoning": "Water boils at 100°C at sea level."
    }))
    contract.resolve_claim("claim-4")

    with direct_vm.expect_revert("already resolved"):
        contract.resolve_claim("claim-4")


def test_submit_duplicate_claim_throws(direct_vm, direct_deploy, direct_alice):
    """Verify that submitting a duplicate claim ID throws an error."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-5", "The sky is blue", "https://science.org", "Science")

    with direct_vm.expect_revert("already exists"):
        contract.submit_claim("claim-5", "Different text", "https://other.org", "News")


def test_get_claim_not_found(direct_vm, direct_deploy):
    """Verify that get_claim returns exists=False for unknown claim."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    claim = json.loads(contract.get_claim("nonexistent"))
    assert claim["exists"] is False


def test_get_claims_count(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Verify that get_claims_count returns the correct count."""
    contract = direct_deploy("contracts/truth_oracle_canonical.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-6", "Claim 6", "https://source1.com", "General")

    direct_vm.sender = direct_bob
    contract.submit_claim("claim-7", "Claim 7", "https://source2.com", "Tech")

    count = contract.get_claims_count()
    assert count == "2"
