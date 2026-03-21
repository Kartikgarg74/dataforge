/**
 * Capacitor plugin wrappers with lazy loading and web fallbacks.
 *
 * Plugins are dynamically imported so that the app continues to work
 * in a regular browser where Capacitor is not available.
 */

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Capacitor injects this global when running inside a native shell
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Trigger a light haptic impact on native devices. No-op on web.
 */
export async function triggerHaptic(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Plugin not installed or unavailable — ignore
  }
}

/**
 * Share content using the native share sheet.
 * Falls back to the Web Share API when available, otherwise copies to clipboard.
 */
export async function shareContent(
  text: string,
  url?: string
): Promise<void> {
  if (isCapacitor()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        text,
        url: url ?? undefined,
        dialogTitle: 'Share',
      });
      return;
    } catch {
      // fall through to web fallback
    }
  }

  // Web fallback — navigator.share or clipboard
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ text, url: url ?? undefined });
      return;
    } catch {
      // user cancelled or API unavailable
    }
  }

  // Last resort: copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
  }
}

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

/**
 * Get current network status. Returns `{ connected: true }` on web by default.
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  if (isCapacitor()) {
    try {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      return {
        connected: status.connected,
        connectionType: status.connectionType,
      };
    } catch {
      // fall through
    }
  }

  // Web fallback
  return {
    connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'unknown',
  };
}

/**
 * Request push notification permission and return the device token (native only).
 * Returns `null` on web or if permission is denied.
 */
export async function requestPushPermission(): Promise<string | null> {
  if (!isCapacitor()) {
    // Web fallback — use the Notification API if available
    if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      // Web push requires a service-worker registration; just return null here
      return result === 'granted' ? null : null;
    }
    return null;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') return null;

    await PushNotifications.register();

    return new Promise<string | null>((resolve) => {
      PushNotifications.addListener('registration', (token: any) => {
        resolve(token?.value ?? null);
      });
      PushNotifications.addListener('registrationError', () => {
        resolve(null);
      });
      // Timeout after 10 seconds
      setTimeout(() => resolve(null), 10_000);
    });
  } catch {
    return null;
  }
}
