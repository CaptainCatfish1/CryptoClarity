import { useState } from "react";
import { Shield, BookOpen, ScanLine, MessageCircle } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

type Tab = "clarity" | "cryptoClarity" | "clarityScan";

interface HeaderProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export default function Header({ activeTab, setActiveTab }: HeaderProps) {
  const openContactForm = () => {
    // Create and dispatch custom event to show contact form
    const event = new CustomEvent('showContactForm');
    window.dispatchEvent(event);
  };

  return (
    <header className="bg-background/40 backdrop-blur-sm border-b border-border py-4 theme-transition sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Logo />
          </div>
          
          <nav className="hidden md:flex space-x-1">
            <TabButton 
              isActive={activeTab === "clarity"} 
              onClick={() => setActiveTab("clarity")}
              icon={<Shield className="h-4 w-4 mr-1.5" />}
              label="Home"
              activeColor="bg-purple-900/50 text-purple-300 border-purple-500 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-500 light:bg-purple-100 light:text-purple-700 light:border-purple-400"
              inactiveColor="text-muted-foreground hover:text-foreground border-transparent"
            />
            <TabButton 
              isActive={activeTab === "cryptoClarity"} 
              onClick={() => setActiveTab("cryptoClarity")}
              icon={<BookOpen className="h-4 w-4 mr-1.5" />}
              label="Check a Term"
              activeColor="bg-blue-900/50 text-blue-300 border-blue-500 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-500 light:bg-blue-100 light:text-blue-700 light:border-blue-400"
              inactiveColor="text-muted-foreground hover:text-foreground border-transparent"
            />
            <TabButton 
              isActive={activeTab === "clarityScan"} 
              onClick={() => setActiveTab("clarityScan")}
              icon={<ScanLine className="h-4 w-4 mr-1.5" />}
              label="Run a Scan"
              activeColor="bg-blue-900/50 text-blue-300 border-blue-500 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-500 light:bg-blue-100 light:text-blue-700 light:border-blue-400"
              inactiveColor="text-muted-foreground hover:text-foreground border-transparent"
            />
          </nav>
          
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <button 
              className="hidden md:flex text-sm items-center px-3 py-1.5 rounded-md border border-border hover:bg-accent/50 theme-transition"
              onClick={openContactForm}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              Contact Support
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden flex mt-4 border-t border-border pt-3">
          <div className="grid grid-cols-4 gap-1 w-full">
            <MobileTabButton 
              isActive={activeTab === "clarity"} 
              onClick={() => setActiveTab("clarity")}
              icon={<Shield className="h-4 w-4" />}
              label="Home"
              activeColor="bg-purple-900/50 text-purple-300 dark:bg-purple-900/50 dark:text-purple-300 light:bg-purple-100 light:text-purple-700"
              inactiveColor="text-muted-foreground hover:text-foreground"
            />
            <MobileTabButton 
              isActive={activeTab === "cryptoClarity"} 
              onClick={() => setActiveTab("cryptoClarity")}
              icon={<BookOpen className="h-4 w-4" />}
              label="Terms"
              activeColor="bg-blue-900/50 text-blue-300 dark:bg-blue-900/50 dark:text-blue-300 light:bg-blue-100 light:text-blue-700"
              inactiveColor="text-muted-foreground hover:text-foreground"
            />
            <MobileTabButton 
              isActive={activeTab === "clarityScan"} 
              onClick={() => setActiveTab("clarityScan")}
              icon={<ScanLine className="h-4 w-4" />}
              label="Scan"
              activeColor="bg-blue-900/50 text-blue-300 dark:bg-blue-900/50 dark:text-blue-300 light:bg-blue-100 light:text-blue-700"
              inactiveColor="text-muted-foreground hover:text-foreground"
            />
            <MobileTabButton 
              isActive={false} 
              onClick={openContactForm}
              icon={<MessageCircle className="h-4 w-4" />}
              label="Help"
              activeColor="bg-purple-900/50 text-purple-300"
              inactiveColor="text-muted-foreground hover:text-foreground"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeColor: string;
  inactiveColor: string;
}

function TabButton({ isActive, onClick, icon, label, activeColor, inactiveColor }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-4 py-2 rounded-md border-b-2 font-medium transition-colors ${isActive ? activeColor : inactiveColor}`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileTabButton({ isActive, onClick, icon, label, activeColor, inactiveColor }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 rounded-md text-xs font-medium transition-colors ${isActive ? activeColor : inactiveColor}`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );
}