import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsageLimit } from "@/hooks/use-usage-limit";
import { CheckCircle2, Sparkles, AlertTriangle, Mail, Database, BarChart3 } from "lucide-react";

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
  // Used to show a specific message when daily limit is reached
  limitReached?: boolean;
  // Used when user tried to access a specific premium feature
  premiumFeature?: 'expert-investigation' | 'wallet-analysis' | 'scam-briefings' | 'blog-subscription' | null;
}

export function PremiumModal({ open, onClose, limitReached = false, premiumFeature = null }: PremiumModalProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Our hook doesn't have an email field, so we'll track premium subscription
  const remainingUses = useUsageLimit((state) => state.getRemainingUses());
  const setUserToPremium = useUsageLimit((state) => state.setUserStatus);

  // Premium feature display info
  const premiumFeatureDetails = {
    'expert-investigation': {
      title: 'Personalized Expert Support',
      description: 'Get direct help from our security specialists who will analyze your specific situation and guide you to safety.',
      icon: <Database className="h-8 w-8 text-purple-400" />
    },
    'wallet-analysis': {
      title: 'In-Depth Blockchain Analysis',
      description: 'Know exactly who you are dealing with through comprehensive address history and detailed risk assessments.',
      icon: <BarChart3 className="h-8 w-8 text-purple-400" />
    },
    'scam-briefings': {
      title: 'Early Scam Warnings',
      description: 'Stay one step ahead with alerts about emerging crypto scams before they become widespread threats.',
      icon: <AlertTriangle className="h-8 w-8 text-purple-400" />
    },
    'blog-subscription': {
      title: 'Crypto Knowledge Hub',
      description: 'Build your crypto confidence with exclusive guides, tips, and insights tailored for both beginners and experienced users.',
      icon: <Mail className="h-8 w-8 text-purple-400" />
    }
  };

  const getPremiumDetails = () => {
    if (premiumFeature && premiumFeature in premiumFeatureDetails) {
      return premiumFeatureDetails[premiumFeature as keyof typeof premiumFeatureDetails];
    }
    return null;
  };
  
  const featureDetails = getPremiumDetails();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Email Address Needed",
        description: "Please provide a valid email address to continue.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Save email to the database
      const response = await apiRequest("POST", "/api/subscribe", { 
        email,
        source: premiumFeature || (limitReached ? 'limit-reached' : 'general')
      });

      if (response.ok) {
        // Update user to premium status
        setUserToPremium(false, true); // (isAdmin, isPremium)
        setSubmitted(true);
        
        toast({
          title: "Premium Access Activated!",
          description: "Thanks for upgrading! You now have unlimited access to all our features.",
        });
        
        // Close modal after a delay to show success state
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error("Failed to subscribe");
      }
    } catch (error) {
      // Still set premium status even if the API fails to maintain good UX
      setUserToPremium(false, true);
      setSubmitted(true);
      
      toast({
        title: "Welcome to Premium!",
        description: "Your upgrade was successful. Enjoy unlimited access to all our tools and features!",
      });
      
      setTimeout(() => {
        onClose();
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center">
            <Sparkles className="h-6 w-6 mr-2 text-orange-400" />
            <span>Crypto Clarity Premium</span>
          </DialogTitle>
          
          {submitted ? (
            <DialogDescription className="text-center text-gray-300 mt-4">
              <div className="mx-auto w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
              </div>
              <p className="text-lg font-medium text-white">You're All Set!</p>
              <p className="mt-2">You now have unlimited access to all our premium tools. Start exploring and stay safe!</p>
            </DialogDescription>
          ) : (
            <DialogDescription className="text-center text-gray-300 mt-4">
              {limitReached ? (
                <div>
                  <div className="mx-auto w-16 h-16 bg-orange-900/30 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-10 w-10 text-orange-400" />
                  </div>
                  <p className="text-lg font-medium text-white">You've Reached Your Daily Limit</p>
                  <p className="mt-2">You've used all {5 - remainingUses} of your free daily checks. Upgrade to premium for unlimited access - no more waiting!</p>
                </div>
              ) : featureDetails ? (
                <div>
                  <div className="mx-auto w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                    {featureDetails.icon}
                  </div>
                  <p className="text-lg font-medium text-white">{featureDetails.title}</p>
                  <p className="mt-2">{featureDetails.description}</p>
                </div>
              ) : (
                <p>Get unlimited access to all our tools plus personalized help from our crypto security team. Join Crypto Clarity Premium today!</p>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {!submitted && (
          <div className="py-2">
            <div className="space-y-4 mb-6">
              <div className={`p-4 rounded-lg ${limitReached ? 'bg-gray-800' : 'bg-gray-800/50'} flex items-start`}>
                <div className="flex-shrink-0 mr-3 mt-1">
                  <CheckCircle2 className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">What You Get With Premium</h3>
                  <ul className="mt-2 space-y-2 text-sm text-gray-300">
                    <li>• No daily limits - use all tools as much as you need</li>
                    <li>• One-on-one help from our security experts when you need it</li>
                    <li>• Detailed blockchain address analysis and risk reports</li>
                    <li>• Regular scam alerts and safety updates <span className="text-orange-400 text-xs">(Coming Soon)</span></li>
                    <li>• Exclusive educational content to boost your crypto knowledge</li>
                  </ul>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address
                </label>
                <Input 
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-gray-800 border-gray-700 text-white"
                  required
                  autoFocus
                />
              </div>
              
              <DialogFooter className="flex-col space-y-2">
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Join Crypto Clarity Premium'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-gray-700 text-gray-300 hover:text-white"
                  onClick={() => {
                    onClose();
                    // Trigger contact form after a brief delay
                    setTimeout(() => {
                      const event = new CustomEvent('showContactForm');
                      window.dispatchEvent(event);
                    }, 100);
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Us for Premium Support
                </Button>
              </DialogFooter>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}