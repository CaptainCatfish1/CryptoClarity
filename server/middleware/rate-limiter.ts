import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { isValidEmail } from '../utils/validation';

/**
 * Get the client IP address from the request
 */
function getClientIp(req: Request): string {
  // Try getting IP from headers first (handles proxies)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) 
      ? forwardedFor[0] 
      : forwardedFor.split(',')[0].trim();
    return ips;
  }
  
  // Fallback to direct connection IP
  return req.connection.remoteAddress || '0.0.0.0';
}

/**
 * Get normalized endpoint path for rate limiting
 */
function getEndpointPath(req: Request): string {
  // Extract the base endpoint path for grouping similar requests
  const path = req.path;
  const parts = path.split('/').filter(Boolean);
  
  // Use only first two levels for categorizing, e.g. /api/translate or /api/check-scam
  if (parts.length >= 2) {
    return `/${parts[0]}/${parts[1]}`;
  }
  
  return path;
}

/**
 * Rate limiting middleware for all API routes
 * Limits based on:
 * - Free tier: 100 requests per day
 * - Premium tier: 1000 requests per day
 * - Admin users: Unlimited
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    // For certain methods we don't need rate limiting
    if (req.method === 'OPTIONS') {
      return next();
    }
    
    // Get client identifier info
    const clientIp = getClientIp(req);
    const endpoint = getEndpointPath(req);
    
    // Try to get user email from query params, body, or headers
    const email = (
      (req.query.email as string) || 
      (req.body?.email as string) || 
      req.headers['x-user-email'] as string
    );
    
    // Default free limit per day
    const DEFAULT_FREE_LIMIT = 5;
    
    // Check if we're under the limit for this client
    const { 
      allowed, 
      current, 
      limit, 
      isAdmin, 
      isPremium,
      hasBonusPrompts = false,
      bonusPromptsRemaining = 0
    } = await storage.checkRateLimit(
      clientIp, 
      endpoint,
      isValidEmail(email) ? email : undefined
    );
    
    // Check if user has bonus prompts (email-only benefit)
    let bonusStatus = null;
    let totalAvailablePrompts = limit;
    
    if (email && isValidEmail(email) && !isPremium && !isAdmin) {
      bonusStatus = await storage.hasBonusPromptsRemaining(email);
      
      // If they have bonus prompts, add to the total available
      if (bonusStatus.hasBonusPrompts) {
        totalAvailablePrompts = limit + bonusStatus.remainingBonusPrompts;
      }
    }
    
    // Add rate limit info to response headers
    res.setHeader('X-RateLimit-Limit', totalAvailablePrompts.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, totalAvailablePrompts - current).toString());
    res.setHeader('X-RateLimit-Reset', new Date(new Date().setHours(24, 0, 0, 0)).toISOString());
    
    // For tracking in the client
    res.setHeader('X-User-IsAdmin', isAdmin ? 'true' : 'false');
    res.setHeader('X-User-IsPremium', isPremium ? 'true' : 'false');
    
    // Add bonus prompt info if available
    if (bonusStatus) {
      res.setHeader('X-Bonus-Prompts-Available', bonusStatus.hasBonusPrompts ? 'true' : 'false');
      res.setHeader('X-Bonus-Prompts-Remaining', bonusStatus.remainingBonusPrompts.toString());
      res.setHeader('X-Bonus-Prompts-Used-Today', bonusStatus.alreadyUsedToday ? 'true' : 'false');
    }
    
    // If allowed through normal rate limit, proceed
    if (allowed) {
      // Record this request in our counter
      await storage.incrementRateLimit(clientIp, endpoint, isValidEmail(email) ? email : undefined);
      return next();
    }
    
    // Check if bonus prompts are available to use
    if (bonusStatus && bonusStatus.hasBonusPrompts) {
      // User has exceeded regular limit but has bonus prompts available
      const bonusPrompt = await storage.getBonusPromptByEmail(email, new Date().toISOString().split('T')[0]);
      
      if (bonusPrompt) {
        // Use a bonus prompt
        await storage.incrementBonusPromptUsage(bonusPrompt.id);
        // Allow the request to proceed
        return next();
      }
    }
    
    // Determine appropriate message based on user status
    let limitMessage = '';
    
    if (isPremium) {
      limitMessage = 'You have reached your premium tier daily limit of 1000 requests.';
    } else if (bonusStatus && bonusStatus.alreadyUsedToday) {
      limitMessage = `You've used all ${DEFAULT_FREE_LIMIT} free prompts and all bonus prompts for today. Come back tomorrow for ${DEFAULT_FREE_LIMIT} more free prompts, or upgrade to premium for 1000 daily requests.`;
    } else {
      limitMessage = `You've used all ${DEFAULT_FREE_LIMIT} free prompts for today. Enter your email to unlock 5 bonus prompts, or upgrade to premium for 1000 daily requests.`;
    }
    
    // Rate limit exceeded
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: limitMessage,
      current,
      limit,
      isAdmin,
      isPremium,
      hasBonusPrompts: bonusStatus?.hasBonusPrompts || false,
      bonusPromptsRemaining: bonusStatus?.remainingBonusPrompts || 0,
      needsEmail: !email && !isPremium && !isAdmin,
      alreadyUsedBonusToday: bonusStatus?.alreadyUsedToday || false
    });
  } catch (error) {
    console.error('Rate limiter error:', error);
    // On error, allow request to proceed but log the issue
    return next();
  }
  
  // Fallback to ensure middleware doesn't hang
  if (!res.headersSent) {
    return next();
  }
}

/**
 * Middleware specifically for premium features
 * Checks if user is premium or admin, otherwise rejects
 */
export async function premiumFeatureCheck(req: Request, res: Response, next: NextFunction) {
  try {
    // Look for email in various places
    const email = (
      (req.query.email as string) || 
      (req.body?.email as string) || 
      req.headers['x-user-email'] as string
    );
    
    // If no email, reject
    if (!email || !isValidEmail(email)) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide your email to access premium features'
      });
    }
    
    // Get user from database
    const user = await storage.getUserByEmail(email);
    
    // Check if user exists and has premium or admin status
    if (user && (user.is_premium || user.is_admin)) {
      // User is authorized
      return next();
    }
    
    // Record this premium feature access attempt
    const clientIp = getClientIp(req);
    const endpoint = getEndpointPath(req);
    
    try {
      await storage.logPremiumFeatureRequest({
        email,
        feature_requested: endpoint,
        was_admin: false,
        request_details: {
          path: req.path,
          ip: clientIp,
          timestamp: new Date()
        }
      });
    } catch (logError) {
      console.error('Error logging premium request:', logError);
    }
    
    // Not authorized
    return res.status(403).json({
      error: 'Premium feature',
      message: 'This feature requires a premium subscription. Please upgrade to access.',
      isPremium: false
    });
  } catch (error) {
    console.error('Premium feature check error:', error);
    // On error, allow request to proceed but log the issue
    return next();
  }
  
  // Fallback to ensure middleware doesn't hang
  if (!res.headersSent) {
    return next();
  }
}