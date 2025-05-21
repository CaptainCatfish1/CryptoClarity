// Simple script to test the admin API endpoints
import fetch from 'node-fetch';

const adminEmail = 'brenthayward1@gmail.com';
const apiUrl = 'http://localhost:5000';

async function checkAdminEndpoints() {
  console.log('Testing admin API endpoints...');
  
  try {
    // Check admin status
    console.log('\n1. Testing /api/check-admin endpoint:');
    const checkResponse = await fetch(`${apiUrl}/api/check-admin?email=${adminEmail}`);
    const checkResult = await checkResponse.json();
    console.log('Admin status check result:', checkResult);
    
    // Get admin list
    console.log('\n2. Testing /api/admin-emails GET endpoint:');
    const getResponse = await fetch(`${apiUrl}/api/admin-emails?email=${adminEmail}`);
    const getResult = await getResponse.json();
    console.log('Current admin list:', getResult);
    
    // Try adding a test admin
    console.log('\n3. Testing /api/admin-emails POST endpoint:');
    const testEmail = `test-admin-${Date.now()}@example.com`;
    const addResponse = await fetch(`${apiUrl}/api/admin-emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterEmail: adminEmail,
        newAdminEmail: testEmail
      })
    });
    const addResult = await addResponse.json();
    console.log(`Added new admin (${testEmail}):`, addResult);
    
    // Get updated admin list
    console.log('\n4. Verifying updated admin list:');
    const verifyResponse = await fetch(`${apiUrl}/api/admin-emails?email=${adminEmail}`);
    const verifyResult = await verifyResponse.json();
    console.log('Updated admin list:', verifyResult);
    
    // Test non-admin access (should be denied)
    console.log('\n5. Testing security with non-admin access:');
    const nonAdminEmail = 'regular.user@example.com';
    const securityResponse = await fetch(`${apiUrl}/api/admin-emails?email=${nonAdminEmail}`);
    const securityResult = await securityResponse.json();
    console.log('Non-admin access result:', securityResult);
    
  } catch (error) {
    console.error('Error testing admin endpoints:', error);
  }
  
  console.log('\nAdmin API test complete!');
}

// Run the tests
checkAdminEndpoints();