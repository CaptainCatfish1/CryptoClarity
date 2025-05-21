import fetch from 'node-fetch';
import { ethers } from 'ethers';

if (!process.env.ETHERSCAN_API_KEY) {
  console.warn("Missing ETHERSCAN_API_KEY environment variable. Etherscan API calls will fail.");
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_API_URL = 'https://api.etherscan.io/api';

// Adding utility function to convert timestamp to human-readable date
function formatTimestamp(timestamp: number | string): string {
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format ETH value with appropriate decimals
function formatEthValue(weiValue: string): string {
  try {
    const ethValue = parseFloat(ethers.formatUnits(BigInt(weiValue), 18));
    if (ethValue < 0.0001) return '< 0.0001 ETH';
    return `${ethValue.toFixed(4)} ETH`;
  } catch (error) {
    return '0 ETH';
  }
}

interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  gasPrice: string;
  gasUsed: string;
  input: string;
  methodId: string;
  functionName: string;
}

interface AddressLabel {
  nameTag: string;
  isVerifiedContract: boolean;
}

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  tokenSymbol: string;
  tokenName: string;
  value: string;
  timeStamp: string;
}

interface ContractInfo {
  isVerified: boolean;
  contractCreator: string;
  creationTransaction: string;
  creationTimestamp: string | null;
  implementation?: string; // For proxy contracts
}

interface OnChainAnalysis {
  // Basic info - Free tier
  nameTag: string;
  
  // Enhanced info - Premium tier
  balance: string;
  normalTxCount: number;
  tokenTxCount: number;
  internalTxCount: number;
  isContract: boolean;
  
  // Activity range
  firstTxTimestamp: string | null;
  lastTxTimestamp: string | null;
  
  // Contract specifics
  contractInfo: ContractInfo | null;
  
  // Additional analysis
  suspiciousPatterns: string[];
}

interface AddressAnalysis {
  balance: string;
  txCount: number;
  isContract: boolean;
  firstTxDate: string | null;
  recentTransactions: TransactionInfo[];
  suspiciousPatterns: string[];
}

export async function isValidAddress(address: string): Promise<boolean> {
  try {
    return ethers.isAddress(address);
  } catch (error) {
    return false;
  }
}

export async function getAddressBalance(address: string): Promise<string> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      // Convert wei to ETH
      const balanceInWei = BigInt(data.result);
      const balanceInEth = ethers.formatUnits(balanceInWei, 18);
      return balanceInEth;
    }
    
    return '0';
  } catch (error) {
    console.error('Error getting address balance:', error);
    return '0';
  }
}

export async function getTransactionCount(address: string): Promise<number> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.result) {
      // Convert hex to decimal
      return parseInt(data.result, 16);
    }

    return 0;
  } catch (error) {
    console.error('Error getting transaction count:', error);
    return 0;
  }
}

export async function getContractCode(address: string): Promise<string> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=proxy&action=eth_getCode&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    return data.result;
  } catch (error) {
    console.error('Error getting contract code:', error);
    return '0x';
  }
}

export async function getRecentTransactions(address: string, limit: number = 10): Promise<TransactionInfo[]> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result.slice(0, limit);
    }

    return [];
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    return [];
  }
}

// Helper function to detect suspicious patterns
function detectSuspiciousPatterns(txCount: number, balance: string, isContract: boolean, transactions: TransactionInfo[]): string[] {
  const suspiciousPatterns: string[] = [];
  
  // 1. New wallet with few transactions (potential burner wallet)
  if (txCount < 5) {
    suspiciousPatterns.push('New address with minimal transaction history');
  }
  
  // 2. Contract wallet
  if (isContract) {
    suspiciousPatterns.push('This is a smart contract address, not a regular user wallet');
  }
  
  // 3. Empty or near-empty wallet
  const balanceNum = parseFloat(balance);
  if (balanceNum < 0.01) {
    suspiciousPatterns.push('Low or empty balance (less than 0.01 ETH)');
  }
  
  // 4. Check for repeated transactions to the same address
  if (transactions.length > 1) {
    const destinations = transactions.map(tx => tx.to);
    const uniqueDestinations = new Set(destinations);
    
    if (uniqueDestinations.size === 1 && destinations.length > 2) {
      suspiciousPatterns.push('Multiple transactions to the same destination address');
    }
  }
  
  return suspiciousPatterns;
}

