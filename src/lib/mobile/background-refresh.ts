/**
 * Background refresh for dashboard data.
 *
 * On Capacitor native apps, uses the Background Runner plugin to periodically
 * refresh dashboard data. On web, attempts to use the Periodic Background Sync
 * API via the service worker. Falls back gracefully on unsupported platforms.
 */

const REFRESH_INTERVAL_KEY = 'dataforge:bg-refresh-interval';
const LAST_REFRESH_KEY = 'dataforge:bg-refresh-last';

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Configure background refresh for the given dashboard IDs.
 *
 * On Capacitor native, registers a background task via `@capacitor/background-runner`.
 * On web, attempts `periodicSync` registration via the service worker.
 * No-op on unsupported platforms.
 */
export function setupBackgroundRefresh(dashboardIds: string[]): void {
  if (typeof window === 'undefined') return;

  // Persist the dashboard list so the background task knows what to refresh
  try {
    localStorage.setItem('dataforge:bg-refresh-dashboards', JSON.stringify(dashboardIds));
  } catch {
    // localStorage unavailable
  }

  if (isCapacitor()) {
    setupCapacitorBackgroundRefresh(dashboardIds);
  } else {
    setupWebPeriodicSync();
  }
}

/**
 * Returns the timestamp of the last successful background refresh,
 * or `null` if no refresh has been recorded.
 */
export function getLastRefreshTime(): Date | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(LAST_REFRESH_KEY);
    if (!stored) return null;
    const ts = parseInt(stored, 10);
    if (isNaN(ts)) return null;
    return new Date(ts);
  } catch {
    return null;
  }
}

/**
 * Set the background refresh interval in minutes.
 * Valid values: 15, 30, 60, 240. Other values are clamped to the nearest option.
 */
export function setRefreshInterval(minutes: number): void {
  if (typeof window === 'undefined') return;

  const clamped = Math.max(15, Math.min(240, minutes));

  try {
    localStorage.setItem(REFRESH_INTERVAL_KEY, String(clamped));
  } catch {
    // localStorage unavailable
  }

  // Re-register with the new interval if dashboards are configured
  try {
    const dashboards = localStorage.getItem('dataforge:bg-refresh-dashboards');
    if (dashboards) {
      const ids = JSON.parse(dashboards) as string[];
      setupBackgroundRefresh(ids);
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Internal: record a successful refresh
// ---------------------------------------------------------------------------

export function recordRefresh(): void {
  try {
    localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Capacitor Background Runner
// ---------------------------------------------------------------------------

async function setupCapacitorBackgroundRefresh(_dashboardIds: string[]): Promise<void> {
  try {
    const { BackgroundRunner } = await import('@capacitor/background-runner');

    const intervalMs = getIntervalMs();

    await BackgroundRunner.dispatchEvent({
      label: 'co.dataforge.background',
      event: 'scheduleDashboardRefresh',
      details: {
        dashboardIds: _dashboardIds,
        intervalMs,
      },
    });
  } catch (err) {
    console.warn('[background-refresh] Capacitor background runner not available:', err);
  }
}

// ---------------------------------------------------------------------------
// Web Periodic Background Sync
// ---------------------------------------------------------------------------

async function setupWebPeriodicSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    // periodicSync is not universally available
    const periodicSync = (registration as any).periodicSync;
    if (!periodicSync) {
      console.info('[background-refresh] Periodic Background Sync API not supported in this browser.');
      return;
    }

    const intervalMs = getIntervalMs();

    await periodicSync.register('dataforge-dashboard-refresh', {
      minInterval: intervalMs,
    });
  } catch (err) {
    console.warn('[background-refresh] Failed to register periodic sync:', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIntervalMs(): number {
  try {
    const stored = localStorage.getItem(REFRESH_INTERVAL_KEY);
    if (stored) {
      const minutes = parseInt(stored, 10);
      if (!isNaN(minutes) && minutes > 0) {
        return minutes * 60 * 1000;
      }
    }
  } catch {
    // ignore
  }
  // Default: 30 minutes
  return 30 * 60 * 1000;
}
