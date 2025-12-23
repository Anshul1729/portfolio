import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceMicButton({ onTranscript, disabled }: VoiceMicButtonProps) {
  const {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: (text) => {
      onTranscript(text);
    },
  });

  // Update input as user speaks (interim results)
  useEffect(() => {
    if (transcript && isListening) {
      onTranscript(transcript);
    }
  }, [transcript, isListening, onTranscript]);

  if (!isSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled
              className="flex-shrink-0 h-12 w-12 opacity-50"
            >
              <MicOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice input not supported in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant={isListening ? 'default' : 'ghost'}
            onClick={handleClick}
            disabled={disabled}
            className={cn(
              'flex-shrink-0 h-12 w-12 transition-all',
              isListening && 'bg-destructive hover:bg-destructive/90 animate-pulse'
            )}
          >
            {isListening ? (
              <Mic className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {error 
              ? error 
              : isListening 
                ? 'Click to stop recording' 
                : 'Click to start voice input'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
