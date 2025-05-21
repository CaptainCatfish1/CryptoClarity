import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced users table with additional fields for premium status and admin privilege
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(),
  password: text("password"),
  
  // New fields as per requirements
  email: text("email").unique(),
  is_admin: boolean("is_admin").default(false),
  is_premium: boolean("is_premium").default(false),
  joined_at: timestamp("joined_at").defaultNow(),
  subscribed_to_blog: boolean("subscribed_to_blog").default(false),
  requested_premium: boolean("requested_premium").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  is_admin: true,
  is_premium: true,
  subscribed_to_blog: true,
  requested_premium: true,
});

// Crypto terms table to store previously translated terms
export const cryptoTerms = pgTable("crypto_terms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull().unique(),
  explanation: text("explanation").notNull(),
  relatedTerms: text("related_terms").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCryptoTermSchema = createInsertSchema(cryptoTerms).pick({
  term: true,
  explanation: true,
  relatedTerms: true,
});

// Scan logs table for tracking all Clarity Scan activity
export const scanLogs = pgTable("scan_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  scan_type: text("scan_type").notNull(), // "free" or "premium"
  input_type: text("input_type").notNull(), // "address_only", "scenario_only", or "both"
  scenario: text("scenario"),
  submitted_address_1: text("submitted_address_1"), // suspicious address
  submitted_address_2: text("submitted_address_2"), // user address
  extracted_addresses: text("extracted_addresses").array(), // addresses found in scenario
  user_email: text("user_email"),
  admin_override_used: boolean("admin_override_used").default(false),
  risk_level: text("risk_level"),
  ai_summary: text("ai_summary"),
  etherscan_data: jsonb("etherscan_data"), // Structured JSON for on-chain data
  scan_result: jsonb("scan_result"), // Complete result object
});

export const insertScanLogSchema = createInsertSchema(scanLogs).pick({
  scan_type: true,
  input_type: true,
  scenario: true,
  submitted_address_1: true,
  submitted_address_2: true,
  extracted_addresses: true,
  user_email: true,
  admin_override_used: true,
  risk_level: true,
  ai_summary: true,
  etherscan_data: true,
  scan_result: true,
});

// For backward compatibility - Scam checks to store previous scam checks
export const scamChecks = pgTable("scam_checks", {
  id: serial("id").primaryKey(),
  scenario: text("scenario").notNull(),
  address: text("address"),
  riskLevel: text("risk_level").notNull(),
  summary: text("summary").notNull(),
  redFlags: text("red_flags").array(),
  safetyTips: text("safety_tips").array(),
  addressAnalysis: text("address_analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScamCheckSchema = createInsertSchema(scamChecks).pick({
  scenario: true,
  address: true,
  riskLevel: true,
  summary: true,
  redFlags: true,
  safetyTips: true,
  addressAnalysis: true,
});

// Premium feature usage tracking
export const premiumRequests = pgTable("premium_requests", {
  id: serial("id").primaryKey(),
  email: text("email"),
  feature_requested: text("feature_requested").notNull(), // "investigation", "wallet_report", etc
  timestamp: timestamp("timestamp").defaultNow(),
  was_admin: boolean("was_admin").default(false),
  request_details: jsonb("request_details"), // Additional details for analytics
});

export const insertPremiumRequestSchema = createInsertSchema(premiumRequests).pick({
  email: true,
  feature_requested: true,
  was_admin: true,
  request_details: true,
});

// Expert investigation requests (enhanced with more tracking fields)
export const expertRequests = pgTable("expert_requests", {
  id: serial("id").primaryKey(),
  scenario: text("scenario").notNull(),
  address: text("address"),
  addressData: text("address_data"), // JSON string of address objects with type
  requestDate: timestamp("request_date").defaultNow(),
  status: text("status").default("pending").notNull(),
  notes: text("notes"),
  // New fields for better tracking
  user_email: text("user_email"),
  was_admin: boolean("was_admin").default(false),
  completed_date: timestamp("completed_date"),
  assigned_to: text("assigned_to"),
});

export const insertExpertRequestSchema = createInsertSchema(expertRequests).pick({
  scenario: true,
  address: true,
  addressData: true,
  notes: true,
  user_email: true,
  was_admin: true,
});

// Rate limiting table for API request control
export const rateLimits = pgTable("rate_limits", {
  id: serial("id").primaryKey(),
  ip_address: text("ip_address").notNull(),
  user_email: text("user_email"), // Linked to user email if available
  endpoint: text("endpoint").notNull(), // Which API endpoint was accessed
  request_count: integer("request_count").default(1),
  date: text("date").notNull(), // YYYY-MM-DD format for daily tracking
  last_request_at: timestamp("last_request_at").defaultNow(),
});

export const insertRateLimitSchema = createInsertSchema(rateLimits).pick({
  ip_address: true,
  user_email: true,
  endpoint: true,
  request_count: true,
  date: true,
});

// Define types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCryptoTerm = z.infer<typeof insertCryptoTermSchema>;
export type CryptoTerm = typeof cryptoTerms.$inferSelect;

export type InsertScamCheck = z.infer<typeof insertScamCheckSchema>;
export type ScamCheck = typeof scamChecks.$inferSelect;

export type InsertScanLog = z.infer<typeof insertScanLogSchema>;
export type ScanLog = typeof scanLogs.$inferSelect;

export type InsertPremiumRequest = z.infer<typeof insertPremiumRequestSchema>;
export type PremiumRequest = typeof premiumRequests.$inferSelect;

export type InsertExpertRequest = z.infer<typeof insertExpertRequestSchema>;
export type ExpertRequest = typeof expertRequests.$inferSelect;

export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;
export type RateLimit = typeof rateLimits.$inferSelect;

// Bonus prompts table to track email-gated bonus usage
export const bonusPrompts = pgTable("bonus_prompts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  bonus_activated_at: timestamp("bonus_activated_at").defaultNow().notNull(),
  bonus_used_count: integer("bonus_used_count").default(0).notNull(),
  activation_day: text("activation_day").notNull(), // Format: YYYY-MM-DD
  ip_address: text("ip_address").notNull(),
  expires_at: timestamp("expires_at").notNull(),
});

export const insertBonusPromptSchema = createInsertSchema(bonusPrompts).pick({
  email: true,
  bonus_activated_at: true,
  bonus_used_count: true,
  activation_day: true,
  ip_address: true, 
  expires_at: true,
});

export type InsertBonusPrompt = z.infer<typeof insertBonusPromptSchema>;
export type BonusPrompt = typeof bonusPrompts.$inferSelect;

// API response schemas
export const translateResponse = z.object({
  term: z.string(),
  explanation: z.string(),
  relatedTerms: z.array(z.string()),
  isAdmin: z.boolean().optional(),
});

export type TranslateResponse = z.infer<typeof translateResponse>;

export const scamCheckResponse = z.object({
  riskLevel: z.string(),
  summary: z.string(),
  redFlags: z.array(z.string()),
  safetyTips: z.array(z.string()),
  addressAnalysis: z.string().optional(),
  onChainData: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

export type ScamCheckResponse = z.infer<typeof scamCheckResponse>;
