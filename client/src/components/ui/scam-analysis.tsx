import React from 'react';
import { CopyButton } from '@/components/ui/copy-button';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Flag, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScamAnalysisProps {
  riskLevel: string;
  summary: string;
  redFlags?: string[];
  safetyTips?: string[];
  addressAnalysis?: string;
  scenario: string;
  address?: string;
}

export function ScamAnalysis({
  riskLevel,
  summary,
  redFlags = [],
  safetyTips = [],
  addressAnalysis,
  scenario,
  address
}: ScamAnalysisProps) {
  const { toast } = useToast();
  
  // Get appropriate risk level class
  const getRiskClass = () => {
    const level = riskLevel.toLowerCase();
    if (level.includes('high')) return 'risk-high';
    if (level.includes('medium')) return 'risk-medium';
    if (level.includes('low')) return 'risk-low';
    return '';
  };
  
  return (
    <div className="explanation-card">
      <div className="explanation-header">
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold gradient-purple-orange">
            Scam Analysis
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {scenario.length > 80 ? `${scenario.substring(0, 80)}...` : scenario}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={getRiskClass()}>
            {riskLevel}
          </span>
          <CopyButton value={`Risk: ${riskLevel}\n\nSummary: ${summary}\n\n${redFlags.length > 0 ? `Red Flags:\n${redFlags.join('\n')}\n\n` : ''}${safetyTips.length > 0 ? `Safety Tips:\n${safetyTips.join('\n')}\n\n` : ''}${addressAnalysis ? `Address Analysis:\n${addressAnalysis}` : ''}`} />
        </div>
      </div>
      
      <div className="prose-sm prose-invert max-w-none">
        <p className="text-gray-300">{summary}</p>
      </div>
      
      {address && (
        <div className="mt-3 pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-400">
            Address: <span className="text-primary">{address}</span>
          </p>
        </div>
      )}
      
      {redFlags.length > 0 && (
        <div className="mt-4 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
          <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Red Flags
          </h4>
          <ul className="space-y-2">
            {redFlags.map((flag, index) => (
              <li key={index} className="text-xs text-gray-300 flex items-start">
                <span className="text-red-400 mr-2">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {safetyTips.length > 0 && (
        <div className="mt-3">
          <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center">
            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Safety Tips
          </h4>
          <ul className="space-y-2">
            {safetyTips.map((tip, index) => (
              <li key={index} className="text-xs text-gray-300 flex items-start">
                <span className="text-green-400 mr-2">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {addressAnalysis && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-primary flex items-center">
              <Database className="h-3.5 w-3.5 mr-1" /> Blockchain Analysis
            </h4>
            <CopyButton value={addressAnalysis} />
          </div>
          <p className="text-xs text-gray-300 whitespace-pre-line">
            {addressAnalysis}
          </p>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-secondary/30 text-secondary hover:bg-secondary/20"
          onClick={() => {
            toast({
              title: "Report submitted",
              description: "Thank you for helping us identify potential scams.",
            });
          }}
        >
          <Flag className="h-3.5 w-3.5 mr-1" /> Report as Scam
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-tertiary/30 text-tertiary hover:bg-tertiary/20"
          onClick={() => {
            toast({
              title: "Premium Feature",
              description: "Upgrade to access expert blockchain forensics and detailed risk analysis.",
            });
          }}
        >
          <Database className="h-3.5 w-3.5 mr-1" /> Expert Investigation
        </Button>
      </div>
    </div>
  );
}