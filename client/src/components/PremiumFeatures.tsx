import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUsageLimit } from "@/hooks/use-usage-limit";
import { PremiumModal } from "@/components/PremiumModal";
import { Database, BarChart3, AlertTriangle, Mail, Lock } from "lucide-react";

export default function PremiumFeatures() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<'expert-investigation' | 'wallet-analysis' | 'scam-briefings' | 'blog-subscription' | null>(null);
  // Check if user already has premium status
  const isPremium = useUsageLimit((state) => state.isPremium);
  
  const handleUnlockPremium = () => {
    setSelectedFeature(null);
    setModalOpen(true);
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center justify-center theme-transition
          dark:text-white
          light:text-gray-800">
          <Lock className="mr-2 h-5 w-5 theme-transition
            dark:text-orange-400
            light:text-orange-500" />
          Premium Features
        </h2>
        
        <Card className="overflow-hidden theme-transition
          dark:bg-gray-900 dark:border-gray-800
          light:bg-white light:border-gray-200 light:shadow-card-light">
          <CardContent className="p-8">
            <div className="max-w-md mx-auto">
              <ul className="space-y-6">
                <li className="flex items-center">
                  <div className="flex-shrink-0 p-3 rounded-full mr-4 theme-transition
                    dark:bg-purple-900/30
                    light:bg-purple-100">
                    <Database className="h-6 w-6 theme-transition
                      dark:text-purple-400
                      light:text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold theme-transition
                      dark:text-white
                      light:text-gray-800">Unlimited Usage</h3>
                    <p className="text-sm theme-transition
                      dark:text-gray-400
                      light:text-gray-600">No daily limits - use our translator and scanner as much as you need</p>
                  </div>
                </li>
                
                <li className="flex items-center">
                  <div className="flex-shrink-0 p-3 rounded-full mr-4 theme-transition
                    dark:bg-purple-900/30
                    light:bg-purple-100">
                    <BarChart3 className="h-6 w-6 theme-transition
                      dark:text-purple-400
                      light:text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold theme-transition
                      dark:text-white
                      light:text-gray-800">Deep Blockchain Analysis</h3>
                    <p className="text-sm theme-transition
                      dark:text-gray-400
                      light:text-gray-600">Get detailed reports on wallet addresses with full transaction history checking</p>
                  </div>
                </li>
                
                <li className="flex items-center">
                  <div className="flex-shrink-0 p-3 rounded-full mr-4 theme-transition
                    dark:bg-purple-900/30
                    light:bg-purple-100">
                    <AlertTriangle className="h-6 w-6 theme-transition
                      dark:text-purple-400
                      light:text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold theme-transition
                      dark:text-white
                      light:text-gray-800">Expert Help</h3>
                    <p className="text-sm theme-transition
                      dark:text-gray-400
                      light:text-gray-600">Get personalized help from our security team for complex situations or suspicious activity</p>
                  </div>
                </li>
              </ul>
              
              <div className="mt-8 text-center">
                <Button
                  className="w-full bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700 text-white py-2"
                  onClick={handleUnlockPremium}
                >
                  {isPremium ? 'Manage Premium Account' : 'Unlock Premium Features'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <PremiumModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        premiumFeature={selectedFeature}
      />
    </>
  );
}