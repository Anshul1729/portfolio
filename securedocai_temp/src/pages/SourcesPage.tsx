import { useRef, useCallback, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FolderOpen, Loader2 } from 'lucide-react';
import { useSources } from '@/hooks/useSources';
import { SourceCard } from '@/components/sources/SourceCard';
import { SourceFilters, SourceStatus, FileType, SortOrder } from '@/components/sources/SourceFilters';

export default function SourcesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    sources, 
    isLoading, 
    isUploading, 
    uploadProgress, 
    extractionStatus,
    uploadFiles, 
    deleteSource,
    getDownloadUrl,
    reprocessSource 
  } = useSources();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SourceStatus>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || fileTypeFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setFileTypeFilter('all');
    setSortOrder('newest');
  }, []);

  // Apply filters and sorting
  const filteredSources = useMemo(() => {
    let result = [...sources];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.status === statusFilter);
    }

    // File type filter
    if (fileTypeFilter !== 'all') {
      result = result.filter(s => {
        const ext = s.file_type.toLowerCase();
        if (fileTypeFilter === 'pdf') return ext.includes('pdf');
        if (fileTypeFilter === 'docx') return ext.includes('doc') || ext.includes('docx');
        if (fileTypeFilter === 'txt') return ext.includes('txt') || ext.includes('text');
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    return result;
  }, [sources, searchQuery, statusFilter, fileTypeFilter, sortOrder]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
    event.target.value = '';
  }, [uploadFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  }, [uploadFiles]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleDownload = async (filePath: string) => {
    const url = await getDownloadUrl(filePath);
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 h-full overflow-y-auto">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.doc,.txt"
          multiple
          className="hidden"
        />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Sources</h1>
            <p className="text-muted-foreground mt-1">
              Manage your documents and knowledge base
            </p>
          </div>
          <Button onClick={handleUploadClick} disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>

        {isUploading && (
          <Card className="mb-6 border-primary/50">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {extractionStatus || 'Uploading files...'}
                  </p>
                  <Progress value={uploadProgress} className="mt-2 h-2" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sources.length > 0 ? (
          <div className="space-y-4">
            <SourceFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              fileTypeFilter={fileTypeFilter}
              onFileTypeChange={setFileTypeFilter}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  {hasActiveFilters 
                    ? `Showing ${filteredSources.length} of ${sources.length} Sources`
                    : `All Sources (${sources.length})`
                  }
                </CardTitle>
                <CardDescription>
                  Documents available in your knowledge base
                </CardDescription>
              </CardHeader>
            </Card>
            
            <div className="grid gap-4">
              {filteredSources.length > 0 ? (
                filteredSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onDelete={deleteSource}
                    onDownload={handleDownload}
                    onReprocess={reprocessSource}
                  />
                ))
              ) : (
                <Card className="border-border/50 border-dashed">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No sources match your filters</p>
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Clear filters
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <Card 
            className="border-border/50 border-dashed"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                All Sources
              </CardTitle>
              <CardDescription>
                Documents available in your knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FolderOpen className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-medium mb-2">No sources yet</h3>
                <p className="text-muted-foreground text-sm max-w-md mb-6">
                  Upload PDF, DOCX, or TXT files to start building your knowledge base. 
                  Drag and drop files here or click the button below.
                </p>
                <Button size="lg" onClick={handleUploadClick} disabled={isUploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload your first source
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
