import { useState } from "react";
import { useUsageLimit } from "@/hooks/use-usage-limit";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BonusPromptModal } from "./BonusPromptModal";
import { Mail } from "lucide-react";

export default function UsageIndicator() {
  // Get usage data from our global store
  const usageCount = useUsageLimit((state) => state.usageCount);
  const usageLimit = useUsageLimit((state) => state.usageLimit);
  const isAdmin = useUsageLimit((state) => state.isAdmin);
  const isPremium = useUsageLimit((state) => state.isPremium);
  const hasBonusPrompts = useUsageLimit((state) => state.hasBonusPrompts);
  const bonusPromptsRemaining = useUsageLimit((state) => state.bonusPromptsRemaining);
  const alreadyUsedBonusToday = useUsageLimit((state) => state.alreadyUsedBonusToday);
  const userEmail = useUsageLimit((state) => state.userEmail);
  const setUserEmail = useUsageLimit((state) => state.setUserEmail);
  
  // Get the remaining counts from the hook
  const baseRemaining = useUsageLimit((state) => state.getRemainingUses());
  const totalRemaining = useUsageLimit((state) => state.getTotalRemainingUses());
  const needsBonusPrompts = useUsageLimit((state) => state.needsBonusPrompts());
  const resetTime = useUsageLimit((state) => state.getResetTime());
  
  // State for the bonus prompt modal
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  
  // Function to handle successful bonus prompt activation
  const handleBonusSuccess = (email: string) => {
    setUserEmail(email);
  };
  
  // Calculate percentage used for the progress bar
  // For users with bonus prompts, we'll show a composite progress bar
  let percentUsed = Math.min(100, Math.round((usageCount / usageLimit) * 100));
  
  // For admins, we show a special indicator
  if (isAdmin) {
    return (
      <div className="flex flex-col space-y-2 p-4 bg-accent/10 rounded-md">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Admin Access</span>
          <Badge variant="default" className="bg-blue-600">Unlimited</Badge>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col space-y-2 p-4 bg-accent/10 rounded-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {isPremium ? 'Premium Tier Usage' : 'Free Tier Usage'}
        </span>
        <Badge 
          variant={isPremium ? "default" : "outline"} 
          className={isPremium ? 'bg-purple-600' : ''}
        >
          {isPremium ? 'Premium' : 'Free'}
        </Badge>
      </div>

      <Progress value={percentUsed} className="h-2" />
      
      <div className="flex items-center justify-between text-sm">
        <span className={totalRemaining < 3 ? 'text-red-500 font-medium' : ''}>
          {hasBonusPrompts 
            ? `${baseRemaining} + ${bonusPromptsRemaining} bonus prompts`
            : `${baseRemaining} of ${usageLimit} free prompts`
          }
        </span>
        <span className="text-muted-foreground text-xs">
          Resets at {resetTime}
        </span>
      </div>
      
      {/* Show different messages based on user state */}
      {!isPremium && (
        <div className="text-xs text-accent-foreground mt-1">
          {needsBonusPrompts ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={() => setIsBonusModalOpen(true)}
            >
              <Mail className="h-3 w-3 mr-1" />
              Get 5 bonus prompts with email
            </Button>
          ) : hasBonusPrompts ? (
            <div className="text-emerald-600 font-medium">
              Bonus prompts activated! {bonusPromptsRemaining} remaining today.
            </div>
          ) : alreadyUsedBonusToday ? (
            <div>
              <span className="font-semibold">Want more?</span> Upgrade to premium for 1000 daily requests.
            </div>
          ) : usageCount > (usageLimit / 2) ? (
            <div>
              <span className="font-semibold">Running low?</span> Get 5 bonus prompts with email or upgrade to premium.
            </div>
          ) : null}
        </div>
      )}
      
      {/* Bonus prompt modal */}
      <BonusPromptModal 
        isOpen={isBonusModalOpen}
        onClose={() => setIsBonusModalOpen(false)}
        onSuccess={handleBonusSuccess}
        alreadyUsedToday={alreadyUsedBonusToday}
      />
    </div>
  );
}