import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export type SourceStatus = 'all' | 'pending' | 'processing' | 'ready' | 'error';
export type FileType = 'all' | 'pdf' | 'docx' | 'txt';
export type SortOrder = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

interface SourceFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: SourceStatus;
  onStatusChange: (status: SourceStatus) => void;
  fileTypeFilter: FileType;
  onFileTypeChange: (type: FileType) => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function SourceFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  fileTypeFilter,
  onFileTypeChange,
  sortOrder,
  onSortChange,
  onClearFilters,
  hasActiveFilters,
}: SourceFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border border-border/50">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as SourceStatus)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="ready">Ready</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>

      <Select value={fileTypeFilter} onValueChange={(v) => onFileTypeChange(v as FileType)}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="File Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="pdf">PDF</SelectItem>
          <SelectItem value="docx">DOCX</SelectItem>
          <SelectItem value="txt">TXT</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortOrder} onValueChange={(v) => onSortChange(v as SortOrder)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
          <SelectItem value="name-asc">Name A-Z</SelectItem>
          <SelectItem value="name-desc">Name Z-A</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
