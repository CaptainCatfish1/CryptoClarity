import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { translateTerm, checkScam } from "./openai";
import { translateResponse, scamCheckResponse } from "@shared/schema";
import { getFormattedOnChainAnalysis, getAddressAnalysisSummary } from "./etherscan";
import { ZodError } from "zod";
import { 
  translateRequestSchema, 
  scamCheckRequestSchema, 
  expertRequestSchema, 
  contactRequestSchema,
  sanitizeAddressArray,
  sanitizeUserText,
  isValidEmail,
  isValidEthereumAddress
} from "./utils/validation";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoint to verify rate limiting
  app.get("/api/test-rate-limit", async (req: Request, res: Response) => {
    // This will be protected by the global rate limiter
    return res.json({ 
      status: "ok",
      message: "This endpoint is rate limited",
      timestamp: new Date().toISOString()
    });
  });
  // Error handling middleware
  const handleError = (err: any, res: Response) => {
    console.error(err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: "Invalid request data", errors: err.errors });
    }
    return res.status(500).json({ message: err.message || "Internal server error" });
  };

  // API endpoint to translate crypto term
  app.post("/api/translate", async (req: Request, res: Response) => {
    try {
      // Validate request using Zod schema
      const validatedData = translateRequestSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validatedData.error.format() 
        });
      }
      
      const { term, audienceType = 'beginner', email } = validatedData.data;
      
      // Check if this is an admin user
      let isAdmin = false;
      if (email && typeof email === 'string') {
        // Check if user exists or create a new user
        const user = await storage.createOrUpdateUserByEmail(email);
        isAdmin = user.is_admin || false;
      }
      
      // Note: We're deliberately NOT caching based on audienceType to keep the storage simpler
      // Look for existing term, but we'll regenerate if audienceType is specified
      const existingTerm = await storage.getCryptoTermByName(term);
      
      // Use existing term only if it exists AND no specific audienceType was requested
      if (existingTerm && audienceType === 'beginner') {
        const response = {
          term: existingTerm.term,
          explanation: existingTerm.explanation,
          relatedTerms: existingTerm.relatedTerms || [],
        };
        return res.json(translateResponse.parse(response));
      }
      
      // Get from OpenAI with audienceType
      const translationResult = await translateTerm(term, audienceType);
      
      // Save to storage only if it's beginner-level (our default)
      // For intermediate explanations, we don't save them to avoid overwriting beginner-friendly ones
      if (audienceType === 'beginner' && !existingTerm) {
        await storage.createCryptoTerm({
          term,
          explanation: translationResult.explanation,
          relatedTerms: translationResult.relatedTerms,
        });
      }
      
      const response = {
        term,
        explanation: translationResult.explanation,
        relatedTerms: translationResult.relatedTerms,
        isAdmin: isAdmin
      };
      
      return res.json(translateResponse.parse(response));
    } catch (err) {
      return handleError(err, res);
    }
  });

  // API endpoint to get recent crypto terms
  app.get("/api/translate/recent", async (req: Request, res: Response) => {
    try {
      const recentTerms = await storage.getRecentCryptoTerms();
      return res.json(recentTerms);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // API endpoint to check for scams
  app.post("/api/check-scam", async (req: Request, res: Response) => {
    try {
      // Validate request using Zod schema
      const validatedData = scamCheckRequestSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Invalid request data",
          errors: validatedData.error.format()
        });
      }
      
      const { 
        scenario, 
        suspiciousAddress, 
        userAddress, 
        extractedAddresses = [],
        scanType,
        email 
      } = validatedData.data;
      
      // Check for presence flags
      const hasScenario = scenario && scenario.trim().length > 0;
      const hasSuspiciousAddress = suspiciousAddress && suspiciousAddress.trim().length > 0;
      const hasUserAddress = userAddress && userAddress.trim().length > 0;
      const hasExtractedAddresses = Array.isArray(extractedAddresses) && extractedAddresses.length > 0;
      
      // Check if this is an admin user and create/update user record
      let isAdmin = false;
      if (email && typeof email === 'string') {
        const user = await storage.createOrUpdateUserByEmail(email);
        isAdmin = user.is_admin || false;
      }
      
      // Determine if this is a premium scan
      const isPremiumScan = scanType === 'advanced';
      
      // Determine input type for logging
      let inputType = 'scenario_only';
      if (hasScenario && (hasSuspiciousAddress || hasUserAddress || hasExtractedAddresses)) {
        inputType = 'both';
      } else if (!hasScenario && (hasSuspiciousAddress || hasUserAddress || hasExtractedAddresses)) {
        inputType = 'address_only';
      }
      
      // New consolidated on-chain data structure
      let onChainData = '';
      let addressAnalysisForAI = ''; // Combined address analysis for the AI context
      let etherscanData = {}; // For structured storage in the database
      
      // Process all addresses - start with a new combined structure
      const addressesToAnalyze = [];
      
      // Add addresses with their source/type
      if (hasSuspiciousAddress) {
        addressesToAnalyze.push({ address: suspiciousAddress.trim(), type: 'suspicious' });
      }
      
      if (hasUserAddress) {
        addressesToAnalyze.push({ address: userAddress.trim(), type: 'user' });
      }
      
      // Add extracted addresses if any
      if (hasExtractedAddresses) {
        for (const addr of extractedAddresses) {
          if (typeof addr === 'string' && addr.trim()) {
            // Skip if this address is already in our list
            if (!addressesToAnalyze.some(item => item.address.toLowerCase() === addr.toLowerCase())) {
              addressesToAnalyze.push({ address: addr.trim(), type: 'extracted' });
            }
          }
        }
      }
      
      // Analyze all addresses - for both on-chain display and AI context
      if (addressesToAnalyze.length > 0) {
        // Start building the combined on-chain data output
        const onChainDataParts = [];
        
        // Process each address
        for (const { address, type } of addressesToAnalyze) {
          try {
            // Get formatted on-chain data for display with appropriate tier level
            const formattedAnalysis = await getFormattedOnChainAnalysis(address, isPremiumScan);
            
            // Add a section header based on the address type
            let sectionTitle;
            if (type === 'suspicious') {
              sectionTitle = '## Suspicious Address Analysis';
            } else if (type === 'user') {
              sectionTitle = '## Your Wallet Analysis';
            } else {
              sectionTitle = `## Detected Address Analysis`;
            }
            
            // Add this section to our combined output
            onChainDataParts.push(`${sectionTitle}\n\n${formattedAnalysis}`);
            
            // For premium scans, also get detailed analysis for AI context
            if (isPremiumScan) {
              const detailedAnalysis = await getAddressAnalysisSummary(address);
              addressAnalysisForAI += `\n\n--- ${type.toUpperCase()} ADDRESS ANALYSIS ---\n${detailedAnalysis}`;
            }
          } catch (error) {
            console.error(`Error analyzing ${type} address:`, error);
            onChainDataParts.push(`## ${type.charAt(0).toUpperCase()}${type.slice(1)} Address Analysis\n\nUnable to retrieve on-chain data for this address. The address may be invalid or the Etherscan API may be unavailable.`);
          }
        }
        
        // Combine all parts with separators
        onChainData = onChainDataParts.join('\n\n');
      }
      
      // Check storage cache only for basic scans with no addresses or just a scenario
      // We always want to run premium scans fresh since they include live on-chain data
      let cachedResult = null;
      
      if (!isPremiumScan && addressesToAnalyze.length === 0 && hasScenario) {
        cachedResult = await storage.getScamCheckByScenario(scenario);
      }
      
      // Use cached result if available
      if (cachedResult) {
        const response = {
          riskLevel: cachedResult.riskLevel,
          summary: cachedResult.summary,
          redFlags: cachedResult.redFlags || [],
          safetyTips: cachedResult.safetyTips || [],
          addressAnalysis: cachedResult.addressAnalysis,
          onChainData
        };
        
        return res.json(scamCheckResponse.parse(response));
      }
      
      // Execute the scam check with OpenAI
      // Pass the first address as the primary one for backward compatibility
      const primaryAddress = addressesToAnalyze.length > 0 ? addressesToAnalyze[0].address : '';
      
      // If this is an address-only scan with no scenario text, create a placeholder scenario
      const scenarioText = hasScenario 
        ? scenario
        : (addressesToAnalyze.length > 0 
            ? `Please analyze ${addressesToAnalyze.length > 1 ? 'these addresses' : 'this address'} for any security concerns.` 
            : '');
      
      // Run the scam check with enhanced context
      const scamCheckResult = await checkScam(
        scenarioText, 
        // Include the primary address for backward compatibility
        primaryAddress,
        // Also pass the detailed analysis if available
        addressAnalysisForAI
      );
      
      // For basic scans with scenario text, store in the database
      if (!isPremiumScan && hasScenario) {
        // Store the result in the database for future use
        await storage.createScamCheck({
          scenario,
          address: primaryAddress || null,
          riskLevel: scamCheckResult.riskLevel,
          summary: scamCheckResult.summary,
          redFlags: scamCheckResult.redFlags,
          safetyTips: scamCheckResult.safetyTips,
          addressAnalysis: scamCheckResult.addressAnalysis || '',
        });
      }
      
      // Build the final response
      const response = {
        riskLevel: scamCheckResult.riskLevel,
        summary: scamCheckResult.summary,
        redFlags: scamCheckResult.redFlags,
        safetyTips: scamCheckResult.safetyTips,
        addressAnalysis: addressAnalysisForAI || scamCheckResult.addressAnalysis || '',
        onChainData,
        isAdmin // Include admin status in response
      };
      
      // Log this scan for analytics
      try {
        // Store etherscan data in a structured format for database storage
        if (onChainData) {
          etherscanData = { 
            rawData: onChainData.substring(0, 5000), // Truncate if too long
            addresses: addressesToAnalyze.map(a => a.address)
          };
        }
        
        // Create a scan log entry
        await storage.createScanLog({
          scan_type: isPremiumScan ? 'premium' : 'free',
          input_type: inputType,
          scenario: scenario || null,
          submitted_address_1: suspiciousAddress || null,
          submitted_address_2: userAddress || null,
          extracted_addresses: extractedAddresses.filter((a: any) => typeof a === 'string').map((a: string) => a.trim()),
          user_email: email || null,
          admin_override_used: isAdmin,
          risk_level: scamCheckResult.riskLevel,
          ai_summary: scamCheckResult.summary,
          etherscan_data: etherscanData,
          scan_result: {
            riskLevel: scamCheckResult.riskLevel,
            summary: scamCheckResult.summary,
            redFlags: scamCheckResult.redFlags,
            safetyTips: scamCheckResult.safetyTips
          }
        });
        
        // If this is a premium feature request and we have an email, log it
        if (isPremiumScan && email) {
          await storage.logPremiumFeatureRequest({
            email,
            feature_requested: 'advanced_scan',
            was_admin: isAdmin,
            request_details: {
              scan_type: 'advanced',
              has_addresses: addressesToAnalyze.length > 0,
              has_scenario: hasScenario
            }
          });
        }
      } catch (logError) {
        // Don't let logging errors affect the response to the client
        console.error('Error logging scan:', logError);
      }
      
      return res.json(scamCheckResponse.parse(response));
    } catch (err) {
      return handleError(err, res);
    }
  });

  // API endpoint to request expert investigation
  app.post("/api/request-expert", async (req: Request, res: Response) => {
    try {
      const { 
        scenario, 
        suspiciousAddress,
        userAddress,
        extractedAddresses,
        notes,
        email 
      } = req.body;
      
      if (!scenario || typeof scenario !== "string") {
        return res.status(400).json({ message: "Scenario is required and must be a string" });
      }
      
      // Check if this is an admin user and create/update user record
      let isAdmin = false;
      if (email && typeof email === 'string') {
        const user = await storage.createOrUpdateUserByEmail(email);
        isAdmin = user.is_admin || false;
      }
      
      // Combine all addresses into a structured format for storage
      const addresses = [];
      
      if (suspiciousAddress && typeof suspiciousAddress === 'string' && suspiciousAddress.trim()) {
        addresses.push({ address: suspiciousAddress.trim(), type: 'suspicious' });
      }
      
      if (userAddress && typeof userAddress === 'string' && userAddress.trim()) {
        addresses.push({ address: userAddress.trim(), type: 'user' });
      }
      
      if (Array.isArray(extractedAddresses) && extractedAddresses.length > 0) {
        for (const addr of extractedAddresses) {
          if (typeof addr === 'string' && addr.trim()) {
            addresses.push({ address: addr.trim(), type: 'extracted' });
          }
        }
      }
      
      // Convert addresses to JSON for storage
      // For backward compatibility, also store the first address in the original field if any exist
      const primaryAddress = addresses.length > 0 ? addresses[0].address : null;
      const addressData = addresses.length > 0 ? JSON.stringify(addresses) : null;
      
      // Create expert investigation request with user info
      const expertRequest = await storage.createExpertRequest({
        scenario,
        address: primaryAddress, // Keep for backward compatibility
        addressData, // New field for structured address data
        notes: notes || null,
        user_email: email || null,
        was_admin: isAdmin
      });
      
      // Log the premium feature request
      try {
        if (email) {
          await storage.logPremiumFeatureRequest({
            email,
            feature_requested: 'expert_investigation',
            was_admin: isAdmin,
            request_details: {
              has_addresses: addresses.length > 0,
              scenario_length: scenario.length
            }
          });
        }
      } catch (logError) {
        console.error('Error logging premium feature request:', logError);
      }
      
      return res.status(201).json({
        id: expertRequest.id,
        message: "Expert investigation request submitted successfully",
        requestDate: expertRequest.requestDate,
        isAdmin
      });
    } catch (err) {
      return handleError(err, res);
    }
  });

  // API endpoint to get all expert investigation requests (for admin panel)
  app.get("/api/expert-requests", async (req: Request, res: Response) => {
    try {
      const requests = await storage.getAllExpertRequests();
      return res.json(requests);
    } catch (err) {
      return handleError(err, res);
    }
  });
  
  // API endpoint to check admin status (for testing)
  app.get("/api/check-admin", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Valid email is required as a query parameter" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.json({ 
          email,
          exists: false,
          is_admin: false,
          message: "User not found"
        });
      }
      
      return res.json({
        email,
        exists: true,
        is_admin: user.is_admin,
        joined_at: user.joined_at,
        subscribed_to_blog: user.subscribed_to_blog,
        requested_premium: user.requested_premium
      });
    } catch (err) {
      return handleError(err, res);
    }
  });
  
  // Get list of admin emails
  app.get("/api/admin-emails", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      // Set explicit content type to ensure proper JSON response
      res.setHeader('Content-Type', 'application/json');
      
      // Security check - only admins can view the admin list
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Valid email is required as a query parameter" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user?.is_admin) {
        return res.status(403).json({ 
          message: "Access denied. You must be an admin to view the admin list."
        });
      }
      
      // If user is admin, return the list of admin emails
      const adminEmails = storage.getAdminEmails();
      
      return res.json({
        adminEmails,
        count: adminEmails.length
      });
    } catch (err) {
      return handleError(err, res);
    }
  });
  
  // Add a new admin email to the whitelist
  app.post("/api/admin-emails", async (req: Request, res: Response) => {
    try {
      const { requesterEmail, newAdminEmail } = req.body;
      
      // Security check - only admins can add new admins
      if (!requesterEmail || !newAdminEmail) {
        return res.status(400).json({ 
          message: "Both requesterEmail and newAdminEmail are required" 
        });
      }
      
      const user = await storage.getUserByEmail(requesterEmail);
      
      if (!user?.is_admin) {
        return res.status(403).json({ 
          message: "Access denied. You must be an admin to add new admins."
        });
      }
      
      // Add the new admin email
      const updatedAdminList = storage.addAdminEmail(newAdminEmail);
      
      return res.json({
        message: `${newAdminEmail} has been added to admin whitelist`,
        adminEmails: updatedAdminList,
        count: updatedAdminList.length
      });
    } catch (err) {
      return handleError(err, res);
    }
  });

  // API endpoint to get usage stats for an email (for testing)
  app.get("/api/usage-stats", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Valid email is required as a query parameter" });
      }
      
      // Get all activity for this email
      const [
        user,
        scanLogs,
        premiumRequests
      ] = await Promise.all([
        storage.getUserByEmail(email),
        storage.getScanLogsByEmail(email),
        storage.getPremiumRequestsByEmail(email)
      ]);
      
      return res.json({
        email,
        userExists: !!user,
        isAdmin: user?.is_admin || false,
        stats: {
          totalScans: scanLogs.length,
          premiumScans: scanLogs.filter(log => log.scan_type === 'premium').length,
          premiumFeatureRequests: premiumRequests.length,
          lastActivity: scanLogs.length > 0 ? scanLogs[0].timestamp : null
        },
        scanTypes: scanLogs.reduce((acc, log) => {
          acc[log.scan_type] = (acc[log.scan_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        requestedFeatures: premiumRequests.map(req => req.feature_requested)
      });
    } catch (err) {
      return handleError(err, res);
    }
  });
  
  // API endpoint to handle premium subscriptions and email signups
  app.post("/api/subscribe", async (req: Request, res: Response) => {
    try {
      const { email, source, subscribeToNewsletter = false } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Valid email is required" });
      }
      
      // Create or update user with subscription preference
      const user = await storage.createOrUpdateUserByEmail(email, {
        subscribed_to_blog: subscribeToNewsletter,
        requested_premium: true
      });
      
      // Log the subscription request
      try {
        await storage.logPremiumFeatureRequest({
          email,
          feature_requested: 'premium_subscription',
          was_admin: user.is_admin,
          request_details: {
            source: source || 'direct',
            subscribe_to_newsletter: subscribeToNewsletter
          }
        });
      } catch (logError) {
        console.error('Error logging premium subscription request:', logError);
      }
      
      // Log to console (useful for debugging)
      console.log(`New subscriber: ${email}, Source: ${source || 'direct'}, Admin: ${user.is_admin ? 'Yes' : 'No'}`);
      
      // Return success response with admin status for client-side usage
      res.status(200).json({ 
        success: true,
        message: "Subscription successful",
        isAdmin: user.is_admin
      });
    } catch (err) {
      return handleError(err, res);
    }
  });
  
  // Activate bonus prompt API endpoint
  app.post("/api/activate-bonus", async (req: Request, res: Response) => {
    const { email } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || '0.0.0.0';
    
    // Validation
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email",
        message: "Please provide a valid email address"
      });
    }
    
    try {
      // Check if user already has active bonus prompts for today
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const existingBonus = await storage.getBonusPromptByEmail(email, today);
      
      if (existingBonus) {
        // Already has bonus prompts for today
        const bonusStatus = await storage.hasBonusPromptsRemaining(email);
        
        return res.json({
          success: true,
          message: bonusStatus.hasBonusPrompts
            ? `You have ${bonusStatus.remainingBonusPrompts} bonus prompts remaining for today.`
            : "You've already used all your bonus prompts for today.",
          alreadyActivated: true,
          bonusPrompts: bonusStatus
        });
      }
      
      // Create a new bonus prompt allocation
      const bonusPrompt = await storage.createBonusPrompt(email, clientIp);
      
      // Also create or update the user
      await storage.createOrUpdateUserByEmail(email);
      
      // Log this prompt activation for analytics
      try {
        await storage.logPremiumFeatureRequest({
          email,
          feature_requested: 'bonus_prompts',
          was_admin: false,
          request_details: {
            source: 'email_unlock',
            ip_address: clientIp
          }
        });
      } catch (logError) {
        console.error('Error logging bonus prompt activation:', logError);
      }
      
      return res.json({
        success: true,
        message: "Bonus prompts successfully activated! You now have 5 additional prompts for today.",
        alreadyActivated: false,
        bonusPrompts: {
          hasBonusPrompts: true,
          remainingBonusPrompts: 5,
          alreadyUsedToday: false
        }
      });
    } catch (error) {
      return handleError(error, res);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
