import OpenAI from "openai";
import { getAddressAnalysisSummary, isValidAddress } from "./etherscan";

if (!process.env.OPENAI_API_KEY) {
  console.warn("Missing OPENAI_API_KEY environment variable. OpenAI API calls will fail.");
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "missing-api-key"
});

// Unified system prompt for Crypto Clarity Assistant
const CRYPTO_CLARITY_SYSTEM_PROMPT = `
You are Crypto Clarity Assistant, created by Hayward Digital LLC. 
Your mission is to help users navigate the cryptocurrency space with clarity, safety, and expert guidance.

When users submit a crypto term, phrase, or question:
- Explain it in clear language suitable for smart teenagers and curious adults new to crypto.
- Use practical examples where helpful.
- Maintain a professional, objective, and welcoming tone.
- Stay technology agnostic — recognize and explain all major blockchains neutrally.

When users describe a potential scam scenario or submit a blockchain address:
- If the user submits an address with no scenario text, your response should focus on analyzing that address based on the on-chain data provided.
- If the address is a known address (such as an exchange, prominent individual, or project), emphasize this important context in your response.
- Assess the likelihood of a scam based on known fraud patterns (Pig Butchering, phishing, fake exchanges, etc.) AND any on-chain data provided.
- For blockchain addresses, analyze wallet activity patterns, transaction history, balance information, and contract verification status (if applicable).
- Classify the risk as Low, Medium, or High.
- Provide a clear explanation why, citing specific data points from the on-chain analysis when available.
- For contract addresses, assess verification status and explain its importance for user safety.
- Offer actionable safety tips without pushing financial advice.

Important:
- Always prioritize user safety, education, and clarity.
- If on-chain data indicates a wallet belongs to a known entity (like Vitalik Buterin, Binance, etc.), always mention this explicitly in your analysis.
- For contract addresses, verification status is a critical safety signal - emphasize this in your analysis.
- When transaction count or age information is available, use it to assess whether an address has established history or appears to be a newer/burner account.
- If provided, always use name tags from Etherscan to provide context about an address's identity or purpose.
- Remain respectful, neutral, and professional in all cases.
`;

interface TranslateTermResponse {
  explanation: string;
  relatedTerms: string[];
}

export async function translateTerm(term: string, audienceType: string = 'beginner'): Promise<TranslateTermResponse> {
  try {
    // Define different user prompts based on audience type
    let userPrompt = "";
    
    if (audienceType === 'beginner') {
      userPrompt = `Please explain this crypto concept in a way a teenager or new crypto user would understand: "${term}". Use simple but accurate language, and give one practical example. Be clear and approachable, but not overly simplified or condescending. Target a smart teenager or curious adult who is new to crypto. Explain in 2-3 concise paragraphs. Also provide 3 related terms that someone might want to know about next. Return your response as a JSON with 'explanation' and 'relatedTerms' keys. The relatedTerms should be an array of strings.`;
    } else if (audienceType === 'expert') {
      userPrompt = `Please explain this crypto term or question in an advanced, technical tone suitable for a knowledgeable or experienced user: "${term}". Include examples, definitions, or protocol-level context as appropriate. Assume the reader has a solid foundation in blockchain technology, programming concepts, and cryptography. Use precise technical terminology. Explain in 2-3 detailed paragraphs. Also provide 3 related advanced terms that would enrich understanding. Return your response as a JSON with 'explanation' and 'relatedTerms' keys. The relatedTerms should be an array of strings.`;
    } else {
      userPrompt = `Explain this crypto term for someone with intermediate knowledge: "${term}". Provide a clear explanation in 2-3 paragraphs, using proper terminology but still explaining key concepts. Also provide 3 related terms that would be useful to understand next. Return your response as a JSON with 'explanation' and 'relatedTerms' keys. The relatedTerms should be an array of strings.`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: CRYPTO_CLARITY_SYSTEM_PROMPT
        },
        { 
          role: "user", 
          content: userPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      explanation: result.explanation || "Sorry, I couldn't generate an explanation for this term.",
      relatedTerms: Array.isArray(result.relatedTerms) ? result.relatedTerms : [],
    };
  } catch (error: any) {
    console.error("Error translating term:", error);
    throw new Error(`Failed to translate term: ${error.message}`);
  }
}

