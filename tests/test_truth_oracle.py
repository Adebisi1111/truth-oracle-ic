import json


def _hex(addr):
    if isinstance(addr, (bytes, bytearray)):
        from genlayer.py.types import Address
        return Address(bytes(addr)).as_hex
    return str(addr)


# ---------------------------------------------------------------------------
# STEWARD REQUEST: Reproducible submit, resolve, and read test against one
# canonical interface. Aligns submit_claim and get_claim end to end and has
# the contract retrieve and assess the evidence used for each verdict.
# --------------------------------------------------------------------------


def test_submit_resolve_read_end_to_end(direct_vm, direct_deploy,
                                        direct_alice):
    """Reproducible test: submit a claim, resolve it with AI consensus, and read back the verdict + reasoning."""
    contract = direct_deploy("contracts/truth_oracle.py")

    # 1. SUBMIT — Alice submits a claim for verification
    direct_vm.sender = direct_alice
    contract.submit_claim("claim-1", "The Earth orbits the Sun", "Science")

    # Verify claim was stored
    claim = json.loads(contract.get_claim("claim-1"))
    assert claim["exists"] is True
    assert claim["text"] == "The Earth orbits the Sun"
    assert claim["category"] == "Science"
    assert claim["resolved"] is False
    assert claim["verdict"] == ""

    # 2. RESOLVE — AI consensus analyzes the claim and stores verdict + reasoning
    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "TRUE",
        "confidence": 85,
        "reasoning": "Astronomically established: Earth orbits the Sun (heliocentric model)."
    }))
    verdict = contract.resolve_claim("claim-1")

    # Verify verdict is one of the allowed values
    assert verdict in ("TRUE", "FALSE", "INCONCLUSIVE")

    # 3. READ — Retrieve the full claim including verdict and reasoning
    claim = json.loads(contract.get_claim("claim-1"))
    assert claim["exists"] is True
    assert claim["resolved"] is True
    assert claim["verdict"] in ("TRUE", "FALSE", "INCONCLUSIVE")
    assert 0 <= claim["confidence"] <= 100
    assert isinstance(claim["reasoning"], str) and len(claim["reasoning"]) > 0
    assert claim["resolved_at"] > 0

    # Verify submit_claim and get_claim are aligned (same fields)
    assert claim["text"] == "The Earth orbits the Sun"
    assert claim["category"] == "Science"
    assert claim["submitter"] == _hex(direct_alice)


def test_submit_resolve_read_false_verdict(direct_vm, direct_deploy,
                                           direct_alice):
    """Verify FALSE verdict path with evidence assessment."""
    contract = direct_deploy("contracts/truth_oracle.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-2", "The Moon is made of cheese", "Science")

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "FALSE",
        "confidence": 95,
        "reasoning": "Moon is made of rock and metal, not cheese. Confirmed by Apollo missions."
    }))
    verdict = contract.resolve_claim("claim-2")

    claim = json.loads(contract.get_claim("claim-2"))
    assert claim["resolved"] is True
    assert verdict == "FALSE"
    assert claim["verdict"] == "FALSE"
    assert "cheese" in claim["reasoning"].lower() or "moon" in claim["reasoning"].lower()


def test_submit_resolve_read_inconclusive_verdict(direct_vm, direct_deploy,
                                                  direct_alice):
    """Verify INCONCLUSIVE verdict path with evidence assessment."""
    contract = direct_deploy("contracts/truth_oracle.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-3", "There are exactly 4 planets in the universe", "Science")

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "INCONCLUSIVE",
        "confidence": 20,
        "reasoning": "Cannot be determined - 'universe' is too broad and planet count varies by definition."
    }))
    verdict = contract.resolve_claim("claim-3")

    claim = json.loads(contract.get_claim("claim-3"))
    assert claim["resolved"] is True
    assert verdict == "INCONCLUSIVE"
    assert claim["verdict"] == "INCONCLUSIVE"
    assert isinstance(claim["reasoning"], str) and len(claim["reasoning"]) > 0


def test_resolve_already_resolved_throws(direct_vm, direct_deploy,
                                        direct_alice):
    """Verify that resolving an already-resolved claim throws an error."""
    contract = direct_deploy("contracts/truth_oracle.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-4", "Water boils at 100C", "Science")

    direct_vm.mock_llm(r".*", json.dumps({
        "verdict": "TRUE",
        "confidence": 90,
        "reasoning": "Water boils at 100°C at sea level."
    }))
    contract.resolve_claim("claim-4")

    # Second resolve should fail
    with direct_vm.expect_revert("already resolved"):
        contract.resolve_claim("claim-4")


def test_submit_duplicate_claim_throws(direct_vm, direct_deploy,
                                       direct_alice):
    """Verify that submitting a duplicate claim ID throws an error."""
    contract = direct_deploy("contracts/truth_oracle.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-5", "The sky is blue", "Science")

    with direct_vm.expect_revert("already exists"):
        contract.submit_claim("claim-5", "Different text", "News")


def test_get_claim_not_found(direct_vm, direct_deploy):
    """Verify that get_claim returns exists=False for unknown claim."""
    contract = direct_deploy("contracts/truth_oracle.py")

    claim = json.loads(contract.get_claim("nonexistent"))
    assert claim["exists"] is False


def test_get_claims_count(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Verify that get_claims_count returns the correct count."""
    contract = direct_deploy("contracts/truth_oracle.py")

    direct_vm.sender = direct_alice
    contract.submit_claim("claim-6", "Claim 6", "General")

    direct_vm.sender = direct_bob
    contract.submit_claim("claim-7", "Claim 7", "Tech")

    count = contract.get_claims_count()
    assert count == "2"
