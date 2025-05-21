import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CryptoTranslator from "@/components/CryptoTranslator";
import ScamChecker from "@/components/ScamChecker";
import MyClarityTab from "@/components/MyClarityTab";
import NotFound from "@/pages/not-found";

// Import Orbitron font
import "@fontsource/orbitron/400.css";
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/700.css";

type Tab = "clarity" | "cryptoClarity" | "clarityScan";

function Router() {
  const [activeTab, setActiveTab] = useState<Tab>("clarity");
  
  // Apply the font to headings
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      h1, h2, h3, .crypto-font {
        font-family: 'Orbitron', sans-serif;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Listen for tab change custom events
    const handleTabChange = (event: any) => {
      const tab = event.detail as Tab;
      if (tab && (tab === 'clarity' || tab === 'cryptoClarity' || tab === 'clarityScan')) {
        setActiveTab(tab);
      }
    };
    
    window.addEventListener('tabChange', handleTabChange);
    
    return () => {
      document.head.removeChild(styleElement);
      window.removeEventListener('tabChange', handleTabChange);
    };
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 container mx-auto py-6 px-4 sm:px-6">
        {activeTab === "clarity" && <MyClarityTab />}
        {activeTab === "cryptoClarity" && <CryptoTranslator />}
        {activeTab === "clarityScan" && <ScamChecker />}
      </main>
      
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        storageKey="crypto-clarity-theme"
      >
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
