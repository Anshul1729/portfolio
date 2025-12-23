import { FileText, FileType, Trash2, Download, Loader2, AlertCircle, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Source, SourceStatus } from '@/hooks/useSources';
import { ShareDialog } from '@/components/sources/ShareDialog';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { useState, useEffect } from 'react';

interface SourceCardProps {
  source: Source;
  onDelete: (id: string, filePath: string) => void;
  onDownload: (filePath: string) => void;
  onReprocess?: (sourceId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'pdf':
      return <FileText className="h-8 w-8 text-red-500" />;
    case 'docx':
    case 'doc':
      return <FileType className="h-8 w-8 text-blue-500" />;
    default:
      return <FileText className="h-8 w-8 text-muted-foreground" />;
  }
}

function getStatusBadge(status: SourceStatus, errorMessage?: string | null) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Pending
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case 'ready':
      return (
        <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-500">
          <CheckCircle className="h-3 w-3" />
          Ready
        </Badge>
      );
    case 'error':
      return (
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{errorMessage || 'Processing failed'}</p>
          </TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}

function getElapsedTime(startTime: string | null): number {
  if (!startTime) return 0;
  return differenceInMinutes(new Date(), new Date(startTime));
}

export function SourceCard({ source, onDelete, onDownload, onReprocess }: SourceCardProps) {
  const showProgress = source.status === 'processing' && source.processing_progress !== undefined && source.processing_progress > 0;
  const isProcessing = source.status === 'processing' || source.status === 'pending';
  
  // Track elapsed time for processing documents
  const [elapsedMinutes, setElapsedMinutes] = useState(() => 
    getElapsedTime(source.processing_started_at || (isProcessing ? source.updated_at : null))
  );
  
  useEffect(() => {
    if (!isProcessing) {
      setElapsedMinutes(0);
      return;
    }
    
    const startTime = source.processing_started_at || source.updated_at;
    setElapsedMinutes(getElapsedTime(startTime));
    
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedTime(startTime));
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [isProcessing, source.processing_started_at, source.updated_at]);
  
  const isStuckWarning = isProcessing && elapsedMinutes >= 5;
  
  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-muted rounded-lg">
            {getFileIcon(source.file_type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground truncate">{source.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="uppercase">{source.file_type}</span>
                  <span>•</span>
                  <span>{formatFileSize(source.file_size)}</span>
                  {source.page_count && (
                    <>
                      <span>•</span>
                      <span>{source.page_count} pages</span>
                    </>
                  )}
                </div>
              </div>
              {getStatusBadge(source.status, source.error_message)}
            </div>
            
            {/* Processing progress bar */}
            {isProcessing && (
              <div className="mt-2 space-y-1">
                {showProgress && <Progress value={source.processing_progress} className="h-1" />}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {source.processing_info || `Processing... ${source.processing_progress || 0}%`}
                  </p>
                  {elapsedMinutes > 0 && (
                    <div className={`flex items-center gap-1 text-xs ${isStuckWarning ? 'text-amber-500' : 'text-muted-foreground'}`}>
                      <Clock className="h-3 w-3" />
                      <span>{elapsedMinutes}m</span>
                    </div>
                  )}
                </div>
                {isStuckWarning && (
                  <p className="text-xs text-amber-500">
                    Taking longer than expected. Will auto-retry if stuck.
                  </p>
                )}
              </div>
            )}
            
            {source.content_preview && source.status === 'ready' && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {source.content_preview}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-muted-foreground">
                {source.uploader?.full_name || source.uploader?.email || 'Unknown'} •{' '}
                {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
              </div>
              
              <div className="flex items-center gap-1">
                {/* Share button */}
                <ShareDialog sourceId={source.id} sourceName={source.name} />
                
                {/* Reprocess button for error state */}
                {source.status === 'error' && onReprocess && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReprocess(source.id)}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reprocess</TooltipContent>
                  </Tooltip>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownload(source.file_path)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete source?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{source.name}" and all associated data.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(source.id, source.file_path)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
