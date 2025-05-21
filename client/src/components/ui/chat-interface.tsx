import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendHorizontal, Loader2 } from 'lucide-react';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: React.ReactNode;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onSendMessage: (message: string) => void;
  inputPlaceholder: string;
  emptyStateMessage: React.ReactNode;
  emptyStateIcon: React.ReactNode;
  sendButtonLabel?: string;
  processingLabel?: string;
  showAudienceSelector?: boolean;
  audienceType?: 'beginner' | 'intermediate';
  onAudienceChange?: (audience: 'beginner' | 'intermediate') => void;
  audienceLabels?: {
    beginner: string;
    intermediate: string;
  };
}

export function ChatInterface({
  messages,
  isProcessing,
  onSendMessage,
  inputPlaceholder,
  emptyStateMessage,
  emptyStateIcon,
  sendButtonLabel = 'Send',
  processingLabel = 'Processing...',
  showAudienceSelector = false,
  audienceType = 'beginner',
  onAudienceChange,
  audienceLabels = { 
    beginner: 'ELI5 Mode',
    intermediate: 'Standard Mode' 
  }
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);
  
  // Auto-focus the input field
  useEffect(() => {
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus();
    }
  }, [isProcessing]);
  
  // Auto resize textarea as content grows
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };
  
  // Send message on Enter key (but allow Shift+Enter for new lines)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSendMessage = () => {
    if (inputText.trim() && !isProcessing) {
      onSendMessage(inputText.trim());
      setInputText('');
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };
  
  return (
    <div className="relative min-h-[calc(100vh-20rem)]" ref={containerRef}>
      {/* Messages container with padding bottom to ensure space for input */}
      <div className="pb-32 chat-container">
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
            <div className="bg-card p-6 rounded-full mb-4">
              {emptyStateIcon}
            </div>
            <div className="max-w-md">
              {emptyStateMessage}
            </div>
          </div>
        ) : (
          // Message list
          <>
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`chat-message ${message.type === 'user' ? 'chat-message-user' : 'chat-message-bot'}`}
              >
                <div 
                  className={`chat-bubble ${message.type === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'}`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            
            {/* Processing indicator */}
            {isProcessing && (
              <div className="chat-message chat-message-bot">
                <div className="chat-typing">
                  <div className="chat-typing-dot" style={{ animationDelay: '0ms' }}></div>
                  <div className="chat-typing-dot" style={{ animationDelay: '300ms' }}></div>
                  <div className="chat-typing-dot" style={{ animationDelay: '600ms' }}></div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Invisible element for auto-scrolling */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Fixed input area at bottom */}
      <div className="chat-input-container z-10 border-t border-gray-800 bg-background">
        <div className="chat-input-wrapper max-w-4xl mx-auto my-3">
          <Textarea
            ref={inputRef}
            value={inputText}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            className="chat-input"
            disabled={isProcessing}
            rows={1}
          />
          
          {showAudienceSelector && onAudienceChange && (
            <div className="flex flex-col space-y-1 mr-1">
              <Button
                size="sm"
                variant="ghost"
                className={`px-2 py-1 h-auto text-xs ${audienceType === 'beginner' ? 'bg-secondary/30 hover:bg-secondary/40 text-white' : 'text-muted-foreground'}`}
                onClick={() => onAudienceChange('beginner')}
                disabled={isProcessing}
              >
                {audienceLabels.beginner}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={`px-2 py-1 h-auto text-xs ${audienceType === 'intermediate' ? 'bg-primary/30 hover:bg-primary/40 text-white' : 'text-muted-foreground'}`}
                onClick={() => onAudienceChange('intermediate')}
                disabled={isProcessing}
              >
                {audienceLabels.intermediate}
              </Button>
            </div>
          )}
          
          <Button
            onClick={handleSendMessage}
            disabled={isProcessing || !inputText.trim()}
            className={`rounded-full p-2 h-10 w-10 flex-shrink-0 ${isProcessing ? 'bg-muted text-muted-foreground' : 'bg-secondary hover:bg-secondary/90'}`}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <SendHorizontal className="h-5 w-5" />
            )}
            <span className="sr-only">{isProcessing ? processingLabel : sendButtonLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}