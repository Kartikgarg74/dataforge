'use client';

import { useEffect } from 'react';
import { registerServiceWorker, initInstallPrompt } from '@/lib/pwa';

export function PWARegistration() {
  useEffect(() => {
    registerServiceWorker();
    initInstallPrompt();
  }, []);

  return null;
}
