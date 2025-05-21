import { storage } from "../server/storage";

async function runTests() {
  console.log("Running database test script...");
  
  // Test user creation and admin detection
  try {
    console.log("Testing user creation and admin detection...");
    
    // Create admin user (using the email whitelist)
    const adminUser = await storage.createOrUpdateUserByEmail("brenthayward1@gmail.com", {
      requested_premium: true,
      subscribed_to_blog: true
    });
    
    console.log("Admin user created:", {
      id: adminUser.id,
      email: adminUser.email,
      is_admin: adminUser.is_admin,
      subscribed_to_blog: adminUser.subscribed_to_blog
    });
    
    // Create regular user
    const regularUser = await storage.createOrUpdateUserByEmail("regular.user@example.com", {
      requested_premium: true
    });
    
    console.log("Regular user created:", {
      id: regularUser.id,
      email: regularUser.email,
      is_admin: regularUser.is_admin,
      requested_premium: regularUser.requested_premium
    });
  } catch (error) {
    console.error("Error testing user creation:", error);
  }
  
  // Test scan log creation
  try {
    console.log("\nTesting scan log creation...");
    
    // Create a basic scan log
    const basicScanLog = await storage.createScanLog({
      scan_type: "free",
      input_type: "scenario_only",
      scenario: "Someone asked me to send them 0.1 ETH to verify my wallet",
      risk_level: "High Risk",
      ai_summary: "This is a classic scam approach. Never send cryptocurrency to verify a wallet.",
      user_email: "regular.user@example.com",
      admin_override_used: false,
      etherscan_data: { addresses: [] },
      scan_result: {
        riskLevel: "High Risk",
        summary: "This is a classic scam approach.",
        redFlags: ["Requesting funds", "Verification excuse"],
        safetyTips: ["Never send funds to verify a wallet"]
      }
    });
    
    console.log("Basic scan log created with ID:", basicScanLog.id);
    
    // Create a premium scan log with admin override
    const premiumScanLog = await storage.createScanLog({
      scan_type: "premium",
      input_type: "both",
      scenario: "This wallet sent me an NFT and now asked me to approve a contract",
      submitted_address_1: "0x1234567890123456789012345678901234567890",
      user_email: "brenthayward1@gmail.com",
      admin_override_used: true,
      risk_level: "Critical Risk",
      ai_summary: "This is a dangerous approval scam that could drain your wallet.",
      etherscan_data: { 
        addresses: ["0x1234567890123456789012345678901234567890"],
        rawData: "Contract analysis shows suspicious patterns"
      },
      scan_result: {
        riskLevel: "Critical Risk",
        summary: "This is a dangerous approval scam that could drain your wallet.",
        redFlags: ["Contract approval", "Unknown sender"],
        safetyTips: ["Never approve unknown contracts"]
      }
    });
    
    console.log("Premium scan log created with ID:", premiumScanLog.id);
  } catch (error) {
    console.error("Error testing scan log creation:", error);
  }
  
  // Test premium feature request logging
  try {
    console.log("\nTesting premium feature request logging...");
    
    // Log a premium subscription request
    const subscriptionRequest = await storage.logPremiumFeatureRequest({
      email: "regular.user@example.com",
      feature_requested: "premium_subscription",
      was_admin: false,
      request_details: {
        source: "limit-reached",
        subscribe_to_newsletter: true
      }
    });
    
    console.log("Premium subscription request logged with ID:", subscriptionRequest.id);
    
    // Log an expert investigation request by admin
    const expertRequest = await storage.logPremiumFeatureRequest({
      email: "brenthayward1@gmail.com",
      feature_requested: "expert_investigation",
      was_admin: true,
      request_details: {
        scenario_length: 120,
        has_addresses: true
      }
    });
    
    console.log("Expert investigation request logged with ID:", expertRequest.id);
  } catch (error) {
    console.error("Error testing premium feature request logging:", error);
  }
  
  // Test retrieving analytics data
  try {
    console.log("\nTesting analytics data retrieval...");
    
    // Get admin user's scan logs
    const adminScans = await storage.getScanLogsByEmail("brenthayward1@gmail.com");
    console.log(`Retrieved ${adminScans.length} scan logs for admin user`);
    
    // Get premium scan logs
    const premiumScans = await storage.getScanLogsByType("premium");
    console.log(`Retrieved ${premiumScans.length} premium scan logs`);
    
    // Get scans with admin override
    const adminOverrideScans = await storage.getScanLogsWithAdminOverride();
    console.log(`Retrieved ${adminOverrideScans.length} scans with admin override`);
    
    // Get premium subscription requests
    const subscriptionRequests = await storage.getPremiumRequestsByFeature("premium_subscription");
    console.log(`Retrieved ${subscriptionRequests.length} premium subscription requests`);
  } catch (error) {
    console.error("Error testing analytics data retrieval:", error);
  }
  
  console.log("\nDatabase test script completed.");
}

// Run the tests
runTests().catch(console.error);