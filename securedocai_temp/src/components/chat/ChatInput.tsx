import { useState, KeyboardEvent, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceMicButton } from './VoiceMicButton';

interface ChatInputProps {
  onSend: (message: string) => void;
  isDisabled: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, isDisabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || isDisabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);

  return (
    <div className="border-t border-border p-4 bg-card/50">
      <div className="max-w-3xl mx-auto flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Ask about your documents..."}
          disabled={isDisabled}
          className="min-h-[48px] max-h-[200px] resize-none"
          rows={1}
        />
        <VoiceMicButton onTranscript={handleVoiceTranscript} disabled={isDisabled} />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isDisabled}
          size="icon"
          className="flex-shrink-0 h-12 w-12"
        >
          {isDisabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}