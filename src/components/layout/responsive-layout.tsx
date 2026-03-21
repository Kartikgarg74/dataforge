'use client';

import React from 'react';
import { usePlatform } from '@/hooks/use-platform';
import { BottomNav } from '@/components/mobile/bottom-nav';
import { OfflineBanner } from '@/components/mobile/offline-banner';
import { InstallPromptBanner } from '@/components/mobile/install-prompt';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  alertCount?: number;
}

export function ResponsiveLayout({ children, alertCount }: ResponsiveLayoutProps) {
  const { isMobile, isOnline } = usePlatform();

  return (
    <div className="min-h-screen">
      <InstallPromptBanner />
      {!isOnline && <OfflineBanner />}

      {isMobile ? (
        <main
          className="pt-0"
          style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
        >
          {children}
        </main>
      ) : (
        <main>{children}</main>
      )}

      {isMobile && <BottomNav alertCount={alertCount} />}
    </div>
  );
}
