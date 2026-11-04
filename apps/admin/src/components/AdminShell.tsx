'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Cpu,
  MessageSquareDiff,
  AlertTriangle,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { title: 'Overview', href: '/', icon: LayoutDashboard },
  { title: 'Feedback', href: '/feedback', icon: MessageSquareDiff },
  { title: 'Models', href: '/models', icon: Cpu },
  { title: 'Disputes', href: '/disputes', icon: AlertTriangle },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-border rounded-3xl p-8 text-center shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">Admin Only</h2>
          <p className="text-xs text-muted-foreground mb-6">
            {user ? 'This account lacks admin access.' : 'Sign in to access the admin panel.'}
          </p>
          <div className="space-y-2">
            <Button onClick={() => router.push('/login')} className="w-full">
              Sign In
            </Button>
            {user && (
              <Button variant="outline" onClick={() => void signOut()} className="w-full">
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-border shrink-0 flex flex-col">
        {/* Brand */}
        <div className="p-5 border-b border-border/70 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-ink">SnapPick</span>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase">
                Admin
              </span>
            </div>
            <div className="h-0.5 w-6 rounded-full bg-primary mt-1" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all',
                  active
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'text-foreground hover:bg-muted/60'
                )}
              >
                <Icon size={16} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* User & Sign Out */}
        <div className="p-3 border-t border-border/70 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground truncate">{user.email}</span>
          <button
            onClick={() => void signOut()}
            title="Sign Out"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
