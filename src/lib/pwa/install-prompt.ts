interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installable = false;

/**
 * Initialize install prompt listener.
 * Call this once on app mount (client-side only).
 */
export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installable = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installable = false;
    console.log('[PWA] App was installed.');
  });
}

/**
 * Show the browser's native install prompt.
 * Returns true if the user accepted the install.
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available.');
    return false;
  }

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  deferredPrompt = null;
  installable = outcome !== 'accepted';

  return outcome === 'accepted';
}

/**
 * Whether the app can currently be installed (i.e., the browser
 * has fired beforeinstallprompt and the user hasn't dismissed/installed yet).
 */
export function isInstallable(): boolean {
  return installable;
}

/**
 * Check if the app is currently running as an installed PWA
 * (standalone or fullscreen display mode).
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone: boolean }).standalone === true)
  );
}
