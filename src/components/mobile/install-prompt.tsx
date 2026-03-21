'use client';

import { useCallback, useEffect, useState } from 'react';
import { isInstallable, isPWA, showInstallPrompt } from '@/lib/pwa';

const DISMISS_KEY = 'dataforge-install-dismissed';

export function InstallPromptBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isPWA()) return;

    // Don't show if previously dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Poll for installability (beforeinstallprompt is async)
    const interval = setInterval(() => {
      if (isInstallable()) {
        setVisible(true);
        clearInterval(interval);
      }
    }, 1000);

    // Stop polling after 30 seconds
    const timeout = setTimeout(() => clearInterval(interval), 30_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const accepted = await showInstallPrompt();
    if (accepted) {
      setVisible(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-blue-200 bg-white p-4 shadow-lg dark:border-blue-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Add DataForge to Home Screen
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Install for quick access and offline support.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss install prompt"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleDismiss}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          Install
        </button>
      </div>
    </div>
  );
}