export async function analyzeAddress(address: string): Promise<AddressAnalysis> {
  try {
    // Validate address
    if (!await isValidAddress(address)) {
      return {
        balance: '0',
        txCount: 0,
        isContract: false,
        firstTxDate: null,
        recentTransactions: [],
        suspiciousPatterns: ['Invalid Ethereum address format']
      };
    }

    // Get multiple data points in parallel
    const [balance, txCount, contractCode, recentTransactions] = await Promise.all([
      getAddressBalance(address),
      getTransactionCount(address),
      getContractCode(address),
      getRecentTransactions(address, 5)
    ]);

    const isContract = contractCode !== '0x';
    
    // Determine first transaction date
    let firstTxDate = null;
    if (recentTransactions.length > 0) {
      const oldestTx = [...recentTransactions].sort((a, b) => 
        parseInt(a.timeStamp) - parseInt(b.timeStamp)
      )[0];
      
      if (oldestTx && oldestTx.timeStamp) {
        const date = new Date(parseInt(oldestTx.timeStamp) * 1000);
        firstTxDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
    }
    
    // Detect suspicious patterns
    const suspiciousPatterns = detectSuspiciousPatterns(
      txCount, 
      balance, 
      isContract, 
      recentTransactions
    );

    return {
      balance,
      txCount,
      isContract,
      firstTxDate,
      recentTransactions,
      suspiciousPatterns
    };
  } catch (error) {
    console.error('Error analyzing address:', error);
    return {
      balance: '0',
      txCount: 0,
      isContract: false,
      firstTxDate: null,
      recentTransactions: [],
      suspiciousPatterns: ['Error analyzing address']
    };
  }
}

/**
 * Free tier - Get address name tag if it exists
 */
export async function getAddressLabel(address: string): Promise<AddressLabel> {
  try {
    // Validate address
    if (!await isValidAddress(address)) {
      return { nameTag: '', isVerifiedContract: false };
    }

    // Check if this is a contract first
    const contractCode = await getContractCode(address);
    const isContract = contractCode !== '0x';
    let isVerifiedContract = false;
    let nameTag = '';

    // Define known addresses (hardcoded for demo purposes)
    // In production, this should be replaced with a proper database lookup
    const knownAddresses: Record<string, string> = {
      '0xd8da6bf26964af9d7eed9e03e53415d37aa96045': 'Vitalik Buterin',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH Token Contract',
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2: Router',
      '0x7be8076f4ea4a4ad08075c2508e481d6c946d12b': 'OpenSea: Marketplace',
      '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be': 'Binance: Hot Wallet',
      '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance: Cold Wallet',
      '0xa090e606e30bd747d4e6245a1517ebe430f0057e': 'Binance: Hot Wallet 2'
    };
    
    // Check if the address is in our list of known addresses (case-insensitive)
    const lowerCaseAddress = address.toLowerCase();
    if (knownAddresses[lowerCaseAddress]) {
      nameTag = knownAddresses[lowerCaseAddress];
      return { nameTag, isVerifiedContract };
    }

    // Check contract verification status if it's a contract
    if (isContract) {
      // Use the Etherscan API to check if the contract is verified
      const url = `${ETHERSCAN_API_URL}?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1') {
        isVerifiedContract = true;
        
        // Try to get contract name
        try {
          const sourceUrl = `${ETHERSCAN_API_URL}?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
          const sourceResponse = await fetch(sourceUrl);
          const sourceData = await sourceResponse.json();
          
          if (sourceData.status === '1' && sourceData.result[0]) {
            if (sourceData.result[0].ContractName) {
              nameTag = sourceData.result[0].ContractName;
            }
            
            // Check for proxy implementation
            if (sourceData.result[0].Implementation) {
              nameTag += ` (Proxy for ${sourceData.result[0].Implementation})`;
            }
          }
        } catch (error) {
          console.error('Error getting contract name:', error);
        }
      }
    } else {
      // Check for tokens held by this address to identify potential exchanges or whales
      try {
        const tokenTxUrl = `${ETHERSCAN_API_URL}?module=account&action=tokentx&address=${address}&page=1&offset=5&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
        const tokenTxResponse = await fetch(tokenTxUrl);
        const tokenTxData = await tokenTxResponse.json();
        
        if (tokenTxData.status === '1' && Array.isArray(tokenTxData.result) && tokenTxData.result.length > 0) {
          // Check if the address interacts with any well-known tokens or exchanges
          const uniqueTokens = new Set();
          const uniqueCounterparties = new Set();
          
          tokenTxData.result.forEach((tx: any) => {
            if (tx.tokenSymbol) uniqueTokens.add(tx.tokenSymbol);
            uniqueCounterparties.add(tx.from.toLowerCase() !== address.toLowerCase() ? tx.from : tx.to);
          });
          
          if (uniqueTokens.size > 3) {
            // This might be a whale or exchange if it holds many different token types
            // We'd ideally check balance values too, but keeping it simple for now
          }
        }
      } catch (error) {
        console.error('Error checking token transactions:', error);
      }
      
      // Check normal transactions for high-value exchanges
      try {
        const txUrl = `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&page=1&offset=5&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
        const txResponse = await fetch(txUrl);
        const txData = await txResponse.json();
        
        if (txData.status === '1' && Array.isArray(txData.result) && txData.result.length > 0) {
          // If there are high-value transactions, this could indicate an exchange or whale
          // For now, we're just checking if this looks like active address
        }
      } catch (error) {
        console.error('Error checking normal transactions:', error);
      }
    }

    return { nameTag, isVerifiedContract };
  } catch (error) {
    console.error('Error getting address label:', error);
    return { nameTag: '', isVerifiedContract: false };
  }
}

