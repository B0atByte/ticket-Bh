import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { applyBranding, getBranding } from '../features/admin/admin.api';
import { logout } from '../features/auth/auth.api';
import { useAuthStore } from '../features/auth/auth.store';
import { NotificationsMenu } from '../features/notifications/NotificationsMenu';
import { cn } from '../lib/utils';

const navGroups = [
  {
    titleKey: 'nav.sectionLearning',
    items: [
      { to: '/dashboard',   labelKey: 'nav.dashboard',   icon: LayoutDashboard, permission: null },
      { to: '/courses',     labelKey: 'nav.courses',     icon: BookOpen,         permission: 'course.read' },
      { to: '/exams',       labelKey: 'nav.assessments', icon: ClipboardList,    permission: 'exam.take' },
      { to: '/leaderboard', labelKey: 'nav.leaderboard', icon: Trophy,           permission: null },
      { to: '/team',        labelKey: 'nav.team',        icon: Users,            permission: 'enrollment.read' },
    ],
  },
  {
    titleKey: 'nav.sectionInstructor',
    items: [
      { to: '/admin/questions', labelKey: 'nav.questions',   icon: ClipboardCheck, permission: 'question.create' },
      { to: '/admin/exams',     labelKey: 'nav.examBuilder', icon: FileText,       permission: 'exam.create' },
    ],
  },
  {
    titleKey: 'nav.sectionAdmin',
    items: [
      { to: '/admin',             labelKey: 'nav.admin',       icon: BarChart3,  permission: 'report.read' },
      { to: '/users',             labelKey: 'nav.users',       icon: Users,      permission: 'user.read' },
      { to: '/admin/departments', labelKey: 'nav.departments', icon: Building2,  permission: 'department.manage' },
      { to: '/admin/audit',       labelKey: 'nav.audit',       icon: ScrollText, permission: 'audit.read' },
      { to: '/admin/settings',    labelKey: 'nav.settings',    icon: Settings,   permission: 'settings.read' },
    ],
  },
  {
    titleKey: 'nav.sectionAccount',
    items: [
      { to: '/me/record',  labelKey: 'nav.myRecord', icon: GraduationCap, permission: null },
      { to: '/me/privacy', labelKey: 'nav.privacy',  icon: ShieldCheck,   permission: null },
    ],
  },
];

export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const brandingQuery = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
    enabled: hasPermission('settings.read'),
  });
  const mutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setUser(null);
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });

  useEffect(() => {
    if (brandingQuery.data) applyBranding(brandingQuery.data);
  }, [brandingQuery.data]);

  const visibleGroups = navGroups
    .map((group) => ({
      titleKey: group.titleKey,
      items: group.items.filter((item) => !item.permission || hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const appName = brandingQuery.data?.name ?? t('app.name');
  const logoUrl  = brandingQuery.data?.logoUrl;
  const userInitials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-5 scrollbar-warm">
      <div className="space-y-6">
        {visibleGroups.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {t(group.titleKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{t(item.labelKey)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">

      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
          ) : (
            <span>L</span>
          )}
        </div>
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">{appName}</p>
      </div>

      {nav}

      {/* User profile */}
      <div className="px-3 pb-5">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-background md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            aria-label="ปิดเมนู"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-56 flex-col border-r border-border bg-background animate-slide-in-left">
            <button
              type="button"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="md:pl-56">

        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-muted md:hidden"
            aria-label="เปิดเมนู"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="hidden md:block" />

          <div className="flex items-center gap-1">
            <NotificationsMenu />
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              {t('auth.logout')}
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 animate-page-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
