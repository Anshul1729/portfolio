import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCostTracking } from '@/hooks/useCostTracking';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  MessageSquare,
  Settings,
  Users,
  Building2,
  LogOut,
  FolderOpen,
  PenTool,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/', icon: FolderOpen, label: 'Sources' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/studio', icon: PenTool, label: 'Studio' },
];

const adminNavItems = [
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/departments', icon: Building2, label: 'Departments' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, isAdmin, isDepartmentHead, signOut } = useAuth();
  const { sessionCost, lifetimeCost, isLoading: costLoading } = useCostTracking();
  const location = useLocation();
  const navigate = useNavigate();

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
        {/* Logo - Fixed at top */}
        <div className="p-6 border-b border-sidebar-border flex-shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sidebar-primary/10">
              <FileText className="h-6 w-6 text-sidebar-primary" />
            </div>
            <span className="text-lg font-display font-bold text-sidebar-foreground">
              SecureDoc AI
            </span>
          </Link>
        </div>

        {/* Navigation - Scrollable middle section */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {(isAdmin || isDepartmentHead) && (
            <>
              <div className="pt-4">
                <div className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  Admin
                </div>
              </div>
              <div className="space-y-1">
                {adminNavItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        {/* AI Credits - Fixed above user menu */}
        {!costLoading && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-border flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-sidebar-primary" />
              <span className="text-xs font-medium text-sidebar-foreground">AI Credits</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-sidebar-foreground/70">
                <span>Session</span>
                <span className="font-medium text-sidebar-foreground">{formatCost(sessionCost)}</span>
              </div>
              <div className="flex justify-between text-sidebar-foreground/70">
                <span>Lifetime</span>
                <span className="font-medium text-sidebar-foreground">{formatCost(lifetimeCost)}</span>
              </div>
            </div>
          </div>
        )}

        {/* User menu - Fixed at bottom */}
        <div className="p-4 border-t border-sidebar-border flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-6 h-auto text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                    {getInitials(profile?.full_name || null, user?.email || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {user?.email}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content - takes remaining height, children control their own scroll */}
      <main className="flex-1 h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
