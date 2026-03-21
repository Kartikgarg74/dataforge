'use client';

import React, { useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-platform';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  if (isOnline || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/80 border-b border-amber-300 dark:border-amber-700">
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-4 h-4 text-amber-700 dark:text-amber-300 flex-shrink-0" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200 truncate">
          You&apos;re offline &mdash; showing cached data
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-1 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
        aria-label="Dismiss offline banner"
      >
        <X className="w-4 h-4 text-amber-700 dark:text-amber-300" />
      </button>
    </div>
  );
}
