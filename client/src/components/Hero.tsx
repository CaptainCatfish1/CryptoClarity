import { CheckCircle2, Shield, Brain } from "lucide-react";

export default function Hero() {
  return (
    <div className="bg-gray-900 py-12 mb-10 border-b border-gray-800">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-500 to-purple-600">
          Join Crypto with Clarity. Web3 with Safety.
        </h1>
        
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-5 rounded-lg flex flex-col items-center">
            <div className="p-3 bg-purple-900/30 rounded-full mb-4">
              <Brain className="h-6 w-6 text-purple-400" />
            </div>
            <p className="text-gray-300 text-sm">Tools for clarity while navigating crypto</p>
          </div>
          
          <div className="bg-gray-800 p-5 rounded-lg flex flex-col items-center">
            <div className="p-3 bg-blue-900/30 rounded-full mb-4">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <p className="text-gray-300 text-sm">Scam and risk checks</p>
          </div>
          
          <div className="bg-gray-800 p-5 rounded-lg flex flex-col items-center">
            <div className="p-3 bg-orange-900/30 rounded-full mb-4">
              <CheckCircle2 className="h-6 w-6 text-orange-400" />
            </div>
            <p className="text-gray-300 text-sm">Experts supporting users</p>
          </div>
        </div>
      </div>
    </div>
  );
}