/**
 * Get token transfers for an address
 */
export async function getTokenTransfers(address: string, limit: number = 10): Promise<TokenTransfer[]> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=account&action=tokentx&address=${address}&page=1&offset=${limit}&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result.slice(0, limit).map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        tokenSymbol: tx.tokenSymbol || 'Unknown',
        tokenName: tx.tokenName || 'Unknown Token',
        value: tx.value,
        timeStamp: tx.timeStamp
      }));
    }

    return [];
  } catch (error) {
    console.error('Error getting token transfers:', error);
    return [];
  }
}

/**
 * Get internal transactions for an address
 */
export async function getInternalTransactions(address: string, limit: number = 10): Promise<TransactionInfo[]> {
  try {
    const url = `${ETHERSCAN_API_URL}?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result.slice(0, limit);
    }

    return [];
  } catch (error) {
    console.error('Error getting internal transactions:', error);
    return [];
  }
}

/**
 * Get contract creation information
 */
export async function getContractCreationInfo(address: string): Promise<ContractInfo | null> {
  try {
    // Check if this is a contract first
    const contractCode = await getContractCode(address);
    if (contractCode === '0x') {
      return null; // Not a contract
    }

    // Get contract creation info
    const url = `${ETHERSCAN_API_URL}?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
      const contractInfo = data.result[0];
      
      // Check contract verification status
      const abiUrl = `${ETHERSCAN_API_URL}?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_API_KEY}`;
      const abiResponse = await fetch(abiUrl);
      const abiData = await abiResponse.json();
      const isVerified = abiData.status === '1';
      
      // Get transaction timestamp
      let creationTimestamp = null;
      if (contractInfo.txHash) {
        try {
          const txUrl = `${ETHERSCAN_API_URL}?module=proxy&action=eth_getTransactionByHash&txhash=${contractInfo.txHash}&apikey=${ETHERSCAN_API_KEY}`;
          const txResponse = await fetch(txUrl);
          const txData = await txResponse.json();
          
          if (txData.result) {
            const blockNumber = parseInt(txData.result.blockNumber, 16);
            const blockUrl = `${ETHERSCAN_API_URL}?module=block&action=getblockreward&blockno=${blockNumber}&apikey=${ETHERSCAN_API_KEY}`;
            const blockResponse = await fetch(blockUrl);
            const blockData = await blockResponse.json();
            
            if (blockData.status === '1' && blockData.result.timeStamp) {
              creationTimestamp = formatTimestamp(blockData.result.timeStamp);
            }
          }
        } catch (error) {
          console.error('Error getting transaction timestamp:', error);
        }
      }

      return {
        isVerified,
        contractCreator: contractInfo.contractCreator || '',
        creationTransaction: contractInfo.txHash || '',
        creationTimestamp
      };
    }

    return {
      isVerified: false,
      contractCreator: 'Unknown',
      creationTransaction: '',
      creationTimestamp: null
    };
  } catch (error) {
    console.error('Error getting contract creation info:', error);
    return null;
  }
}

