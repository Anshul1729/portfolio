import { useRef, useEffect } from 'react';
import { User, Bot, Pin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChatMessage } from '@/hooks/useChat';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onTogglePin: (messageId: string) => void;
}

export function ChatMessages({ messages, isStreaming, onTogglePin }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-display font-semibold mb-2">Start a conversation</h3>
          <p className="text-muted-foreground text-sm">
            Ask questions about your uploaded documents. I'll search through your sources
            and provide answers with citations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 group",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            
            <div
              className={cn(
                "relative max-w-[80%] rounded-2xl px-4 py-3",
                message.role === 'user'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <MessageContent content={message.content} />
              </div>
              
              {message.role === 'assistant' && message.sources_used && message.sources_used.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Sources: {message.sources_used.map(s => s.source_name).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                  </p>
                </div>
              )}
              
              {message.role === 'assistant' && !message.id.startsWith('temp-') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "absolute -right-10 top-1 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
                        message.is_pinned && "opacity-100 text-primary"
                      )}
                      onClick={() => onTogglePin(message.id)}
                    >
                      <Pin className={cn("h-4 w-4", message.is_pinned && "fill-current")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {message.is_pinned ? 'Unpin' : 'Pin'} message
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
        
        {isStreaming && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split('\n');
  
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-lg font-bold">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-base font-semibold">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold">{line.slice(4)}</h3>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4">{line.slice(2)}</li>;
        }
        if (line.match(/^\d+\. /)) {
          return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
        }
        if (line.startsWith('```')) {
          return null; // Code blocks handled separately
        }
        if (line.trim() === '') {
          return <br key={i} />;
        }
        
        // Handle inline formatting
        let formattedLine = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-muted-foreground/20 px-1 rounded">$1</code>')
          .replace(/\[Source: (.*?)\]/g, '<span class="text-primary text-xs">[Source: $1]</span>');
        
        return <p key={i} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
      })}
    </div>
  );
}