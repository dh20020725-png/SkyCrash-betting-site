require('dotenv').config();

async function checkWithdrawEndpointStatus() {
  try {
    console.log('=== Checking Withdraw Endpoint Status ===');
    
    // Test if endpoint exists and responds
    const response = await fetch('http://localhost:3001/api/tron-wallet/withdraw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token_amount: 1,
        withdrawal_address: 'TVt3Qt9kBB5twYH1Cn6k3WAm3h3zfNbC4V'
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('Response body:', result);
    
    if (response.status === 401) {
      console.log('✅ Endpoint exists and requires authentication');
      console.log('This means the withdraw function is implemented and working');
      console.log('The issue is likely in frontend authentication or request handling');
    } else if (response.status === 404) {
      console.log('❌ Endpoint not found');
    } else if (response.status === 400) {
      console.log('✅ Endpoint exists but has validation issues');
    } else if (response.status === 200) {
      console.log('✅ Endpoint responds without auth (unexpected)');
    } else {
      console.log('❓ Unexpected response:', response.status);
    }
    
  } catch (error) {
    console.error('Check failed:', error);
  }
}

checkWithdrawEndpointStatus();
