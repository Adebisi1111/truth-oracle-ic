// Test script: interact with TruthOracle contract on GenLayer Bradbury
const { createClient, createAccount } = require('genlayer-js');
const { testnetBradbury } = require('genlayer-js/chains');

const CONTRACT_ADDRESS = '0xA8c8986bd62AD9dD7445232213Eb5C03adE31D7d';

async function testConnection() {
  console.log('=== TruthOracle Contract Test ===\n');
  console.log('Contract:', CONTRACT_ADDRESS);
  console.log('Network: GenLayer Bradbury Testnet\n');

  // Step 1: Create client
  console.log('Step 1: Creating client...');
  const client = createClient({
    chain: testnetBradbury,
  });
  console.log('  ✅ Client created');

  // Step 2: Connect wallet
  console.log('\nStep 2: Connecting wallet...');
  try {
    await client.connect();
    console.log('  ✅ Wallet connected');
  } catch (err) {
    console.log('  ❌ Connection failed:', err.message);
    return;
  }

  // Step 3: Get account
  console.log('\nStep 3: Getting account...');
  const accounts = await client.getAddresses();
  const account = accounts[0];
  console.log('  ✅ Account:', account);

  // Step 4: Check balance
  console.log('\nStep 4: Checking balance...');
  try {
    const balance = await client.getBalance({ address: account });
    console.log('  ✅ Balance:', balance, 'wei');
  } catch (err) {
    console.log('  ⚠️  Balance check failed:', err.message);
  }

  // Step 5: Read contract (get_claims_count)
  console.log('\nStep 5: Reading contract (get_claims_count)...');
  try {
    const result = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claims_count',
      args: [],
      stateStatus: 'accepted',
    });
    console.log('  ✅ Total claims:', result.data);
  } catch (err) {
    console.log('  ❌ Read failed:', err.message);
  }

  // Step 6: Submit a claim
  console.log('\nStep 6: Submitting a test claim...');
  const testClaimId = `test-${Date.now()}`;
  const testClaimText = 'The sky is blue';
  const testEvidenceUrl = 'https://en.wikipedia.org/wiki/Sky';
  
  try {
    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'submit_claim',
      args: [testClaimId, testClaimText, testEvidenceUrl],
      value: 0,
    });
    console.log('  ✅ Claim submitted! TX:', txHash);

    // Step 7: Wait for receipt
    console.log('\nStep 7: Waiting for transaction receipt...');
    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: 'ACCEPTED',
    });
    console.log('  ✅ Transaction accepted!');
    console.log('  Block:', receipt.blockNumber);
    console.log('  Gas used:', receipt.gasUsed);

    // Step 8: Verify claim exists
    console.log('\nStep 8: Verifying claim exists...');
    const claimResult = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claim',
      args: [testClaimId],
      stateStatus: 'accepted',
    });
    const claim = JSON.parse(claimResult.data);
    console.log('  ✅ Claim found:', JSON.stringify(claim, null, 2));

    // Step 9: Resolve the claim (trigger consensus)
    console.log('\nStep 9: Resolving claim (triggering AI consensus)...');
    const resolveTxHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'resolve_claim',
      args: [testClaimId],
      value: 0,
    });
    console.log('  ✅ Resolve triggered! TX:', resolveTxHash);

    // Step 10: Wait for resolution
    console.log('\nStep 10: Waiting for resolution receipt...');
    const resolveReceipt = await client.waitForTransactionReceipt({
      hash: resolveTxHash,
      status: 'ACCEPTED',
    });
    console.log('  ✅ Resolution accepted!');

    // Step 11: Get final claim state
    console.log('\nStep 11: Getting final claim state...');
    const finalResult = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_claim',
      args: [testClaimId],
      stateStatus: 'accepted',
    });
    const finalClaim = JSON.parse(finalResult.data);
    console.log('  ✅ Final state:', JSON.stringify(finalClaim, null, 2));

    if (finalClaim.resolved && finalClaim.verdict) {
      console.log('\n🎉 SUCCESS! Consensus reached:', finalClaim.verdict);
    } else {
      console.log('\n⚠️  Claim not yet resolved. Consensus may still be in progress.');
    }

  } catch (err) {
    console.log('  ❌ Transaction failed:', err.message);
    console.log('  Error details:', err);
  }

  console.log('\n=== Test Complete ===');
}

testConnection().catch(console.error);
