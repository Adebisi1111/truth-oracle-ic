import pytest
from genlayer import *
from contracts.truth_oracle_v2 import TruthOracle

# Test configuration
@pytest.fixture
def contract():
    """Deploy a fresh TruthOracle contract for each test."""
    c = TruthOracle()
    return c


class TestSubmitClaim:
    """Test claim submission."""
    
    def test_submit_basic_claim(self, contract):
        """Test submitting a basic claim."""
        contract.submit_claim("test-1", "The Earth is round", "Science")
        result = contract.get_claim("test-1")
        assert result["exists"] is True
        assert result["text"] == "The Earth is round"
        assert result["category"] == "Science"
        assert result["resolved"] is False
    
    def test_submit_duplicate_claim_fails(self, contract):
        """Test that submitting a duplicate claim ID fails."""
        contract.submit_claim("test-1", "Claim text", "Science")
        with pytest.raises(Exception):
            contract.submit_claim("test-1", "Different text", "News")
    
    def test_submit_empty_id_fails(self, contract):
        """Test that submitting with empty ID fails."""
        with pytest.raises(Exception):
            contract.submit_claim("", "Claim text", "Science")
    
    def test_submit_empty_text_fails(self, contract):
        """Test that submitting with empty text fails."""
        with pytest.raises(Exception):
            contract.submit_claim("test-1", "", "Science")
    
    def test_submit_empty_category_fails(self, contract):
        """Test that submitting with empty category fails."""
        with pytest.raises(Exception):
            contract.submit_claim("test-1", "Claim text", "")
    
    def test_claims_count_increments(self, contract):
        """Test that claim counter increments."""
        contract.submit_claim("test-1", "Claim 1", "Science")
        contract.submit_claim("test-2", "Claim 2", "News")
        count = int(contract.get_claims_count())
        assert count == 2


class TestResolveClaim:
    """Test claim resolution."""
    
    def test_resolve_claim(self, contract):
        """Test resolving a claim."""
        contract.submit_claim("test-1", "The Earth orbits the Sun", "Science")
        verdict = contract.resolve_claim("test-1")
        assert verdict in ("TRUE", "FALSE", "INCONCLUSIVE")
        
        result = contract.get_claim("test-1")
        assert result["resolved"] is True
        assert result["verdict"] == verdict
        assert result["confidence"] >= 0
    
    def test_resolve_nonexistent_claim_fails(self, contract):
        """Test that resolving a nonexistent claim fails."""
        with pytest.raises(Exception):
            contract.resolve_claim("nonexistent")
    
    def test_resolve_already_resolved_fails(self, contract):
        """Test that resolving an already resolved claim fails."""
        contract.submit_claim("test-1", "Claim text", "Science")
        contract.resolve_claim("test-1")
        with pytest.raises(Exception):
            contract.resolve_claim("test-1")


class TestAppeal:
    """Test appeal mechanism."""
    
    def test_file_appeal(self, contract):
        """Test filing an appeal."""
        contract.submit_claim("test-1", "Claim text", "Science")
        contract.resolve_claim("test-1")
        
        # File appeal with bond
        result = contract.appeal_verdict("test-1")
        assert result == "APPEAL_ACCEPTED"
        
        claim = contract.get_claim("test-1")
        assert claim["appeal_count"] == 1
    
    def test_appeal_nonresolved_fails(self, contract):
        """Test that appealing a non-resolved claim fails."""
        contract.submit_claim("test-1", "Claim text", "Science")
        with pytest.raises(Exception):
            contract.appeal_verdict("test-1")
    
    def test_finalize_appeal(self, contract):
        """Test finalizing an appeal."""
        contract.submit_claim("test-1", "Claim text", "Science")
        contract.resolve_claim("test-1")
        contract.appeal_verdict("test-1")
        
        appeal_id = "appeal-test-1-1"
        verdict = contract.finalize_appeal(appeal_id)
        assert verdict in ("TRUE", "FALSE", "INCONCLUSIVE")


class TestGetters:
    """Test view functions."""
    
    def test_get_nonexistent_claim(self, contract):
        """Test getting a nonexistent claim."""
        result = contract.get_claim("nonexistent")
        assert result["exists"] is False
    
    def test_get_claim_counter(self, contract):
        """Test getting claim counter."""
        contract.submit_claim("test-1", "Claim 1", "Science")
        contract.submit_claim("test-2", "Claim 2", "News")
        counter = int(contract.get_claim_counter())
        assert counter == 2
    
    def test_get_appeal_counter(self, contract):
        """Test getting appeal counter."""
        contract.submit_claim("test-1", "Claim text", "Science")
        contract.resolve_claim("test-1")
        contract.appeal_verdict("test-1")
        counter = int(contract.get_appeal_counter())
        assert counter == 1
    
    def test_now(self, contract):
        """Test now() returns timestamp."""
        timestamp = int(contract.now())
        assert timestamp > 0
