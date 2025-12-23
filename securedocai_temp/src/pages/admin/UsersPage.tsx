import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAllUsersUsage } from '@/hooks/useCostTracking';
import { UserPlus, Copy, Mail, Users, Clock, Check, DollarSign } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.enum(['admin', 'department_head', 'member']),
  departmentId: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  department_id: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  department_id: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { usageByUser } = useAllUsersUsage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'member',
      departmentId: undefined,
    },
  });

  const fetchData = async () => {
    setIsLoading(true);
    
    const [profilesRes, departmentsRes, invitationsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name'),
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data);
    if (departmentsRes.data) setDepartments(departmentsRes.data);
    
    // Filter out invitations for users who have already joined (profile exists with same email)
    if (invitationsRes.data && profilesRes.data) {
      const joinedEmails = new Set(profilesRes.data.map(p => p.email.toLowerCase()));
      const filteredInvitations = invitationsRes.data.map(inv => ({
        ...inv,
        // Mark as accepted if user already exists in profiles
        accepted_at: inv.accepted_at || (joinedEmails.has(inv.email.toLowerCase()) ? new Date().toISOString() : null)
      }));
      setInvitations(filteredInvitations);
    } else if (invitationsRes.data) {
      setInvitations(invitationsRes.data);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async (data: InviteFormData) => {
    const { error } = await supabase.from('invitations').insert({
      email: data.email,
      role: data.role,
      department_id: data.departmentId || null,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to send invitation',
        description: error.message,
      });
    } else {
      toast({
        title: 'Invitation sent',
        description: `An invitation has been created for ${data.email}`,
      });
      form.reset();
      setIsInviteOpen(false);
      fetchData();
    }
  };

  const copyInviteLink = async (token: string) => {
    const url = `${window.location.origin}/auth?invite=${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast({
      title: 'Link copied',
      description: 'Invitation link copied to clipboard',
    });
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return 'None';
    const dept = departments.find((d) => d.id === departmentId);
    return dept?.name || 'Unknown';
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'department_head':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  const getUserCost = (userId: string) => {
    return usageByUser[userId]?.cost || 0;
  };

  return (
    <DashboardLayout>
      <div className="p-8 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Users</h1>
            <p className="text-muted-foreground mt-1">
              Manage team members and invitations
            </p>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a new user</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleInvite)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={form.watch('role')}
                    onValueChange={(value: 'admin' | 'department_head' | 'member') =>
                      form.setValue('role', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="department_head">Department Head</SelectItem>
                      {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department (optional)</Label>
                  <Select
                    value={form.watch('departmentId') || '__none__'}
                    onValueChange={(value) => form.setValue('departmentId', value === '__none__' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No department</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Send Invitation</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{profiles.length}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {invitations.filter((i) => !i.accepted_at).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {invitations.filter((i) => i.accepted_at).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Accepted Invites</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users table */}
        <Card className="mb-8 border-border/50">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>All users in your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users yet. Send an invitation to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3" />
                        Lifetime Spend
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.full_name || 'Not set'}
                      </TableCell>
                      <TableCell>{profile.email}</TableCell>
                      <TableCell>{getDepartmentName(profile.department_id)}</TableCell>
                      <TableCell>
                        {new Date(profile.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCost(getUserCost(profile.id))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending invitations */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.filter((i) => !i.accepted_at).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending invitations
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations
                    .filter((i) => !i.accepted_at)
                    .map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {invitation.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(invitation.role)}>
                            {invitation.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{getDepartmentName(invitation.department_id)}</TableCell>
                        <TableCell>
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invitation.token)}
                          >
                            {copiedToken === invitation.token ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
