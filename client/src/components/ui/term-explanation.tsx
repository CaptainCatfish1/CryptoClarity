import React from 'react';
import { CopyButton } from '@/components/ui/copy-button';

interface TermExplanationProps {
  term: string;
  explanation: string;
  relatedTerms?: string[];
  onRelatedTermClick?: (term: string) => void;
  audienceType?: 'beginner' | 'intermediate';
}

export function TermExplanation({ 
  term, 
  explanation, 
  relatedTerms = [], 
  onRelatedTermClick,
  audienceType = 'beginner'
}: TermExplanationProps) {
  return (
    <div className="explanation-card">
      <div className="explanation-header">
        <h3 className={`text-lg font-semibold ${audienceType === 'beginner' ? 'gradient-purple-blue' : 'gradient-blue-orange'}`}>
          {term}
        </h3>
        <div className="flex items-center gap-2">
          {audienceType === 'beginner' ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground">ELI5</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-foreground">Intermediate</span>
          )}
          <CopyButton value={explanation} />
        </div>
      </div>
      
      <div className="prose-sm prose-invert max-w-none">
        <p className="text-gray-300 whitespace-pre-line">{explanation}</p>
      </div>
      
      {relatedTerms.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-400 mb-2">Related Terms</h4>
          <div className="related-terms-container">
            {relatedTerms.map((term) => (
              <button
                key={term}
                onClick={() => onRelatedTermClick?.(term)}
                className="related-term-pill"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}