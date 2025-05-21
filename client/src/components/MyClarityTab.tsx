import { Shield, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PremiumFeatures from "@/components/PremiumFeatures";
import UsageIndicator from "@/components/UsageIndicator";

export default function MyClarityTab() {
  return (
    <div className="flex flex-col items-center space-y-12 mt-8 mb-16">
      {/* Hero Section */}
      <div className="text-center max-w-3xl">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight gradient-purple-blue mb-6 font-orbitron crypto-heading">
          Crypto Clarity Starts Here.
          <br />
          <span className="text-xl md:text-2xl lg:text-3xl dark:text-gray-300 light:text-gray-600 font-normal mt-2 block theme-transition">
            Expert support for a safer blockchain journey.
          </span>
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <FeatureCard 
            icon={<Shield className="h-8 w-8 text-purple-600" />}
            title="Crypto Terms Made Simple"
            description="Understand any crypto term with plain English explanations tailored to your experience level"
          />
          
          <FeatureCard 
            icon={<Search className="h-8 w-8 text-blue-500" />}
            title="Scam Protection"
            description="Verify addresses and check suspicious situations before risking your money"
          />
          
          <FeatureCard 
            icon={<Users className="h-8 w-8 text-orange-500" />}
            title="Expert Support"
            description="Get help from real people who understand blockchain security when you need it most"
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="w-full max-w-4xl">
        <Card className="theme-transition
          dark:bg-gray-900 dark:border-gray-800
          light:bg-white light:border-gray-200 light:shadow-card-light">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold mb-4 theme-transition
                dark:text-white
                light:text-gray-800">Your Path to Crypto Understanding</h2>
              <p className="mb-8 max-w-2xl theme-transition
                dark:text-gray-300
                light:text-gray-600">
                We've built these easy-to-use tools to help you feel confident with cryptocurrency, even if you're just getting started.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                <StepCard 
                  number="01"
                  title="Understand Crypto Terms"
                  description="Get simple explanations for any crypto terms or concepts you encounter"
                  action={() => {
                    const event = new CustomEvent('tabChange', { detail: 'cryptoClarity' });
                    window.dispatchEvent(event);
                  }}
                  actionText="Try the Translator"
                />
                
                <StepCard 
                  number="02"
                  title="Check for Scams"
                  description="Find out if a situation or wallet address might be risky before you send money"
                  action={() => {
                    const event = new CustomEvent('tabChange', { detail: 'clarityScan' });
                    window.dispatchEvent(event);
                  }}
                  actionText="Scan for Risks"
                />
                
                <StepCard 
                  number="03"
                  title={<span className="flex items-center">Talk to an Expert <span className="ml-1.5 bg-orange-600 text-white text-xs px-1 py-0.5 rounded-full">Premium</span></span>}
                  description="Get personalized help from our team when you need additional guidance"
                  action={() => {
                    // Show contact form via event
                    const event = new CustomEvent('showContactForm');
                    window.dispatchEvent(event);
                  }}
                  actionText="Contact Us"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Usage Status */}
      <div className="w-full max-w-4xl flex justify-end">
        <div className="mb-4">
          <UsageIndicator />
        </div>
      </div>
      
      {/* Premium Features Section */}
      <div className="w-full max-w-4xl">
        <PremiumFeatures />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: React.ReactNode, description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border theme-transition
      dark:bg-gray-900/50 dark:border-gray-800
      light:bg-white light:border-gray-200 light:shadow-card-light">
      <div className="mb-4 p-3 rounded-full theme-transition
        dark:bg-gray-800
        light:bg-gray-50">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 theme-transition
        dark:text-white
        light:text-gray-800">{title}</h3>
      <p className="text-sm theme-transition
        dark:text-gray-400
        light:text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ 
  number, 
  title, 
  description,
  action,
  actionText
}: { 
  number: string, 
  title: React.ReactNode, 
  description: string,
  action: () => void,
  actionText: string
}) {
  return (
    <div className="flex flex-col p-6 rounded-lg border theme-transition
      dark:bg-gray-800/50 dark:border-gray-700
      light:bg-white light:border-gray-200 light:shadow-card-light">
      <div className="flex items-center mb-4">
        <span className="text-3xl font-bold mr-3 theme-transition
          dark:text-purple-500
          light:text-purple-600">{number}</span>
        <h3 className="text-lg font-semibold theme-transition
          dark:text-white
          light:text-gray-800">{title}</h3>
      </div>
      <p className="text-sm mb-4 theme-transition
        dark:text-gray-400
        light:text-gray-600">{description}</p>
      <Button 
        variant="outline" 
        className="mt-auto self-start text-sm theme-transition
          dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300
          light:border-gray-200 light:bg-white light:hover:bg-gray-50 light:text-gray-700"
        onClick={action}
      >
        {actionText}
      </Button>
    </div>
  );
}