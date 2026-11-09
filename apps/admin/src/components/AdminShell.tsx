'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Cpu,
  Sparkles,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { title: 'Overview', href: '/', icon: LayoutDashboard },
  { title: 'Dataset', href: '/feedback', icon: Sparkles },
  { title: 'Models', href: '/models', icon: Cpu },
  { title: 'Disputes', href: '/disputes', icon: AlertTriangle },
];

export function AdminShell({
  children,
  topBar,
}: {
  children: React.ReactNode;
  topBar?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-7 w-7 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-border/80 rounded-3xl p-8 text-center shadow-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="SnapPick" width={56} height={56} className="mx-auto mb-4" />
          <h2 className="text-xl font-black text-ink mb-1">Admin Access Only</h2>
          <p className="text-xs text-muted-foreground mb-6">
            {user
              ? 'This account does not have administrator privileges.'
              : 'Sign in with an admin account to access the control panel.'}
          </p>
          <div className="space-y-2">
            <Button onClick={() => router.push('/login')} className="w-full rounded-xl font-bold">
              Sign In
            </Button>
            {user && (
              <Button
                variant="outline"
                onClick={() => void signOut()}
                className="w-full rounded-xl"
              >
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
      <aside className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-border/80 shrink-0 flex flex-col md:sticky md:top-0 md:h-screen">
        {/* Brand */}
        <div className="pt-6 pb-3 md:pb-6 px-6 flex items-center justify-center">
          <Link href="/" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-full.svg"
              alt="SnapPick"
              className="h-8 w-auto object-contain mx-auto"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="md:flex-1 px-3 pb-3 md:pb-0 flex md:flex-col gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 h-11 px-3 rounded-2xl text-sm font-bold transition-colors shrink-0',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="flex items-center justify-between gap-2 p-3 m-3 rounded-2xl bg-secondary/40">
          <div className="text-xs font-bold text-foreground truncate flex-1">{user.email}</div>
          <button
            onClick={() => void signOut()}
            title="Sign Out"
            aria-label="Sign out"
            className="h-8 w-8 rounded-xl bg-white hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {topBar && <div className="w-full shrink-0">{topBar}</div>}
        <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
