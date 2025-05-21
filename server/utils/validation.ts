import { z } from 'zod';

// Ethereum address validation
export const ethereumAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address format" });

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email format" })
  .min(5, { message: "Email is too short" })
  .max(255, { message: "Email is too long" });

// User-entered text validation
export const userTextSchema = z
  .string()
  .trim()
  .min(3, { message: "Text is too short" })
  .max(3000, { message: "Text exceeds maximum length" })
  // Basic XSS protection
  .refine(text => !text.includes('<script>'), {
    message: "Text contains potentially harmful content"
  });

// Safe query strings
export const safeQuerySchema = z
  .string()
  .trim()
  .max(500, { message: "Query is too long" })
  // Basic injection protection
  .refine(query => !/(--|;|\/\*|\*\/|@|@@|char|nchar|varchar|drop|exec|union|insert|select|delete|update|count|group|having|order|where)/i.test(query), {
    message: "Query contains potentially harmful content"
  });

// Audience type validation
export const audienceTypeSchema = z.enum(['beginner', 'intermediate', 'expert']);

// Scan type validation
export const scanTypeSchema = z.enum(['basic', 'advanced']);

// Validate Ethereum address
export function isValidEthereumAddress(address: string): boolean {
  try {
    ethereumAddressSchema.parse(address);
    return true;
  } catch (error) {
    return false;
  }
}

// Validate email address
export function isValidEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch (error) {
    return false;
  }
}

// Sanitize user text by removing potentially harmful content
export function sanitizeUserText(text: string): string {
  try {
    return userTextSchema.parse(text);
  } catch (error) {
    // If validation fails, apply additional sanitization
    return text
      .trim()
      .replace(/<script.*?>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<.*?>/g, '') // Remove HTML tags
      .substring(0, 3000); // Truncate to max length
  }
}

// Sanitize array of addresses
export function sanitizeAddressArray(addresses: string[]): string[] {
  if (!Array.isArray(addresses)) return [];
  
  return addresses
    .filter(address => typeof address === 'string')
    .map(address => address.trim())
    .filter(isValidEthereumAddress);
}

// Data validation helpers for API request bodies
export const translateRequestSchema = z.object({
  term: userTextSchema,
  audienceType: audienceTypeSchema.optional().default('beginner'),
  email: emailSchema.optional()
});

export const scamCheckRequestSchema = z.object({
  scenario: userTextSchema.optional(),
  suspiciousAddress: ethereumAddressSchema.optional(),
  userAddress: ethereumAddressSchema.optional(),
  extractedAddresses: z.array(ethereumAddressSchema).optional(),
  scanType: scanTypeSchema.optional().default('basic'),
  email: emailSchema.optional()
}).refine(data => 
  (data.scenario && data.scenario.trim().length > 0) || 
  data.suspiciousAddress || 
  data.userAddress || 
  (data.extractedAddresses && data.extractedAddresses.length > 0), 
  {
    message: "At least one of: scenario, suspiciousAddress, userAddress, or extractedAddresses is required"
  }
);

export const expertRequestSchema = z.object({
  scenario: userTextSchema,
  address: ethereumAddressSchema.optional(),
  email: emailSchema
});

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  message: userTextSchema
});