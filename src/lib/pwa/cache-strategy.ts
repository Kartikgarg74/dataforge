const DATA_CACHE = 'dataforge-data-v1';
const DASHBOARD_CACHE_PREFIX = 'dashboard:';
const OFFLINE_DASHBOARD_CACHE = 'dataforge-offline-dashboards-v1';
const OFFLINE_DASHBOARD_PREFIX = 'dataforge-dashboard-';
const MAX_OFFLINE_DASHBOARDS = 5;

/**
 * Clear all caches managed by the service worker.
 */
export async function clearAllCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  console.log('[Cache] All caches cleared.');
}

/**
 * Get the total size of all caches in bytes.
 */
export async function getCacheSize(): Promise<number> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage ?? 0;
  }

  // Fallback: manually sum response sizes across all caches
  let totalSize = 0;
  const keys = await caches.keys();

  for (const key of keys) {
    const cache = await caches.open(key);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

/**
 * Cache dashboard data for offline access.
 */
export async function cacheDashboardData(
  dashboardId: string,
  data: unknown,
): Promise<void> {
  const cache = await caches.open(DATA_CACHE);
  const key = `${DASHBOARD_CACHE_PREFIX}${dashboardId}`;
  const response = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'X-Cached-At': new Date().toISOString(),
    },
  });
  await cache.put(new Request(key), response);
}

/**
 * Retrieve cached dashboard data.
 * Returns null if not found in cache.
 */
export async function getCachedDashboardData<T = unknown>(
  dashboardId: string,
): Promise<T | null> {
  const cache = await caches.open(DATA_CACHE);
  const key = `${DASHBOARD_CACHE_PREFIX}${dashboardId}`;
  const response = await cache.match(new Request(key));

  if (!response) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Cache a full dashboard (config + widget results) for offline viewing.
 * Evicts the oldest dashboard when the maximum of 5 is exceeded.
 */
export async function cacheDashboardForOffline(
  dashboardId: string,
  dashboardData: unknown,
  widgetResults: Record<string, unknown[]>,
): Promise<void> {
  const cache = await caches.open(OFFLINE_DASHBOARD_CACHE);
  const key = `${OFFLINE_DASHBOARD_PREFIX}${dashboardId}`;

  const payload = {
    dashboard: dashboardData,
    widgets: widgetResults,
    cachedAt: new Date().toISOString(),
  };

  const response = new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'X-Cached-At': payload.cachedAt,
    },
  });

  await cache.put(new Request(key), response);

  // Enforce max dashboards limit – evict oldest when exceeded
  const allRequests = await cache.keys();
  const dashboardRequests = allRequests.filter((r) =>
    r.url.includes(OFFLINE_DASHBOARD_PREFIX) || new URL(r.url, 'https://localhost').pathname.includes(OFFLINE_DASHBOARD_PREFIX)
  );

  if (dashboardRequests.length > MAX_OFFLINE_DASHBOARDS) {
    // Find the oldest entries by their X-Cached-At header
    const entries: { request: Request; cachedAt: string }[] = [];

    for (const req of dashboardRequests) {
      const resp = await cache.match(req);
      const cachedAt = resp?.headers.get('X-Cached-At') || '1970-01-01T00:00:00.000Z';
      entries.push({ request: req, cachedAt });
    }

    entries.sort((a, b) => a.cachedAt.localeCompare(b.cachedAt));

    const toEvict = entries.slice(0, entries.length - MAX_OFFLINE_DASHBOARDS);
    for (const entry of toEvict) {
      await cache.delete(entry.request);
    }
  }
}

/**
 * Retrieve a cached offline dashboard by ID.
 * Returns the dashboard config and widget results, or null if not cached.
 */
export async function getOfflineDashboard(
  dashboardId: string,
): Promise<{ dashboard: unknown; widgets: Record<string, unknown[]> } | null> {
  const cache = await caches.open(OFFLINE_DASHBOARD_CACHE);
  const key = `${OFFLINE_DASHBOARD_PREFIX}${dashboardId}`;
  const response = await cache.match(new Request(key));

  if (!response) return null;

  try {
    const data = await response.json();
    return {
      dashboard: data.dashboard,
      widgets: data.widgets,
    };
  } catch {
    return null;
  }
}

/**
 * List all dashboard IDs that have been cached for offline viewing.
 */
export async function listOfflineDashboards(): Promise<string[]> {
  const cache = await caches.open(OFFLINE_DASHBOARD_CACHE);
  const requests = await cache.keys();
  const ids: string[] = [];

  for (const req of requests) {
    // Extract ID from the request URL/key
    const url = req.url;
    const idx = url.indexOf(OFFLINE_DASHBOARD_PREFIX);
    if (idx !== -1) {
      ids.push(url.substring(idx + OFFLINE_DASHBOARD_PREFIX.length));
    }
  }

  return ids;
}
