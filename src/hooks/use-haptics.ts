'use client';

import { useCallback } from 'react';

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Hook that provides haptic feedback helpers.
 *
 * On native (Capacitor), triggers real haptic feedback via the device motor.
 * On web, every function is a no-op.
 *
 * Usage:
 * ```tsx
 * const { impact, notification, selection } = useHaptics();
 * <button onClick={() => { impact(); doSomething(); }}>Tap</button>
 * ```
 */
export function useHaptics() {
  const impact = useCallback(async () => {
    if (!isCapacitor()) return;
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // ignore
    }
  }, []);

  const notification = useCallback(async () => {
    if (!isCapacitor()) return;
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // ignore
    }
  }, []);

  const selection = useCallback(async () => {
    if (!isCapacitor()) return;
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch {
      // ignore
    }
  }, []);

  return { impact, notification, selection } as const;
}
