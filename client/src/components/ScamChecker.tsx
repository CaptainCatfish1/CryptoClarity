import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchCode, Loader2, AlertTriangle, CheckCircle2, Flag, Shield, Database } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { useUsageLimit } from "@/hooks/use-usage-limit";
import { PremiumModal } from "@/components/PremiumModal";
import { BonusPromptModal } from "@/components/BonusPromptModal";
import UsageIndicator from "@/components/UsageIndicator";

interface ScamResponse {
  riskLevel: string;
  summary: string;
  redFlags: string[];
  safetyTips: string[];
  addressAnalysis?: string;
  onChainData?: string;
}

interface ScamResult {
  id: string;
  scenario: string;
  suspiciousAddress?: string;
  userAddress?: string;
  extractedAddresses?: string[]; // Addresses automatically extracted from the scenario
  result: ScamResponse;
  scanType: 'basic' | 'advanced';
}

// We've removed the example bubbles as requested
const EXAMPLE_SCENARIOS = {
  "WhatsApp Investment Offer": "Someone messaged me on WhatsApp saying they're a crypto expert and can help me make 10-15% daily returns if I invest with them. They asked me to send Bitcoin to their wallet to get started.",
  "Free Token Airdrop": "I got an email saying I was selected for a special NFT airdrop. They asked me to connect my wallet to their website and approve a transaction to claim my free tokens.",
  "Crypto Mining App": "I found an app that claims I can mine Bitcoin directly from my phone. It shows I'm earning 0.01 BTC daily but says I need to pay a small fee to withdraw my earnings."
};

// Helper function to extract Ethereum addresses from text
function extractEthereumAddresses(text: string): string[] {
  // Ethereum address regex pattern
  const ethereumAddressPattern = /0x[a-fA-F0-9]{40}/g;
  const matches = text.match(ethereumAddressPattern);
  
  // Return unique addresses only
  if (!matches) return [];
  
  // Using Array.from to convert Set to array to avoid downlevelIteration flag requirement
  return Array.from(new Set(matches));
}