export interface ScamCheckResult {
  riskLevel: string;
  summary: string;
  redFlags: string[];
  safetyTips: string[];
  addressAnalysis?: string;
}

export async function checkScam(
  scenario: string, 
  primaryAddress?: string, 
  addressAnalysisContext?: string
): Promise<ScamCheckResult> {
  try {
    // Prepare address analysis data
    let addressAnalysisData = '';
    
    // If pre-computed address analysis is provided, use it directly
    if (addressAnalysisContext && addressAnalysisContext.trim()) {
      addressAnalysisData = addressAnalysisContext;
    } 
    // Otherwise, analyze the primary address if provided
    else if (primaryAddress && primaryAddress.trim()) {
      const validAddress = await isValidAddress(primaryAddress);
      const isAddressOnlyQuery = !scenario || scenario.trim() === '';
      
      if (validAddress) {
        try {
          // Get on-chain data from Etherscan
          const etherscanAnalysis = await getAddressAnalysisSummary(primaryAddress);
          
          if (isAddressOnlyQuery) {
            // Create a more detailed prompt for address-only queries
            addressAnalysisData = `\n\nThe user has submitted this Ethereum address for analysis: ${primaryAddress}\n\nHere is the on-chain data for this address:\n${etherscanAnalysis}\n\nBased on the Etherscan API results and any known public attributions, provide a comprehensive risk assessment. Explain who the address may belong to, what it's typically used for, and whether it is likely legitimate or suspicious. Include references to exchange use, verified contracts, or known scams if applicable.`;
          } else {
            // For combined scenario+address queries
            addressAnalysisData = `\n\nThe user also provided this Ethereum address for analysis: ${primaryAddress}\n\nHere is the on-chain data for this address:\n${etherscanAnalysis}\n\nIncorporate this address data into your scam assessment if relevant. Identify if there's a connection between the scenario described and this specific address.`;
          }
        } catch (error) {
          console.error("Error getting Etherscan data:", error);
          addressAnalysisData = '\n\nThe Etherscan API was unable to retrieve on-chain data for this address. Please verify that the Etherscan API key is valid and has the necessary permissions.';
        }
      } else {
        addressAnalysisData = '\n\nThe provided address appears to be an invalid Ethereum address format. Please check for typos or formatting issues.';
      }
    }

    // Determine the user prompt based on scenario and available address data
    let userPrompt = '';
    const isAddressOnlyQuery = !scenario || scenario.trim() === '';
    
    if (isAddressOnlyQuery && (primaryAddress || addressAnalysisContext)) {
      // If primary address is provided but no pre-analysis, use that
      if (primaryAddress && !addressAnalysisContext) {
        userPrompt = `Analyze this Ethereum address: ${primaryAddress}${addressAnalysisData}`;
      } 
      // If we have pre-analyzed address data, create a prompt for multiple addresses
      else if (addressAnalysisContext) {
        userPrompt = `Analyze the following Ethereum addresses:${addressAnalysisData}`;
      }
    } else {
      userPrompt = `Analyze this scenario for potential crypto scams: "${scenario}"${addressAnalysisData}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: CRYPTO_CLARITY_SYSTEM_PROMPT
        },
        { 
          role: "user", 
          content: `${userPrompt}
          
          Return a JSON with the following format:
          {
            "riskLevel": "High Risk", "Medium Risk", or "Low Risk",
            "summary": "A brief explanation covering the risk assessment and key insights",
            "redFlags": ["List of specific red flags or concerns as strings"],
            "safetyTips": ["List of actionable safety tips as strings"],
            "addressAnalysis": "A comprehensive analysis of the address combining on-chain data and your expertise. Include known entity attribution if available (e.g., 'This is Vitalik Buterin's wallet', 'This belongs to Binance exchange', etc.)." 
          }`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      riskLevel: result.riskLevel || "Unknown Risk",
      summary: result.summary || "Could not analyze this scenario.",
      redFlags: Array.isArray(result.redFlags) ? result.redFlags : [],
      safetyTips: Array.isArray(result.safetyTips) ? result.safetyTips : [],
      addressAnalysis: result.addressAnalysis || undefined,
    };
  } catch (error: any) {
    console.error("Error checking scam:", error);
    throw new Error(`Failed to check scam: ${error.message}`);
  }
}
