import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Presentation as PresentationIcon,
  FileCheck,
  HelpCircle,
  Loader2,
  Trash2,
  Download,
  Sparkles,
  Clock,
  FileDown,
} from 'lucide-react';
import { useGeneratedDocuments, DocumentType, GeneratedDocument } from '@/hooks/useGeneratedDocuments';
import { useSources } from '@/hooks/useSources';
import { formatDistanceToNow } from 'date-fns';
import { exportAsPdf, exportAsPptx, exportAsText } from '@/lib/documentExport';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const documentTypes: { type: DocumentType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    type: 'report',
    label: 'Business Report',
    icon: <FileText className="h-5 w-5" />,
    description: 'Comprehensive analysis with sections, findings, and recommendations',
  },
  {
    type: 'presentation',
    label: 'Presentation',
    icon: <PresentationIcon className="h-5 w-5" />,
    description: 'Slide outlines with key points and speaker notes',
  },
  {
    type: 'summary',
    label: 'Executive Summary',
    icon: <FileCheck className="h-5 w-5" />,
    description: 'Condensed overview with key takeaways',
  },
  {
    type: 'faq',
    label: 'FAQ Document',
    icon: <HelpCircle className="h-5 w-5" />,
    description: 'Questions and answers extracted from sources',
  },
];

export default function StudioPage() {
  const { documents, isLoading, isGenerating, generateDocument, deleteDocument } = useGeneratedDocuments();
  const { sources } = useSources();
  const [selectedType, setSelectedType] = useState<DocumentType>('report');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [viewingDoc, setViewingDoc] = useState<GeneratedDocument | null>(null);

  const readySources = sources.filter(s => s.status === 'ready');

  const handleGenerate = async () => {
    const doc = await generateDocument(selectedType, selectedSources, title || undefined, instructions || undefined);
    if (doc) {
      setSelectedSources([]);
      setTitle('');
      setInstructions('');
      setViewingDoc(doc);
    }
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const getTypeIcon = (type: DocumentType) => {
    const found = documentTypes.find(t => t.type === type);
    return found?.icon || <FileText className="h-4 w-4" />;
  };

  const handleExportPdf = (doc: GeneratedDocument) => {
    exportAsPdf(doc.title, doc.content, doc.document_type);
  };

  const handleExportPptx = (doc: GeneratedDocument) => {
    exportAsPptx(doc.title, doc.content);
  };

  const handleExportText = (doc: GeneratedDocument) => {
    exportAsText(doc.title, doc.content);
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-display font-bold">Studio</h1>
          <p className="text-muted-foreground">Generate reports, presentations, and more from your sources</p>
        </div>

        <Tabs defaultValue="generate" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-border">
            <TabsList className="h-12">
              <TabsTrigger value="generate" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-2">
                <Clock className="h-4 w-4" />
                Library ({documents.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="generate" className="flex-1 overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Document Type Selection */}
              <div className="space-y-3">
                <Label className="text-base">Document Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {documentTypes.map(({ type, label, icon, description }) => (
                    <Card
                      key={type}
                      className={`cursor-pointer transition-all ${
                        selectedType === type
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedType(type)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {icon}
                          </div>
                          <div>
                            <h3 className="font-medium">{label}</h3>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Source Selection */}
              <div className="space-y-3">
                <Label className="text-base">Select Sources ({selectedSources.length} selected)</Label>
                {readySources.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">
                        No ready sources available. Upload and process some documents first.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    <div className="space-y-1">
                      {readySources.map((source) => (
                        <div
                          key={source.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedSources.includes(source.id)
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleSource(source.id)}
                        >
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate flex-1">{source.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {source.page_count || '?'} pages
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Optional Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a custom title..."
                />
              </div>

              {/* Additional Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions">Additional Instructions (optional)</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="E.g., Focus on financial data, exclude technical details..."
                  rows={3}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={selectedSources.length === 0 || isGenerating}
                className="w-full gap-2"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate {documentTypes.find(t => t.type === selectedType)?.label}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="library" className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                <p className="text-muted-foreground">
                  Generate your first document to see it here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 max-w-4xl mx-auto">
                {documents.map((doc) => (
                  <Card key={doc.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {getTypeIcon(doc.document_type)}
                          </div>
                          <div>
                            <CardTitle className="text-base">{doc.title}</CardTitle>
                            <CardDescription>
                              {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary">{doc.document_type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {doc.content.substring(0, 200)}...
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingDoc(doc)}
                        >
                          View
                        </Button>
                        {doc.document_type === 'presentation' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportPptx(doc)}
                            className="gap-1"
                          >
                            <FileDown className="h-3 w-3" />
                            PPTX
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportPdf(doc)}
                            className="gap-1"
                          >
                            <FileDown className="h-3 w-3" />
                            PDF
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete document?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{doc.title}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteDocument(doc.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Preview Dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{viewingDoc?.title}</DialogTitle>
            <DialogDescription>
              Generated {viewingDoc && formatDistanceToNow(new Date(viewingDoc.created_at), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto pr-4">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {viewingDoc?.content}
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t">
            {viewingDoc?.document_type === 'presentation' ? (
              <Button onClick={() => viewingDoc && handleExportPptx(viewingDoc)}>
                <FileDown className="h-4 w-4 mr-2" />
                Export as PPTX
              </Button>
            ) : (
              <Button onClick={() => viewingDoc && handleExportPdf(viewingDoc)}>
                <FileDown className="h-4 w-4 mr-2" />
                Export as PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => viewingDoc && handleExportText(viewingDoc)}>
              <Download className="h-4 w-4 mr-2" />
              Export as Text
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}