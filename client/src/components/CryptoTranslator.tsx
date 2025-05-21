import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Loader2, MessageSquare, Sparkles, Shield } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { useUsageLimit } from "@/hooks/use-usage-limit";
import { PremiumModal } from "@/components/PremiumModal";
import { BonusPromptModal } from "@/components/BonusPromptModal";
import UsageIndicator from "@/components/UsageIndicator";

interface TranslationResponse {
  term: string;
  explanation: string;
  relatedTerms: string[];
}

interface RecentTerm {
  id: number;
  term: string;
}

interface ConversationEntry {
  id: string;
  term: string;
  explanation: string;
  relatedTerms: string[];
  audienceType: 'beginner' | 'intermediate' | 'expert';
}

export default function CryptoTranslator() {
  // Renamed component to match UI terminology
  const [term, setTerm] = useState("");
  const [audienceType, setAudienceType] = useState<"beginner" | "intermediate" | "expert">("beginner");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [modalLimitReached, setModalLimitReached] = useState(false);
  const { toast } = useToast();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  
  // Get usage limit values from our store
  const hasReachedLimit = useUsageLimit((state) => state.hasReachedLimit());
  const needsBonusPrompts = useUsageLimit((state) => state.needsBonusPrompts());
  const setUserEmail = useUsageLimit((state) => state.setUserEmail);
  const isAdmin = useUsageLimit((state) => state.isAdmin);
  const isPremium = useUsageLimit((state) => state.isPremium);
  const alreadyUsedBonusToday = useUsageLimit((state) => state.alreadyUsedBonusToday);
  const remainingUses = useUsageLimit((state) => state.getRemainingUses());

  // Get recent translations
  const { data: recentTerms } = useQuery<RecentTerm[]>({
    queryKey: ['/api/translate/recent'],
  });

  // Translate term mutation
  const mutation = useMutation<TranslationResponse, Error, { term: string, audienceType: string }>({
    mutationFn: async ({ term, audienceType }) => {
      const res = await apiRequest("POST", "/api/translate", { term, audienceType });
      return res.json();
    },
    onSuccess: (data, variables) => {
      // Add to conversation at the beginning (newest first)
      setConversation((prev) => [
        {
          id: Date.now().toString(),
          term: data.term,
          explanation: data.explanation,
          relatedTerms: data.relatedTerms,
          audienceType: variables.audienceType as 'beginner' | 'intermediate' | 'expert',
        },
        ...prev,
      ]);
      
      // Scroll newly added result into view
      setTimeout(() => {
        const firstCard = document.querySelector('.conversation-container .conversation-card');
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Unable to Translate Term",
        description: "We couldn't generate an explanation at this time. Please try rephrasing or try another term.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    
    // For intermediate or expert audience (premium features)
    if (audienceType === 'intermediate' || audienceType === 'expert') {
      // Premium feature check - only premium or admin users can access advanced explanations
      if (!isPremium && !isAdmin) {
        // Set the modal to show premium feature access
        setModalLimitReached(false);
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
    
    // For all users, check if we've reached the rate limit (including bonus)
    // Admin users bypass all restrictions
    if (!isAdmin && hasReachedLimit) {
      // Set the modal to show daily limit reached
      setModalLimitReached(true);
      setPremiumModalOpen(true);
      return;
    }
    
    // If we get here, proceed with the query
    mutation.mutate({ term, audienceType });
  };
  
  // Handler for successful bonus prompt activation
  const handleBonusActivation = (email: string) => {
    // Save the email to the store
    setUserEmail(email);
    
    // Check if we have a term to translate and proceed with the query
    if (term.trim()) {
      mutation.mutate({ term, audienceType });
    }
    
    // Show success message
    toast({
      title: "Bonus Prompts Activated!",
      description: "You now have 5 additional prompts to use today.",
    });
  };

  const handlePreviousTermClick = (previousTerm: string) => {
    setTerm(previousTerm);
    
    // Admin users bypass all restrictions
    if (!isAdmin && hasReachedLimit) {
      setModalLimitReached(true);
      setPremiumModalOpen(true);
      return;
    }
    
    mutation.mutate({ term: previousTerm, audienceType });
  };

  const handleRelatedTermClick = (relatedTerm: string) => {
    setTerm(relatedTerm);
    
    // Admin users bypass all restrictions
    if (!isAdmin && hasReachedLimit) {
      setModalLimitReached(true);
      setPremiumModalOpen(true);
      return;
    }
    
    mutation.mutate({ term: relatedTerm, audienceType });
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto">
      {/* Premium Modal */}
      <PremiumModal
        open={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
        limitReached={modalLimitReached}
        premiumFeature={audienceType === 'intermediate' || audienceType === 'expert' ? 'blog-subscription' : null}
      />
      
      {/* Bonus Prompt Modal */}
      <BonusPromptModal
        isOpen={bonusModalOpen}
        onClose={() => setBonusModalOpen(false)}
        onSuccess={handleBonusActivation}
        alreadyUsedToday={alreadyUsedBonusToday}
      />
      
      {/* Input Form - Not fixed anymore for better scrolling */}
      <Card className="mb-6 bg-card border-border shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">Crypto Translator</h2>
              {isAdmin && (
                <Badge variant="secondary" className="dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-400 light:bg-blue-100 light:border-blue-300 light:text-blue-600">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin Mode
                </Badge>
              )}
            </div>
            <UsageIndicator />
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="crypto-term" className="block text-foreground font-medium mb-2">
                Enter any crypto term or concept you want to understand:
              </label>
              <Input
                id="crypto-term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Example: What is a smart contract? What does HODL mean?"
                className="w-full px-4 py-3 dark:bg-gray-800 light:bg-gray-100 border-border text-foreground"
              />
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Choose your explanation level:</p>
              <div className="flex gap-3 mb-2">
                <Button
                  type="button"
                  variant={audienceType === "beginner" ? "default" : "outline"}
                  className={`flex-1 ${
                    audienceType === "beginner" 
                      ? "dark:bg-purple-700 dark:hover:bg-purple-600 dark:border-purple-500 light:bg-purple-500 light:hover:bg-purple-400 light:text-white" 
                      : "dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 light:border-gray-300 light:bg-white light:hover:bg-gray-100 light:text-gray-700"
                  }`}
                  onClick={() => setAudienceType("beginner")}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span>Explain Like I'm New</span>
                </Button>
                <Button
                  type="button"
                  variant={audienceType === "expert" ? "default" : "outline"}
                  className={`flex-1 ${
                    audienceType === "expert" 
                      ? "dark:bg-blue-700 dark:hover:bg-blue-600 dark:border-blue-500 light:bg-blue-600 light:hover:bg-blue-500 light:text-white" 
                      : "dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 light:border-gray-300 light:bg-white light:hover:bg-gray-100 light:text-gray-700"
                  }`}
                  onClick={() => setAudienceType("expert")}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Expert Explanation</span>
                </Button>
              </div>
            </div>
            
            <div className="flex">
              <Button
                type="submit"
                className={`flex-1 ${
                  isPremium || isAdmin 
                    ? audienceType === "expert" 
                      ? 'dark:bg-blue-700 dark:hover:bg-blue-600 light:bg-blue-600 light:hover:bg-blue-500 text-white' 
                      : 'dark:bg-purple-700 dark:hover:bg-purple-600 light:bg-purple-600 light:hover:bg-purple-500 text-white'
                    : 'bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white'
                }`}
                disabled={mutation.isPending || !term.trim()}
                // No need for onClick handler as we check usage limits in handleSubmit
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your explanation...
                  </>
                ) : isPremium || isAdmin ? (
                  <>
                    {audienceType === "expert" ? (
                      <BookOpen className="mr-2 h-4 w-4" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    <span>Get {audienceType === "expert" ? "Expert" : ""} Explanation</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Get Explanation</span>
                  </>
                )}
              </Button>
            </div>
            
{/* Removed grey suggestion bubbles per user request */}
          </form>
        </CardContent>
      </Card>
      
      {/* Conversation History */}
      <div className="conversation-container" style={{ scrollMarginTop: "2rem" }}>
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border theme-transition">
            <div className="p-6 rounded-full mb-4 theme-transition">
              <MessageSquare className="h-10 w-10 theme-transition" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-foreground font-sans">Your Crypto Dictionary</h3>
            <p className="max-w-md text-muted-foreground">
              Enter any crypto term or concept above, and we'll explain it in simple language that makes sense. Whether you're new to blockchain or exploring advanced topics, we've got you covered.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {conversation.map((entry) => (
              <Card key={entry.id} className="conversation-card theme-transition">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        <div className={`p-2 rounded-full transition-all ${
                          entry.audienceType === 'intermediate' 
                            ? 'dark:bg-orange-900/30 light:bg-orange-50' 
                            : entry.audienceType === 'expert' 
                              ? 'dark:bg-blue-900/30 light:bg-blue-50' 
                              : 'dark:bg-purple-900/30 light:bg-purple-50'
                        }`}>
                          <BookOpen className={`h-5 w-5 transition-colors ${
                            entry.audienceType === 'intermediate' 
                              ? 'dark:text-orange-400 light:text-orange-500' 
                              : entry.audienceType === 'expert' 
                                ? 'dark:text-blue-400 light:text-blue-600' 
                                : 'dark:text-purple-400 light:text-purple-600'
                          }`} />
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">You asked:</span>
                        <h2 className="text-xl font-semibold text-foreground">{entry.term}</h2>
                      </div>
                    </div>
                    <CopyButton value={entry.explanation} />
                  </div>
                  
                  <div className="explanation-content ml-11 p-4 rounded-lg border transition-all">
                    <p className="mb-0 whitespace-pre-line">
                      {entry.explanation}
                    </p>
                  </div>
                  
{/* Removed related terms bubbles per user request */}
                </CardContent>
              </Card>
            ))}
            <div ref={conversationEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
