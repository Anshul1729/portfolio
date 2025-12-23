import { useState, useEffect } from 'react';
import { Share2, Users, Building, Globe, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useSourcePermissions, PermissionLevel, SourcePermission } from '@/hooks/useSourcePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShareDialogProps {
  sourceId: string;
  sourceName: string;
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

interface Department {
  id: string;
  name: string;
}

export function ShareDialog({ sourceId, sourceName }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>('view');
  const [shareType, setShareType] = useState<'user' | 'department' | 'company'>('user');

  const {
    permissions,
    isLoading,
    fetchPermissions,
    shareWithUser,
    shareWithDepartment,
    shareWithCompany,
    removePermission,
  } = useSourcePermissions(sourceId);

  useEffect(() => {
    if (open) {
      fetchPermissions();
      fetchUsersAndDepartments();
    }
  }, [open, fetchPermissions]);

  const fetchUsersAndDepartments = async () => {
    const [usersRes, deptsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('departments').select('id, name'),
    ]);
    setUsers((usersRes.data || []) as User[]);
    setDepartments((deptsRes.data || []) as Department[]);
  };

  const handleShare = async () => {
    if (shareType === 'user' && selectedUser) {
      await shareWithUser(sourceId, selectedUser, selectedPermission);
      setSelectedUser('');
    } else if (shareType === 'department' && selectedDepartment) {
      await shareWithDepartment(sourceId, selectedDepartment, selectedPermission);
      setSelectedDepartment('');
    } else if (shareType === 'company') {
      await shareWithCompany(sourceId, selectedPermission);
    }
  };

  const getPermissionLabel = (level: PermissionLevel) => {
    switch (level) {
      case 'view': return 'Can view';
      case 'chat': return 'Can chat';
      case 'share': return 'Can share';
      case 'full_control': return 'Full control';
    }
  };

  const getPermissionBadgeVariant = (level: PermissionLevel) => {
    switch (level) {
      case 'full_control': return 'default';
      case 'share': return 'secondary';
      case 'chat': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share "{sourceName}"</DialogTitle>
          <DialogDescription>
            Control who can access this source and what they can do with it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share type selection */}
          <div className="flex gap-2">
            <Button
              variant={shareType === 'user' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShareType('user')}
              className="gap-1"
            >
              <Users className="h-4 w-4" />
              User
            </Button>
            <Button
              variant={shareType === 'department' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShareType('department')}
              className="gap-1"
            >
              <Building className="h-4 w-4" />
              Department
            </Button>
            <Button
              variant={shareType === 'company' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShareType('company')}
              className="gap-1"
            >
              <Globe className="h-4 w-4" />
              Company
            </Button>
          </div>

          {/* Target selection */}
          {shareType === 'user' && (
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {shareType === 'department' && (
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select a department..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {shareType === 'company' && (
            <p className="text-sm text-muted-foreground">
              This will make the source accessible to everyone in the company.
            </p>
          )}

          {/* Permission level */}
          <div className="flex gap-2">
            <Select
              value={selectedPermission}
              onValueChange={(v) => setSelectedPermission(v as PermissionLevel)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Can view</SelectItem>
                <SelectItem value="chat">Can chat</SelectItem>
                <SelectItem value="share">Can share</SelectItem>
                <SelectItem value="full_control">Full control</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleShare} disabled={
              (shareType === 'user' && !selectedUser) ||
              (shareType === 'department' && !selectedDepartment)
            }>
              Share
            </Button>
          </div>

          <Separator />

          {/* Current permissions */}
          <div>
            <h4 className="text-sm font-medium mb-2">Current Access</h4>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Only you have access to this source.
              </p>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {permissions.map((perm) => (
                    <PermissionRow
                      key={perm.id}
                      permission={perm}
                      onRemove={() => removePermission(perm.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PermissionRow({
  permission,
  onRemove,
}: {
  permission: SourcePermission;
  onRemove: () => void;
}) {
  const getLabel = () => {
    if (permission.is_company_wide) return 'Everyone in company';
    if (permission.department) return permission.department.name;
    if (permission.user) return permission.user.full_name || permission.user.email;
    return 'Unknown';
  };

  const getIcon = () => {
    if (permission.is_company_wide) return <Globe className="h-4 w-4" />;
    if (permission.department_id) return <Building className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  const getPermissionLabel = (level: PermissionLevel) => {
    switch (level) {
      case 'view': return 'View';
      case 'chat': return 'Chat';
      case 'share': return 'Share';
      case 'full_control': return 'Full';
    }
  };

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        {getIcon()}
        <span className="text-sm">{getLabel()}</span>
        <Badge variant="outline" className="text-xs">
          {getPermissionLabel(permission.permission)}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}