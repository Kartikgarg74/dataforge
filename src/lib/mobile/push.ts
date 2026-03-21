/**
 * Push notification handling for Capacitor native apps.
 *
 * All functions are wrapped in try/catch and fall back gracefully on web.
 */

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export interface PushNotification {
  id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface PushActionPerformed {
  actionId: string;
  notification: PushNotification;
}

/**
 * Register for push notifications, obtain the device token, and persist it
 * on the server so we can send pushes later.
 *
 * On web this is a no-op that returns `null`.
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isCapacitor()) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') return null;

    await PushNotifications.register();

    const token = await new Promise<string | null>((resolve) => {
      PushNotifications.addListener('registration', (t: any) => resolve(t?.value ?? null));
      PushNotifications.addListener('registrationError', () => resolve(null));
      setTimeout(() => resolve(null), 10_000);
    });

    if (token) {
      await storeTokenOnServer(token);
    }

    // Wire up notification listeners
    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      handlePushReceived({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        data: notification.data as Record<string, unknown>,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      handlePushActionPerformed({
        actionId: action.actionId,
        notification: {
          id: action.notification.id,
          title: action.notification.title,
          body: action.notification.body,
          data: action.notification.data as Record<string, unknown>,
        },
      });
    });

    return token;
  } catch (err) {
    console.warn('[push] Failed to register push notifications:', err);
    return null;
  }
}

/**
 * Handle an incoming push notification while the app is in the foreground.
 */
export function handlePushReceived(notification: PushNotification): void {
  try {
    console.log('[push] Notification received:', notification.title);

    // If running on web, show a browser notification as fallback
    if (!isCapacitor() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(notification.title ?? 'DataForge', {
        body: notification.body ?? '',
      });
    }

    // You can dispatch to a global event bus or state store here.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('push:received', { detail: notification })
      );
    }
  } catch (err) {
    console.warn('[push] Error handling push notification:', err);
  }
}

/**
 * Handle a notification tap / action. Typically used for deep linking.
 */
export function handlePushActionPerformed(action: PushActionPerformed): void {
  try {
    console.log('[push] Action performed:', action.actionId);

    const deepLink = action.notification.data?.url as string | undefined;
    if (deepLink && typeof window !== 'undefined') {
      // Navigate using Next.js router or plain location
      window.dispatchEvent(
        new CustomEvent('push:action', { detail: { ...action, deepLink } })
      );

      // Fallback: direct navigation
      if (deepLink.startsWith('/')) {
        window.location.href = deepLink;
      }
    }
  } catch (err) {
    console.warn('[push] Error handling push action:', err);
  }
}

/**
 * Persist the device push token on the backend so we can target this device.
 */
async function storeTokenOnServer(token: string): Promise<void> {
  try {
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: getPlatform() }),
    });
  } catch (err) {
    console.warn('[push] Failed to store push token on server:', err);
  }
}

function getPlatform(): string {
  if (typeof window === 'undefined') return 'unknown';
  try {
    return (window as any).Capacitor?.getPlatform?.() ?? 'web';
  } catch {
    return 'web';
  }
}
