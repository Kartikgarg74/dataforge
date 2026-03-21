'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { usePlatform } from '@/hooks/use-platform';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isMobile } = usePlatform();

  if (isMobile) {
    // Mobile: no sidebar, bottom nav handled by ResponsiveLayout
    return (
      <div className="flex flex-col h-screen">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
    </div>
  );
}