export default function ScamChecker() {
  // This component is now known as "Clarity Scan" instead of "Scam Checker"
  const [scenario, setScenario] = useState("");
  const [suspiciousAddress, setSuspiciousAddress] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [scanType, setScanType] = useState<'basic' | 'advanced'>('basic');
  const [scamResults, setScamResults] = useState<ScamResult[]>([]);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [modalLimitReached, setModalLimitReached] = useState(false);
  const [modalPremiumFeature, setModalPremiumFeature] = useState<'expert-investigation' | 'wallet-analysis' | null>(null);
  const { toast } = useToast();
  const resultsEndRef = useRef<HTMLDivElement>(null);
  
  // Get usage limit values from our store
  const hasReachedLimit = useUsageLimit((state) => state.hasReachedLimit());
  const needsBonusPrompts = useUsageLimit((state) => state.needsBonusPrompts());
  const setUserEmail = useUsageLimit((state) => state.setUserEmail);
  const isAdmin = useUsageLimit((state) => state.isAdmin);
  const isPremium = useUsageLimit((state) => state.isPremium);
  const alreadyUsedBonusToday = useUsageLimit((state) => state.alreadyUsedBonusToday);

  // Check scam mutation
  const mutation = useMutation<ScamResponse, Error, { 
    scenario: string, 
    suspiciousAddress?: string, 
    userAddress?: string, 
    extractedAddresses?: string[],
    scanType: 'basic' | 'advanced' 
  }>({
    mutationFn: async ({ scenario, suspiciousAddress, userAddress, extractedAddresses, scanType }) => {
      const res = await apiRequest("POST", "/api/check-scam", { 
        scenario, 
        suspiciousAddress, 
        userAddress, 
        extractedAddresses,
        scanType 
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Add to scam results at the beginning (newest first)
      setScamResults((prev) => [
        {
          id: Date.now().toString(),
          scenario: variables.scenario,
          suspiciousAddress: variables.suspiciousAddress,
          userAddress: variables.userAddress,
          extractedAddresses: variables.extractedAddresses,
          result: data,
          scanType: variables.scanType,
        },
        ...prev,
      ]);
      
      // Scroll newly added results into view
      setTimeout(() => {
        const firstResult = document.querySelector('.results-container .shadow');
        if (firstResult) {
          firstResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Scan Could Not Be Completed",
        description: "We encountered a problem analyzing your request. Please try again or modify your description with more details.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent, selectedScanType: 'basic' | 'advanced' = 'basic') => {
    e.preventDefault();
    
    // Extract any addresses from the scenario text
    const extractedAddresses = extractEthereumAddresses(scenario);
    
    // Allow submission if either scenario or any address is provided
    const hasScenario = scenario.trim().length > 0;
    const hasSuspiciousAddress = suspiciousAddress.trim().length > 0;
    const hasUserAddress = userAddress.trim().length > 0;
    
    // Ensure at least one field has content
    if (!hasScenario && !hasSuspiciousAddress && !hasUserAddress && extractedAddresses.length === 0) {
      toast({
        title: "We Need More Information",
        description: "Please provide either a description of your concern or an Ethereum address to analyze.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if we're doing an advanced scan (premium feature)
    if (selectedScanType === 'advanced') {
      // Premium feature check - only premium or admin users can access advanced scan
      if (!isPremium && !isAdmin) {
        // Set the modal to show premium feature access
        setModalLimitReached(false);
        setModalPremiumFeature('wallet-analysis');
        setPremiumModalOpen(true);
        return;
      }
    }
    
    // Check if user has reached their limit and needs to activate bonus prompts
    if (!isAdmin && !isPremium && needsBonusPrompts) {
      // Show the bonus prompt activation modal
      setBonusModalOpen(true);
      return;
    }
    
    // For all requests, check if we've reached the rate limit (including bonus)
    // Admin users bypass all restrictions
    if (!isAdmin && hasReachedLimit) {
      // Set the modal to show daily limit reached
      setModalLimitReached(true);
      setModalPremiumFeature(null);
      setPremiumModalOpen(true);
      return;
    }
    
    setScanType(selectedScanType);
    
    mutation.mutate({ 
      scenario, 
      suspiciousAddress: suspiciousAddress.trim() ? suspiciousAddress : undefined,
      userAddress: userAddress.trim() ? userAddress : undefined,
      extractedAddresses: extractedAddresses.length > 0 ? extractedAddresses : undefined,
      scanType: selectedScanType
    });
  };

  // Updated to use our custom risk level classes that support both light/dark modes
  // Handler for successful bonus prompt activation
  const handleBonusActivation = (email: string) => {
    // Save the email to the store
    setUserEmail(email);
    
    // Show success message
    toast({
      title: "Bonus Prompts Activated!",
      description: "You now have 5 additional prompts to use today.",
    });
    
    // Continue with the request if we have scenario or addresses
    const hasScenario = scenario.trim().length > 0;
    const hasSuspiciousAddress = suspiciousAddress.trim().length > 0;
    const hasUserAddress = userAddress.trim().length > 0;
    const extractedAddresses = extractEthereumAddresses(scenario);
    
    if (hasScenario || hasSuspiciousAddress || hasUserAddress || extractedAddresses.length > 0) {
      // Default to basic scan (premium users would have been handled earlier)
      setScanType('basic');
      
      mutation.mutate({ 
        scenario, 
        suspiciousAddress: suspiciousAddress.trim() ? suspiciousAddress : undefined,
        userAddress: userAddress.trim() ? userAddress : undefined,
        extractedAddresses: extractedAddresses.length > 0 ? extractedAddresses : undefined,
        scanType: 'basic'
      });
    }
  };

  const getRiskLevelClass = (riskLevel: string) => {
    const level = riskLevel.toLowerCase();
    if (level.includes('high')) return 'risk-high';
    if (level.includes('medium')) return 'risk-medium';
    if (level.includes('low')) return 'risk-low';
    return 'bg-gray-800 text-gray-200 dark:bg-gray-800 dark:text-gray-200 light:bg-gray-100 light:text-gray-800';
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto">
      {/* Premium Modal */}
      <PremiumModal
        open={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        limitReached={modalLimitReached}
        premiumFeature={modalPremiumFeature}
      />
      
      {/* Bonus Prompt Modal */}
      <BonusPromptModal
        isOpen={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
        onSuccess={handleBonusActivation}
        alreadyUsedToday={alreadyUsedBonusToday}
      />
      
      {/* Input Form - Not fixed anymore for better scrolling */}
      <Card className="mb-6 shadow-lg theme-transition
        dark:bg-gray-900 dark:border-gray-800
        light:bg-white light:border-gray-200">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold theme-transition
                dark:text-white
                light:text-gray-800">Clarity Scan™</h2>
              <div className="text-sm hidden sm:block ml-2 theme-transition
                dark:text-gray-400
                light:text-gray-600">
                Analyze risks and verify blockchain activity
              </div>
              {isAdmin && (
                <Badge variant="secondary" className="theme-transition
                  dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-400
                  light:bg-blue-100 light:border-blue-300 light:text-blue-700">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin Mode
                </Badge>
              )}
            </div>
            <UsageIndicator />
          </div>
          
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="mb-4">
              <label htmlFor="scam-scenario" className="block font-medium mb-2 theme-transition
                dark:text-gray-300
                light:text-gray-700">
                Tell us about the suspicious situation:
              </label>
              <Textarea
                id="scam-scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="Describe your situation, e.g., 'I received an email about free tokens' or 'I'm not sure if this website is legitimate'..."
                rows={3}
                className="w-full px-4 py-3 theme-transition
                  dark:bg-gray-800 dark:border-gray-700 dark:text-white
                  light:bg-gray-50 light:border-gray-200 light:text-gray-900"
              />
              <p className="text-xs mt-1 theme-transition
                dark:text-gray-500
                light:text-gray-500">
                Pro tip: Include Ethereum addresses in your description for more detailed analysis. Our system will automatically detect them.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label htmlFor="suspicious-address" className="block font-medium mb-2 theme-transition
                  dark:text-gray-300
                  light:text-gray-700">
                  Wallet Address to Check (optional)
                </label>
                <Input
                  id="suspicious-address"
                  value={suspiciousAddress}
                  onChange={(e) => setSuspiciousAddress(e.target.value)}
                  placeholder="Enter an Ethereum address to analyze..."
                  className="w-full px-4 py-3 theme-transition
                    dark:bg-gray-800 dark:border-gray-700 dark:text-white
                    light:bg-gray-50 light:border-gray-200 light:text-gray-900"
                />
              </div>
              
              <div>
                <label htmlFor="user-address" className="block font-medium mb-2 theme-transition
                  dark:text-gray-300
                  light:text-gray-700">
                  Your Wallet Address (optional)
                </label>
                <Input
                  id="user-address"
                  value={userAddress}
                  onChange={(e) => setUserAddress(e.target.value)}
                  placeholder="Enter your own wallet address if relevant..."
                  className="w-full px-4 py-3 theme-transition
                    dark:bg-gray-800 dark:border-gray-700 dark:text-white
                    light:bg-gray-50 light:border-gray-200 light:text-gray-900"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                className={`flex-1 theme-transition
                  ${scanType === 'basic' ? 
                    'dark:bg-blue-700 dark:hover:bg-blue-600 light:bg-blue-600 light:hover:bg-blue-700' : 
                    'dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 light:bg-gray-100 light:hover:bg-gray-200 light:text-gray-700'
                  }`}
                onClick={(e) => handleSubmit(e, 'basic')}
                disabled={mutation.isPending}
              >
                {mutation.isPending && scanType === 'basic' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <SearchCode className="mr-2 h-4 w-4" />
                    Check for Risks
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                className={`flex-1 theme-transition
                  ${scanType === 'advanced' ? 
                    'dark:bg-purple-700 dark:hover:bg-purple-600 light:bg-purple-600 light:hover:bg-purple-700' : 
                    'dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 light:bg-gray-100 light:hover:bg-gray-200 light:text-gray-700'
                  }`}
                onClick={(e) => handleSubmit(e, 'advanced')}
                disabled={mutation.isPending}
              >
                {mutation.isPending && scanType === 'advanced' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Deep Scan...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    <span className="flex items-center">
                      Full Scan
                      <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">Premium</span>
                    </span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Results History */}
      <div className="results-container" style={{ scrollMarginTop: "2rem" }}>
        {scamResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border theme-transition
            dark:text-gray-300 dark:bg-gray-900/30 dark:border-gray-800
            light:text-gray-700 light:bg-gray-50/70 light:border-gray-200">
            <div className="p-6 rounded-full mb-4 theme-transition
              dark:bg-gray-800/80
              light:bg-white light:shadow-card-light">
              <SearchCode className="h-10 w-10 theme-transition
                dark:text-blue-400
                light:text-blue-600" />
            </div>
            <h3 className="text-lg font-medium mb-2 theme-transition">Stay Safe in the Crypto World</h3>
            <p className="max-w-md theme-transition">
              Describe a situation that concerns you or enter a wallet address. We'll analyze the risks and provide safety tips tailored to your needs.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {scamResults.map((result) => (
              <Card key={result.id} className="shadow theme-transition
                dark:bg-gray-900 dark:border-gray-800
                light:bg-white light:border-gray-200">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        <div className={`p-2 rounded-full theme-transition
                          ${result.scanType === 'advanced' ? 
                            'dark:bg-purple-900/30 light:bg-purple-100' : 
                            'dark:bg-blue-900/30 light:bg-blue-100'}`}>
                          <SearchCode className={`h-5 w-5 theme-transition
                            ${result.scanType === 'advanced' ? 
                              'dark:text-orange-400 light:text-orange-500' : 
                              'dark:text-blue-400 light:text-blue-600'}`} />
                        </div>
                      </div>
                      <h2 className="text-xl font-semibold theme-transition
                        dark:text-white
                        light:text-gray-800">Clarity Scan Analysis</h2>
                    </div>
                    <span className={`px-3 py-1 font-medium rounded-full text-sm risk-${result.result.riskLevel.toLowerCase().includes('high') ? 'high' : result.result.riskLevel.toLowerCase().includes('medium') ? 'medium' : 'low'}`}>
                      {result.result.riskLevel}
                    </span>
                  </div>
                  
                  <div className="mb-4 p-4 rounded-lg ml-11 theme-transition
                    dark:bg-gray-800 dark:border-gray-700
                    light:bg-gray-50 light:border light:border-gray-200">
                    <h3 className="text-sm mb-2 theme-transition
                      dark:text-gray-300
                      light:text-gray-600">You asked about:</h3>
                    <p className="text-sm theme-transition
                      dark:text-white
                      light:text-gray-800">{result.scenario}</p>
                    
                    {(result.suspiciousAddress || result.userAddress || (result.extractedAddresses && result.extractedAddresses.length > 0)) && (
                      <div className="mt-2 pt-2 border-t theme-transition
                        dark:border-gray-700
                        light:border-gray-300">
                        {result.suspiciousAddress && (
                          <p className="text-sm mt-1 theme-transition
                            dark:text-gray-300
                            light:text-gray-600">Address to Check: <span className="theme-transition
                            dark:text-amber-400
                            light:text-amber-600">{result.suspiciousAddress}</span></p>
                        )}
                        {result.userAddress && (
                          <p className="text-sm mt-1 theme-transition
                            dark:text-gray-300
                            light:text-gray-600">Your Wallet: <span className="theme-transition
                            dark:text-blue-400
                            light:text-blue-600">{result.userAddress}</span></p>
                        )}
                        {result.extractedAddresses && result.extractedAddresses.length > 0 && (
                          <div className="mt-1">
                            <p className="text-sm theme-transition
                              dark:text-gray-300
                              light:text-gray-600">Detected Addresses:</p>
                            <div className="pl-4">
                              {result.extractedAddresses.map((addr, idx) => (
                                <p key={idx} className="text-sm"><span className="theme-transition
                                  dark:text-purple-400
                                  light:text-purple-600">{addr}</span></p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-6 ml-11">
                    <h3 className="font-medium mb-2 theme-transition
                      dark:text-white
                      light:text-gray-800">What We Found</h3>
                    <p className="theme-transition
                      dark:text-gray-300
                      light:text-gray-600">{result.result.summary}</p>
                  </div>
                  
                  {result.result.redFlags && result.result.redFlags.length > 0 && (
                    <div className="mb-6 p-4 rounded-lg ml-11 theme-transition
                      dark:bg-red-900/30 
                      light:bg-red-50">
                      <h3 className="font-medium mb-3 theme-transition
                        dark:text-red-400
                        light:text-red-600">Warning Signs We Found</h3>
                      <ul className="space-y-2">
                        {result.result.redFlags.map((flag, index) => (
                          <li key={index} className="flex items-start">
                            <AlertTriangle className="mt-1 mr-2 h-4 w-4 flex-shrink-0 theme-transition
                              dark:text-red-400
                              light:text-red-500" />
                            <span className="theme-transition
                              dark:text-gray-300
                              light:text-gray-700">{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {result.result.safetyTips && result.result.safetyTips.length > 0 && (
                    <div className="mb-6 ml-11">
                      <h3 className="font-medium mb-2 theme-transition
                        dark:text-blue-400
                        light:text-blue-600">How to Stay Safe</h3>
                      <ul className="space-y-2">
                        {result.result.safetyTips.map((tip, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle2 className="mt-1 mr-2 h-4 w-4 flex-shrink-0 theme-transition
                              dark:text-blue-400
                              light:text-blue-500" />
                            <span className="theme-transition
                              dark:text-gray-300
                              light:text-gray-700">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* On-Chain Data - Enhanced Etherscan integration with improved styling */}
                  {result.result.onChainData && (
                    <div className="mb-6 ml-11">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium flex items-center theme-transition
                          dark:text-blue-500
                          light:text-blue-600">
                          Blockchain Analysis
                          {result.scanType === 'advanced' && (
                            <span className="ml-2 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">Premium</span>
                          )}
                        </h3>
                        <CopyButton value={result.result.onChainData} />
                      </div>
                      
                      {/* Enhanced styling for Etherscan data with tables */}
                      <div className="text-sm overflow-hidden markdown-content theme-transition
                        dark:text-gray-300
                        light:text-gray-700">
                        <div 
                          className="blockchain-data-container"
                          dangerouslySetInnerHTML={{ 
                            __html: result.result.onChainData
                              // Format section headers - Light/Dark mode supported via .markdown-content CSS
                              .replace(/^##\s(.*)$/gm, '<h2 class="text-lg font-medium mb-3 mt-5 border-b pb-2">$1</h2>')
                              
                              // Format sub-section headers
                              .replace(/^###\s(.*)$/gm, '<h3 class="text-md font-medium mt-4 mb-2">$1</h3>')
                              
                              // Format data rows as table rows
                              .replace(/^\-\s\*\*([^:]*)\*\*:\s(.*)$/gm, 
                                `<div class="data-item border-b py-1.5 hover:bg-opacity-10">
                                  <div class="data-label font-medium">$1:</div>
                                  <div class="data-value">$2</div>
                                </div>`)
                              
                              // Format warning items
                              .replace(/^\-\s⚠️\s(.*)$/gm, 
                                `<div class="flex items-start mt-2 py-1.5 px-3 rounded
                                  dark:bg-yellow-900/20 dark:border-l-2 dark:border-yellow-600 
                                  light:bg-yellow-50 light:border-l-2 light:border-yellow-500">
                                  <span class="mr-2 mt-0.5 
                                    dark:text-yellow-500
                                    light:text-yellow-600">⚠️</span>
                                  <span>$1</span>
                                </div>`)
                              
                              // Format regular items in lists
                              .replace(/^\-\s([^⚠️].*)$/gm, 
                                `<div class="flex items-start py-1.5">
                                  <span class="mr-2 
                                    dark:text-gray-500
                                    light:text-gray-400">•</span>
                                  <span>$1</span>
                                </div>`)
                              
                              // Handle regular paragraph breaks
                              .replace(/\n\n/g, '<div class="py-1"></div>')
                              
                              // Handle line breaks within the same paragraph
                              .replace(/\n(?!<)/g, '<br>')
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Legacy address analysis (keeping for backward compatibility, but with improved styling) */}
                  {result.result.addressAnalysis && !result.result.onChainData && (
                    <div className="mb-6 ml-11">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium flex items-center theme-transition
                          dark:text-purple-400
                          light:text-purple-600">
                          Blockchain Analysis 
                          <span className="ml-2 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">Premium</span>
                        </h3>
                        <CopyButton value={result.result.addressAnalysis} />
                      </div>
                      
                      <div className="rounded-lg p-4 border overflow-x-auto theme-transition
                        dark:bg-gray-800/50 dark:border-gray-700
                        light:bg-gray-50 light:border-gray-200">
                        <pre className="text-sm font-sans whitespace-pre-wrap theme-transition
                          dark:text-gray-300
                          light:text-gray-700">{result.result.addressAnalysis}</pre>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row gap-3 mt-6 ml-11 pt-4 theme-transition
                    dark:border-t dark:border-gray-800
                    light:border-t light:border-gray-200">
                    <Button
                      variant="outline"
                      className="flex-1 theme-transition
                        dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20
                        light:border-purple-300 light:text-purple-700 light:hover:bg-purple-50"
                      onClick={() => {
                        toast({
                          title: "Thank you for helping the community!",
                          description: "This information has been added to our scam database to protect others.",
                        });
                      }}
                    >
                      <Flag className="mr-2 h-4 w-4" /> Report Suspicious Activity
                    </Button>
                    
                    <Button
                      variant="outline"
                      className="flex-1 theme-transition
                        dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20
                        light:border-blue-300 light:text-blue-700 light:hover:bg-blue-50"
                      onClick={async () => {
                        // Check if user has premium access or is admin
                        if (!isPremium && !isAdmin) {
                          // Show premium modal for expert investigation
                          setModalLimitReached(false);
                          setModalPremiumFeature('expert-investigation');
                          setPremiumModalOpen(true);
                          return;
                        }
                        
                        // Check for rate limits (even premium users have limits)
                        if (!isAdmin && hasReachedLimit) {
                          // Show rate limit modal
                          setModalLimitReached(true);
                          setModalPremiumFeature(null);
                          setPremiumModalOpen(true);
                          return;
                        }
                        
                        try {
                          // Submit the expert request to the API
                          const response = await apiRequest("POST", "/api/request-expert", {
                            scenario: result.scenario,
                            suspiciousAddress: result.suspiciousAddress || "",
                            userAddress: result.userAddress || "",
                            extractedAddresses: result.extractedAddresses || [],
                            notes: "Submitted from Clarity Scan result"
                          });
                          
                          if (response.ok) {
                            toast({
                              title: "We're on it!",
                              description: "Your case has been assigned to our experts. They'll analyze the details and get back to you soon.",
                            });
                          } else {
                            throw new Error("Failed to submit request");
                          }
                        } catch (error) {
                          toast({
                            title: "Something went wrong",
                            description: "We couldn't process your request. Please try again in a moment.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <Database className="mr-2 h-4 w-4" /> 
                      <span className="flex items-center">
                        Get Expert Help
                        <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">Premium</span>
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <div ref={resultsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
