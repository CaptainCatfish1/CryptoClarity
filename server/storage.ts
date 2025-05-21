import { users, type User, type InsertUser, 
  cryptoTerms, type CryptoTerm, type InsertCryptoTerm,
  scamChecks, type ScamCheck, type InsertScamCheck,
  expertRequests, type ExpertRequest, type InsertExpertRequest,
  scanLogs, type ScanLog, type InsertScanLog,
  premiumRequests, type PremiumRequest, type InsertPremiumRequest,
  rateLimits, type RateLimit, type InsertRateLimit,
  bonusPrompts, type BonusPrompt, type InsertBonusPrompt } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, and, sql } from "drizzle-orm";

// modify the interface with any CRUD methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createOrUpdateUserByEmail(email: string, updates?: Partial<InsertUser>): Promise<User>;
  
  // Crypto term methods
  getCryptoTerm(id: number): Promise<CryptoTerm | undefined>;
  getCryptoTermByName(term: string): Promise<CryptoTerm | undefined>;
  createCryptoTerm(term: InsertCryptoTerm): Promise<CryptoTerm>;
  getRecentCryptoTerms(limit?: number): Promise<CryptoTerm[]>;
  
  // Scam check methods
  getScamCheck(id: number): Promise<ScamCheck | undefined>;
  getScamCheckByScenario(scenario: string): Promise<ScamCheck | undefined>;
  createScamCheck(check: InsertScamCheck): Promise<ScamCheck>;
  
  // Scan logging methods
  createScanLog(log: InsertScanLog): Promise<ScanLog>;
  getScanLogsByEmail(email: string, limit?: number): Promise<ScanLog[]>;
  getScanLogsByType(scanType: string, limit?: number): Promise<ScanLog[]>;
  getScanLogsWithAdminOverride(limit?: number): Promise<ScanLog[]>;
  
  // Premium feature tracking methods
  logPremiumFeatureRequest(request: InsertPremiumRequest): Promise<PremiumRequest>;
  getPremiumRequestsByEmail(email: string): Promise<PremiumRequest[]>;
  getPremiumRequestsByFeature(feature: string): Promise<PremiumRequest[]>;
  
  // Expert investigation request methods
  createExpertRequest(request: InsertExpertRequest): Promise<ExpertRequest>;
  getAllExpertRequests(): Promise<ExpertRequest[]>;
  getExpertRequest(id: number): Promise<ExpertRequest | undefined>;
  updateExpertRequestStatus(id: number, status: string): Promise<ExpertRequest>;
  getExpertRequestsByEmail(email: string): Promise<ExpertRequest[]>;
  
  // Bonus prompt methods
  createBonusPrompt(email: string, ip: string): Promise<BonusPrompt>;
  getBonusPromptByEmail(email: string, currentDay: string): Promise<BonusPrompt | undefined>;
  incrementBonusPromptUsage(id: number): Promise<BonusPrompt>;
  hasBonusPromptsRemaining(email: string): Promise<{
    hasBonusPrompts: boolean;
    remainingBonusPrompts: number;
    alreadyUsedToday: boolean;
  }>;
  
  // Rate limiting methods
  checkRateLimit(ip: string, endpoint: string, email?: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    isAdmin: boolean;
    isPremium: boolean;
    hasBonusPrompts?: boolean;
    bonusPromptsRemaining?: number;
  }>;
  incrementRateLimit(ip: string, endpoint: string, email?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Admin email whitelist - this is the master list of admin emails
  private adminEmails = [
    "brenthayward1@gmail.com", "brentphayward1@gmail.com",
    // Add additional admin emails below
    // "another.admin@example.com",
  ];

  /**
   * Get the current list of admin emails
   */
  getAdminEmails(): string[] {
    return [...this.adminEmails];
  }

  /**
   * Add a new admin email to the whitelist
   */
  addAdminEmail(email: string): string[] {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email is already in the list
    if (!this.adminEmails.includes(normalizedEmail)) {
      this.adminEmails.push(normalizedEmail);
      
      // Also update the user record if it exists
      this.getUserByEmail(normalizedEmail).then(user => {
        if (user) {
          this.updateUserAdminStatus(user.id, true);
        }
      }).catch(err => {
        console.error(`Error updating admin status for ${normalizedEmail}:`, err);
      });
    }
    
    return this.getAdminEmails();
  }

  /**
   * Update user's admin status
   */
  async updateUserAdminStatus(id: number, isAdmin: boolean): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ is_admin: isAdmin })
      .where(eq(users.id, id))
      .returning();
      
    return updatedUser;
  }

  /**
   * Check if an email is in the admin whitelist
   */
  private isAdminEmail(email: string): boolean {
    return this.adminEmails.includes(email.toLowerCase());
  }
  
  async createOrUpdateUserByEmail(email: string, updates: Partial<InsertUser> = {}): Promise<User> {
    // Check if user with this email already exists
    const existingUser = await this.getUserByEmail(email);
    
    // Check if this is an admin email (whitelist)
    const isAdmin = this.isAdminEmail(email.toLowerCase());
    
    if (existingUser) {
      // User exists, update fields
      const updatedFields = {
        ...updates,
        is_admin: isAdmin || existingUser.is_admin,
      };
      
      const [updatedUser] = await db.update(users)
        .set(updatedFields)
        .where(eq(users.id, existingUser.id))
        .returning();
        
      return updatedUser;
    } else {
      // Create new user with email
      const userToCreate = {
        email,
        is_admin: isAdmin,
        ...updates,
      };
      
      const [newUser] = await db.insert(users)
        .values(userToCreate)
        .returning();
        
      return newUser;
    }
  }
  
  // Crypto term methods
  async getCryptoTerm(id: number): Promise<CryptoTerm | undefined> {
    const [term] = await db.select().from(cryptoTerms).where(eq(cryptoTerms.id, id));
    return term;
  }
  
  async getCryptoTermByName(termName: string): Promise<CryptoTerm | undefined> {
    const normalizedTerm = termName.toLowerCase().trim();
    const [term] = await db.select().from(cryptoTerms)
      .where(eq(cryptoTerms.term, normalizedTerm));
    return term;
  }
  
  async createCryptoTerm(insertTerm: InsertCryptoTerm): Promise<CryptoTerm> {
    const [term] = await db.insert(cryptoTerms).values(insertTerm).returning();
    return term;
  }
  
  async getRecentCryptoTerms(limit: number = 5): Promise<CryptoTerm[]> {
    return await db.select().from(cryptoTerms)
      .orderBy(desc(cryptoTerms.createdAt))
      .limit(limit);
  }
  
  // Scam check methods
  async getScamCheck(id: number): Promise<ScamCheck | undefined> {
    const [check] = await db.select().from(scamChecks).where(eq(scamChecks.id, id));
    return check;
  }
  
  async getScamCheckByScenario(scenario: string): Promise<ScamCheck | undefined> {
    const [check] = await db.select().from(scamChecks)
      .where(eq(scamChecks.scenario, scenario));
    return check;
  }
  
  async createScamCheck(insertCheck: InsertScamCheck): Promise<ScamCheck> {
    const [check] = await db.insert(scamChecks).values(insertCheck).returning();
    return check;
  }
  
  // Expert investigation request methods
  async createExpertRequest(insertRequest: InsertExpertRequest): Promise<ExpertRequest> {
    const [request] = await db.insert(expertRequests).values(insertRequest).returning();
    return request;
  }
  
  async getAllExpertRequests(): Promise<ExpertRequest[]> {
    return await db.select().from(expertRequests)
      .orderBy(desc(expertRequests.requestDate));
  }
  
  async getExpertRequest(id: number): Promise<ExpertRequest | undefined> {
    const [request] = await db.select().from(expertRequests).where(eq(expertRequests.id, id));
    return request;
  }
  
  async updateExpertRequestStatus(id: number, status: string): Promise<ExpertRequest> {
    const [updatedRequest] = await db.update(expertRequests)
      .set({ status })
      .where(eq(expertRequests.id, id))
      .returning();
    return updatedRequest;
  }
  
  async getExpertRequestsByEmail(email: string): Promise<ExpertRequest[]> {
    return await db.select().from(expertRequests)
      .where(eq(expertRequests.user_email, email))
      .orderBy(desc(expertRequests.requestDate));
  }
  
  // Scan logging methods
  async createScanLog(log: InsertScanLog): Promise<ScanLog> {
    const [scanLog] = await db.insert(scanLogs).values(log).returning();
    return scanLog;
  }
  
  async getScanLogsByEmail(email: string, limit: number = 20): Promise<ScanLog[]> {
    return await db.select().from(scanLogs)
      .where(eq(scanLogs.user_email, email))
      .orderBy(desc(scanLogs.timestamp))
      .limit(limit);
  }
  
  async getScanLogsByType(scanType: string, limit: number = 50): Promise<ScanLog[]> {
    return await db.select().from(scanLogs)
      .where(eq(scanLogs.scan_type, scanType))
      .orderBy(desc(scanLogs.timestamp))
      .limit(limit);
  }
  
  async getScanLogsWithAdminOverride(limit: number = 50): Promise<ScanLog[]> {
    return await db.select().from(scanLogs)
      .where(eq(scanLogs.admin_override_used, true))
      .orderBy(desc(scanLogs.timestamp))
      .limit(limit);
  }
  
  // Premium feature tracking methods
  async logPremiumFeatureRequest(request: InsertPremiumRequest): Promise<PremiumRequest> {
    const [premiumRequest] = await db.insert(premiumRequests).values(request).returning();
    return premiumRequest;
  }
  
  async getPremiumRequestsByEmail(email: string): Promise<PremiumRequest[]> {
    return await db.select().from(premiumRequests)
      .where(eq(premiumRequests.email, email))
      .orderBy(desc(premiumRequests.timestamp));
  }
  
  async getPremiumRequestsByFeature(feature: string): Promise<PremiumRequest[]> {
    return await db.select().from(premiumRequests)
      .where(eq(premiumRequests.feature_requested, feature))
      .orderBy(desc(premiumRequests.timestamp));
  }
  
  // Bonus prompt methods
  async createBonusPrompt(email: string, ip: string): Promise<BonusPrompt> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Create expiration timestamp - end of day
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const bonusPromptData = {
      email: email.toLowerCase().trim(),
      bonus_activated_at: new Date(),
      bonus_used_count: 0,
      activation_day: today,
      ip_address: ip,
      expires_at: endOfDay,
    };
    
    const [bonusPrompt] = await db.insert(bonusPrompts).values(bonusPromptData).returning();
    return bonusPrompt;
  }
  
  async getBonusPromptByEmail(email: string, currentDay: string): Promise<BonusPrompt | undefined> {
    // Get bonus prompt for today by email
    const [bonusPrompt] = await db.select().from(bonusPrompts).where(
      and(
        eq(bonusPrompts.email, email.toLowerCase().trim()),
        eq(bonusPrompts.activation_day, currentDay)
      )
    );
    
    return bonusPrompt;
  }
  
  async incrementBonusPromptUsage(id: number): Promise<BonusPrompt> {
    // Increment the bonus used count
    const [updatedBonusPrompt] = await db.update(bonusPrompts)
      .set({
        bonus_used_count: sql`${bonusPrompts.bonus_used_count} + 1`,
      })
      .where(eq(bonusPrompts.id, id))
      .returning();
      
    return updatedBonusPrompt;
  }
  
  async hasBonusPromptsRemaining(email: string): Promise<{
    hasBonusPrompts: boolean;
    remainingBonusPrompts: number;
    alreadyUsedToday: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const now = new Date();
    
    // Maximum bonus prompts per day
    const MAX_BONUS_PROMPTS = 5;
    
    // Check if user has activated bonus prompts today
    const bonusPrompt = await this.getBonusPromptByEmail(email, today);
    
    if (!bonusPrompt) {
      // Has never used bonus today
      return {
        hasBonusPrompts: false,
        remainingBonusPrompts: MAX_BONUS_PROMPTS,
        alreadyUsedToday: false
      };
    }
    
    // Check if bonus has expired
    const expiryTime = new Date(bonusPrompt.expires_at);
    if (now > expiryTime) {
      // Expired
      return {
        hasBonusPrompts: false,
        remainingBonusPrompts: 0,
        alreadyUsedToday: true
      };
    }
    
    // Check how many bonus prompts remain
    const usedCount = bonusPrompt.bonus_used_count;
    const remaining = Math.max(0, MAX_BONUS_PROMPTS - usedCount);
    
    return {
      hasBonusPrompts: remaining > 0,
      remainingBonusPrompts: remaining,
      alreadyUsedToday: true
    };
  }
  
  // Rate limiting methods
  async checkRateLimit(ip: string, endpoint: string, email?: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    isAdmin: boolean;
    isPremium: boolean;
    hasBonusPrompts?: boolean;
    bonusPromptsRemaining?: number;
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Default limits (per day)
    const DEFAULT_FREE_LIMIT = 100;
    const DEFAULT_PREMIUM_LIMIT = 1000; // High limit for premium users
    
    // Check if user is admin or premium based on email
    let isAdmin = false;
    let isPremium = false;
    
    if (email) {
      const user = await this.getUserByEmail(email);
      isAdmin = (user?.is_admin || this.isAdminEmail(email)) || false;
      // Premium = anyone who submitted email
      isPremium = !!email; 
    }
    
    // Admin always allowed
    if (isAdmin) {
      return {
        allowed: true,
        current: 0,
        limit: DEFAULT_PREMIUM_LIMIT,
        isAdmin: true,
        isPremium: true
      };
    }
    
    // Set limit based on user status
    const limit = isPremium ? DEFAULT_PREMIUM_LIMIT : DEFAULT_FREE_LIMIT;
    
    // Look for existing rate limit record by email if provided
    let rateLimitRecord = null;
    
    try {
      if (email) {
        // Check by email first
        const emailQuery = db.select().from(rateLimits).where(
          eq(rateLimits.user_email, email)
        );
        // Get results
        const emailResults = await emailQuery;
        
        if (emailResults.length > 0) {
          // Filter results client-side
          const filtered = emailResults.filter(
            r => r.endpoint === endpoint && r.date === today
          );
          if (filtered.length > 0) {
            rateLimitRecord = filtered[0];
          }
        }
      }
      
      // If not found by email or no email provided, check by IP
      if (!rateLimitRecord) {
        const ipQuery = db.select().from(rateLimits).where(
          eq(rateLimits.ip_address, ip)
        );
        // Get results
        const ipResults = await ipQuery;
        
        if (ipResults.length > 0) {
          // Filter results client-side
          const filtered = ipResults.filter(
            r => r.endpoint === endpoint && r.date === today
          );
          if (filtered.length > 0) {
            rateLimitRecord = filtered[0];
          }
        }
      }
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // If there's a database error, allow the request
      return {
        allowed: true, 
        current: 0,
        limit,
        isAdmin,
        isPremium,
        hasBonusPrompts: false,
        bonusPromptsRemaining: 0
      };
    }
    
    // No existing record found
    if (!rateLimitRecord) {
      return {
        allowed: true,
        current: 0,
        limit,
        isAdmin,
        isPremium,
        hasBonusPrompts: false,
        bonusPromptsRemaining: 0
      };
    }
    
    // Check if limit is reached
    const current = rateLimitRecord.request_count ? Number(rateLimitRecord.request_count) : 0;
    const allowed = current < limit;
    
    // Check if user has bonus prompts available
    let hasBonusPrompts = false;
    let bonusPromptsRemaining = 0;
    
    if (email && !isPremium && !isAdmin) {
      try {
        const bonusStatus = await this.hasBonusPromptsRemaining(email);
        hasBonusPrompts = bonusStatus.hasBonusPrompts;
        bonusPromptsRemaining = bonusStatus.remainingBonusPrompts;
      } catch (error) {
        console.error('Error checking bonus prompts:', error);
      }
    }
    
    return {
      allowed,
      current,
      limit,
      isAdmin,
      isPremium,
      hasBonusPrompts,
      bonusPromptsRemaining
    };
  }
  
  async incrementRateLimit(ip: string, endpoint: string, email?: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Try to find an existing entry for today
    let rateLimitRecord = null;
    
    try {
      if (email) {
        // Check by email first
        const emailQuery = db.select().from(rateLimits).where(
          eq(rateLimits.user_email, email)
        );
        // Get results
        const emailResults = await emailQuery;
        
        if (emailResults.length > 0) {
          // Filter results client-side
          const filtered = emailResults.filter(
            r => r.endpoint === endpoint && r.date === today
          );
          if (filtered.length > 0) {
            rateLimitRecord = filtered[0];
          }
        }
      }
      
      // If not found by email or no email provided, check by IP
      if (!rateLimitRecord) {
        const ipQuery = db.select().from(rateLimits).where(
          eq(rateLimits.ip_address, ip)
        );
        // Get results
        const ipResults = await ipQuery;
        
        if (ipResults.length > 0) {
          // Filter results client-side
          const filtered = ipResults.filter(
            r => r.endpoint === endpoint && r.date === today
          );
          if (filtered.length > 0) {
            rateLimitRecord = filtered[0];
          }
        }
      }
      
      if (rateLimitRecord) {
        // Update existing entry
        await db.update(rateLimits)
          .set({ 
            request_count: (rateLimitRecord.request_count || 0) + 1,
            last_request_at: new Date(),
            user_email: email || rateLimitRecord.user_email  // Keep existing email if none provided
          })
          .where(eq(rateLimits.id, rateLimitRecord.id));
      } else {
        // Create new entry
        await db.insert(rateLimits)
          .values({
            ip_address: ip,
            endpoint,
            date: today,
            user_email: email,
            request_count: 1,
          });
      }
    } catch (error) {
      console.error('Error incrementing rate limit:', error);
      // Allow the operation to continue even if rate limiting fails
    }
  }
}

// Use the DatabaseStorage implementation instead of MemStorage
export const storage = new DatabaseStorage();
