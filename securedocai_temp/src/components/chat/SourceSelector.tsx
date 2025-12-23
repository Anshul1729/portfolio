import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Source {
  id: string;
  name: string;
  status: string;
}

interface SourceSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function SourceSelector({ selectedIds, onSelectionChange }: SourceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);

  useEffect(() => {
    const fetchSources = async () => {
      const { data } = await supabase
        .from('sources')
        .select('id, name, status')
        .eq('status', 'ready')
        .order('name');
      
      setSources((data || []) as Source[]);
    };
    fetchSources();
  }, []);

  const selectedSources = sources.filter(s => selectedIds.includes(s.id));

  const toggleSource = (sourceId: string) => {
    if (selectedIds.includes(sourceId)) {
      onSelectionChange(selectedIds.filter(id => id !== sourceId));
    } else {
      onSelectionChange([...selectedIds, sourceId]);
    }
  };

  const removeSource = (sourceId: string) => {
    onSelectionChange(selectedIds.filter(id => id !== sourceId));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {selectedSources.map((source) => (
          <Badge key={source.id} variant="secondary" className="gap-1 pr-1">
            <FileText className="h-3 w-3" />
            <span className="truncate max-w-[150px]">{source.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1 hover:bg-destructive/20"
              onClick={() => removeSource(source.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
          >
            {selectedIds.length === 0
              ? "Select sources to chat with..."
              : `${selectedIds.length} source${selectedIds.length > 1 ? 's' : ''} selected`
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search sources..." />
            <CommandList>
              <CommandEmpty>No sources found.</CommandEmpty>
              <CommandGroup>
                {sources.map((source) => (
                  <CommandItem
                    key={source.id}
                    onSelect={() => toggleSource(source.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedIds.includes(source.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{source.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedIds.length === 0 && sources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          All ready sources will be searched if none selected
        </p>
      )}
      {sources.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No processed sources available. Upload documents and wait for processing to complete.
        </p>
      )}
    </div>
  );
}