/**
 * Premium tier - Full on-chain analysis
 */
export async function getOnChainAnalysis(address: string): Promise<OnChainAnalysis> {
  try {
    // Validate address
    if (!await isValidAddress(address)) {
      return {
        nameTag: '',
        balance: '0',
        normalTxCount: 0,
        tokenTxCount: 0,
        internalTxCount: 0,
        isContract: false,
        firstTxTimestamp: null,
        lastTxTimestamp: null,
        contractInfo: null,
        suspiciousPatterns: ['Invalid Ethereum address format']
      };
    }

    // Get basic address label (for both free and premium tiers)
    const addressLabel = await getAddressLabel(address);
    
    // Check if this is a contract
    const contractCode = await getContractCode(address);
    const isContract = contractCode !== '0x';

    // For premium tier, get all the detailed information
    // 1. Get balance
    const balance = await getAddressBalance(address);
    
    // 2. Get normal transactions count
    let normalTxCount = 0;
    try {
      const txListUrl = `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
      const txListResponse = await fetch(txListUrl);
      const txListData = await txListResponse.json();
      
      if (txListData.message === 'OK') {
        normalTxCount = parseInt(txListData.result[0]?.nonce || '0');
      }
    } catch (error) {
      console.error('Error getting normal transaction count:', error);
    }
    
    // 3. Get token transfers count
    let tokenTxCount = 0;
    try {
      const tokenTxUrl = `${ETHERSCAN_API_URL}?module=account&action=tokentx&address=${address}&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
      const tokenTxResponse = await fetch(tokenTxUrl);
      const tokenTxData = await tokenTxResponse.json();
      
      if (tokenTxData.message === 'OK' && Array.isArray(tokenTxData.result)) {
        tokenTxCount = parseInt(tokenTxData.status === '1' ? tokenTxData.result.length : '0');
      }
    } catch (error) {
      console.error('Error getting token transfers count:', error);
    }
    
    // 4. Get internal transactions count
    let internalTxCount = 0;
    try {
      const internalTxUrl = `${ETHERSCAN_API_URL}?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
      const internalTxResponse = await fetch(internalTxUrl);
      const internalTxData = await internalTxResponse.json();
      
      if (internalTxData.message === 'OK' && Array.isArray(internalTxData.result)) {
        internalTxCount = parseInt(internalTxData.status === '1' ? internalTxData.result.length : '0');
      }
    } catch (error) {
      console.error('Error getting internal transactions count:', error);
    }
    
    // 5. Get first and last transaction timestamps
    let firstTxTimestamp = null;
    let lastTxTimestamp = null;
    try {
      // First transaction
      const firstTxUrl = `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${ETHERSCAN_API_KEY}`;
      const firstTxResponse = await fetch(firstTxUrl);
      const firstTxData = await firstTxResponse.json();
      
      if (firstTxData.status === '1' && Array.isArray(firstTxData.result) && firstTxData.result.length > 0) {
        firstTxTimestamp = formatTimestamp(firstTxData.result[0].timeStamp);
      }
      
      // Last transaction
      const lastTxUrl = `${ETHERSCAN_API_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
      const lastTxResponse = await fetch(lastTxUrl);
      const lastTxData = await lastTxResponse.json();
      
      if (lastTxData.status === '1' && Array.isArray(lastTxData.result) && lastTxData.result.length > 0) {
        lastTxTimestamp = formatTimestamp(lastTxData.result[0].timeStamp);
      }
    } catch (error) {
      console.error('Error getting transaction timestamps:', error);
    }
    
    // 6. Get contract creation info if applicable
    const contractInfo = isContract ? await getContractCreationInfo(address) : null;
    
    // 7. Detect suspicious patterns
    const recentTransactions = await getRecentTransactions(address, 5);
    const suspiciousPatterns = detectSuspiciousPatterns(
      normalTxCount, 
      balance, 
      isContract, 
      recentTransactions
    );

    return {
      nameTag: addressLabel.nameTag,
      balance: formatEthValue(BigInt(parseFloat(balance) * 10**18).toString()),
      normalTxCount,
      tokenTxCount,
      internalTxCount,
      isContract,
      firstTxTimestamp,
      lastTxTimestamp,
      contractInfo,
      suspiciousPatterns
    };
  } catch (error) {
    console.error('Error in on-chain analysis:', error);
    return {
      nameTag: '',
      balance: '0',
      normalTxCount: 0,
      tokenTxCount: 0,
      internalTxCount: 0,
      isContract: false,
      firstTxTimestamp: null,
      lastTxTimestamp: null,
      contractInfo: null,
      suspiciousPatterns: ['Error analyzing address']
    };
  }
}

/**
 * Format on-chain analysis results for display
 * This formats the analysis differently based on whether it's for the free or premium tier
 */
export async function getFormattedOnChainAnalysis(address: string, isPremium: boolean = false): Promise<string> {
  try {
    // Check if the address is valid first
    if (!await isValidAddress(address)) {
      return '## Invalid Ethereum Address\nThe address provided does not appear to be a valid Ethereum address format. Please check for typos or formatting issues.';
    }

    // Get label regardless of tier - this is important context even for free tier
    const addressLabel = await getAddressLabel(address);
    
    if (!isPremium) {
      // Free tier - basic information with name tag
      let result = `## ${addressLabel.nameTag ? `Known Address: ${addressLabel.nameTag}` : `Address ${address.slice(0, 6)}...${address.slice(-4)}`}\n\n`;
      
      try {
        // Add basic information that doesn't cost much in API calls
        const contractCode = await getContractCode(address);
        const isContract = contractCode !== '0x';
        
        // Get simple balance
        const balance = await getAddressBalance(address);
        
        result += '### Basic Information\n';
        result += `- **Address**: ${address}\n`;
        result += addressLabel.nameTag ? `- **Identity**: ${addressLabel.nameTag}\n` : '';
        result += `- **Type**: ${isContract ? '🧩 Smart Contract' : '👤 Regular Wallet'}\n`;
        result += `- **Balance**: ${formatEthValue(balance)}\n\n`;
        
        if (isContract) {
          result += `### Contract Information\n`;
          result += `- **Verified**: ${addressLabel.isVerifiedContract ? 'Yes ✓' : 'No ✗'}\n\n`;
          
          if (!addressLabel.isVerifiedContract) {
            result += `> ⚠️ **Security Note**: This contract is not verified on Etherscan. Exercise caution when interacting with unverified contracts.\n\n`;
          }
        }
        
        result += `> 💡 **Tip**: Upgrade to premium for detailed transaction history, activity analysis, and comprehensive risk assessment.\n`;
        
        return result;
      } catch (error) {
        console.error('Error generating free tier analysis:', error);
        if (addressLabel.nameTag) {
          return `## Known Address: ${addressLabel.nameTag}\n\nUnable to retrieve additional on-chain data. However, this appears to be a known address associated with ${addressLabel.nameTag}.`;
        } else {
          return 'Unable to retrieve on-chain data for this address. The Etherscan API may be unavailable or rate-limited.';
        }
      }
    } else {
      // Premium tier - get full analysis
      const analysis = await getOnChainAnalysis(address);
      let result = '';
      
      // Title with identity if known
      if (analysis.nameTag) {
        result += `## Known Address: ${analysis.nameTag}\n\n`;
      } else {
        result += `## Blockchain Analysis: ${address.slice(0, 6)}...${address.slice(-4)}\n\n`;
      }
      
      // Account Summary section
      result += '### Account Summary\n';
      result += `- **Address**: ${address}\n`;
      result += analysis.nameTag ? `- **Identity**: ${analysis.nameTag}\n` : '';
      result += `- **Type**: ${analysis.isContract ? '🧩 Smart Contract' : '👤 Regular Wallet'}\n`;
      result += `- **Balance**: ${formatEthValue(analysis.balance)}\n`;
      result += `- **Normal Transactions**: ${analysis.normalTxCount.toLocaleString()}\n`;
      result += `- **Token Transfers**: ${analysis.tokenTxCount.toLocaleString()}\n`;
      result += `- **Internal Transactions**: ${analysis.internalTxCount.toLocaleString()}\n\n`;
      
      // Activity Range section
      if (analysis.firstTxTimestamp || analysis.lastTxTimestamp) {
        result += '### Activity Timeline\n';
        if (analysis.firstTxTimestamp) {
          result += `- **First Activity**: ${analysis.firstTxTimestamp}\n`;
        }
        if (analysis.lastTxTimestamp) {
          result += `- **Last Activity**: ${analysis.lastTxTimestamp}\n`;
        }
        
        // Calculate account age if both timestamps are available
        if (analysis.firstTxTimestamp && analysis.lastTxTimestamp) {
          const firstDate = new Date(analysis.firstTxTimestamp);
          const lastDate = new Date(analysis.lastTxTimestamp);
          const ageInDays = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (ageInDays > 0) {
            result += `- **Account Age**: ~ ${ageInDays} days\n`;
          }
        }
        
        result += '\n';
      }
      
      // Contract Info section with enhanced verifications
      if (analysis.isContract && analysis.contractInfo) {
        result += '### Contract Information\n';
        result += `- **Verified**: ${analysis.contractInfo.isVerified ? 'Yes ✓' : 'No ✗'}\n`;
        
        if (!analysis.contractInfo.isVerified) {
          result += `> ⚠️ **Security Warning**: This contract is unverified. Exercise extreme caution as you cannot inspect the code.\n\n`;
        }
        
        result += `- **Creator**: ${analysis.contractInfo.contractCreator}\n`;
        
        if (analysis.contractInfo.creationTimestamp) {
          result += `- **Deployed**: ${analysis.contractInfo.creationTimestamp}\n`;
        }
        
        // Add creation transaction hash with Etherscan link
        if (analysis.contractInfo.creationTransaction) {
          const txHash = analysis.contractInfo.creationTransaction;
          result += `- **Creation Tx**: ${txHash.slice(0, 8)}...${txHash.slice(-6)}\n`;
        }
        
        result += '\n';
      }
      
      // Risk Indicators section - enhanced with better formatting
      if (analysis.suspiciousPatterns.length > 0) {
        result += '### Risk Indicators\n';
        analysis.suspiciousPatterns.forEach(pattern => {
          result += `- ⚠️ ${pattern}\n`;
        });
        result += '\n';
      } else if (!analysis.isContract) {
        // Add positive indicators if there are no suspicious patterns for regular wallets
        const txCount = analysis.normalTxCount + analysis.tokenTxCount + analysis.internalTxCount;
        
        if (txCount > 50 && analysis.firstTxTimestamp) {
          // Check if account is at least 30 days old (very rough calculation)
          const firstTxDate = new Date(analysis.firstTxTimestamp);
          const daysSinceFirstTx = Math.round((new Date().getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceFirstTx > 30) {
            result += '### Stability Indicators\n';
            result += `- ✅ This address has a substantial transaction history (${txCount}+ transactions)\n`;
            result += `- ✅ This address has been active for ${daysSinceFirstTx}+ days\n\n`;
          }
        }
      }
      
      return result;
    }
  } catch (error) {
    console.error('Error formatting on-chain analysis:', error);
    return isPremium 
      ? 'Unable to retrieve detailed on-chain data. The Etherscan API may be unavailable or rate-limited. Please try again later.'
      : 'No blockchain data available for this address. The Etherscan API may be unavailable.';
  }
}

// Function to generate comprehensive human-readable analysis for AI context
export async function getAddressAnalysisSummary(address: string): Promise<string> {
  try {
    // Check address validity first
    if (!await isValidAddress(address)) {
      return 'Invalid Ethereum address format.';
    }
    
    // Try to get known address label immediately - this is crucial context
    const addressLabel = await getAddressLabel(address);
    const addressIdentity = addressLabel.nameTag 
      ? `IMPORTANT: This address belongs to ${addressLabel.nameTag}.` 
      : '';
    
    // Get analysis data
    const analysis = await analyzeAddress(address);
    
    let summary = `Address Analysis for ${address}:\n\n`;
    
    // Start with identity if available - this is critical context
    if (addressIdentity) {
      summary += `${addressIdentity}\n\n`;
    }
    
    // Add basic info
    summary += `- Balance: ${formatEthValue(analysis.balance)}\n`;
    summary += `- Transaction Count: ${analysis.txCount.toLocaleString()}\n`;
    summary += `- Type: ${analysis.isContract ? 'Smart Contract' : 'Regular Wallet'}\n`;
    
    if (analysis.firstTxDate) {
      summary += `- First Transaction: ${analysis.firstTxDate}\n`;
      
      // Calculate account age
      const firstTxDate = new Date(analysis.firstTxDate);
      const daysSinceFirstTx = Math.round((new Date().getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));
      summary += `- Account Age: Approximately ${daysSinceFirstTx} days\n`;
    }
    
    // For contracts, add contract-specific data
    if (analysis.isContract) {
      try {
        const contractInfo = await getContractCreationInfo(address);
        
        if (contractInfo) {
          summary += `- Contract Verified: ${contractInfo.isVerified ? 'Yes' : 'No'}\n`;
          summary += `- Contract Creator: ${contractInfo.contractCreator}\n`;
          
          if (contractInfo.creationTimestamp) {
            summary += `- Contract Creation Date: ${contractInfo.creationTimestamp}\n`;
          }
        }
      } catch (error) {
        console.error('Error getting contract info:', error);
      }
    }
    
    // Add suspicious patterns if any
    if (analysis.suspiciousPatterns.length > 0) {
      summary += '\nPotential Risk Indicators:\n';
      analysis.suspiciousPatterns.forEach(pattern => {
        summary += `- ${pattern}\n`;
      });
    }
    
    // Add recent transaction summary if available
    if (analysis.recentTransactions.length > 0) {
      summary += '\nRecent Transaction Summary:\n';
      analysis.recentTransactions.slice(0, 5).forEach((tx, index) => {
        const ethValue = formatEthValue(tx.value);
        const date = new Date(parseInt(tx.timeStamp) * 1000).toLocaleDateString();
        const txType = tx.from.toLowerCase() === address.toLowerCase() ? 'Outgoing' : 'Incoming';
        
        summary += `- ${txType} TX #${index + 1}: ${ethValue} on ${date} `;
        summary += txType === 'Outgoing' 
          ? `to ${tx.to.slice(0, 8)}...${tx.to.slice(-6)}` 
          : `from ${tx.from.slice(0, 8)}...${tx.from.slice(-6)}`;
        
        // Try to add function call info
        if (tx.functionName) {
          summary += ` (Function: ${tx.functionName.split('(')[0]})`;
        }
        
        summary += '\n';
      });
    }
    
    // Check ENS domains or token holdings if not a contract
    if (!analysis.isContract) {
      try {
        // Get token transfers to check what tokens this address holds
        const tokenTransfers = await getTokenTransfers(address, 10);
        
        if (tokenTransfers.length > 0) {
          // Create a map of token symbols and their frequency
          const tokenFrequency: Record<string, number> = {};
          tokenTransfers.forEach(transfer => {
            const symbol = transfer.tokenSymbol || 'Unknown';
            tokenFrequency[symbol] = (tokenFrequency[symbol] || 0) + 1;
          });
          
          // Get tokens sorted by frequency
          const sortedTokens = Object.entries(tokenFrequency)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])
            .slice(0, 5); // Top 5 tokens
            
          if (sortedTokens.length > 0) {
            summary += `\nMost Frequent Tokens: ${sortedTokens.join(', ')}\n`;
          }
        }
      } catch (error) {
        console.error('Error getting token data:', error);
      }
    }
    
    return summary;
  } catch (error) {
    console.error('Error generating address analysis summary:', error);
    return `Unable to analyze address ${address} due to an API error or rate limiting.`;
  }
}