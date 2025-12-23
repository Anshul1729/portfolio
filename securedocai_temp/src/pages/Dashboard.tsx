import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSources } from '@/hooks/useSources';
import { Upload, MessageSquare, FileText, FolderOpen, FileIcon, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { profile, isAdmin, isDepartmentHead } = useAuth();
  const { sources, isLoading } = useSources();
  const navigate = useNavigate();

  const recentSources = sources.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">Ready</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Processing</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleUploadClick = () => {
    navigate('/sources');
  };

  return (
    <DashboardLayout>
      <div className="p-8 h-full overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Access your documents and start chatting with your knowledge base.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link to="/sources">
            <Card className="group hover:shadow-lg transition-shadow cursor-pointer border-border/50 h-full">
              <CardHeader className="pb-3">
                <div className="p-3 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-1">Upload Sources</CardTitle>
                <CardDescription>
                  Add PDF, DOCX, or TXT files to your knowledge base
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link to="/chat">
            <Card className="group hover:shadow-lg transition-shadow cursor-pointer border-border/50 h-full">
              <CardHeader className="pb-3">
                <div className="p-3 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-1">Start Chatting</CardTitle>
                <CardDescription>
                  Ask questions and get answers from your documents
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link to="/studio">
            <Card className="group hover:shadow-lg transition-shadow cursor-pointer border-border/50 h-full">
              <CardHeader className="pb-3">
                <div className="p-3 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-1">Generate Documents</CardTitle>
                <CardDescription>
                  Create reports, summaries, and presentations
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent sources placeholder */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Your Sources
                </CardTitle>
                <CardDescription>
                  Documents you have access to
                </CardDescription>
              </div>
              <Button onClick={handleUploadClick}>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recentSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">No sources yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Upload your first document to start building your knowledge base
                </p>
                <Button className="mt-4" onClick={handleUploadClick}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload your first source
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{source.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(source.status)}
                    </div>
                  </div>
                ))}
                {sources.length > 5 && (
                  <Button variant="ghost" className="w-full" onClick={() => navigate('/sources')}>
                    View all {sources.length} sources
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin quick access */}
        {(isAdmin || isDepartmentHead) && (
          <Card className="mt-6 border-border/50 bg-accent/30">
            <CardHeader>
              <CardTitle className="text-lg">Admin Quick Access</CardTitle>
              <CardDescription>
                Manage users, departments, and system settings
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button variant="outline" asChild>
                <Link to="/admin/users">Manage Users</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/admin/departments">Manage Departments</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
