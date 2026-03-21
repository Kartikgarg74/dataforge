/**
 * Universal / deep link handling for Capacitor native apps.
 *
 * Listens for `appUrlOpen` events and routes them through Next.js navigation.
 */

// Using AppRouterInstance from next/navigation instead of internal module
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export interface ParsedDeepLink {
  /** The path portion of the deep link, e.g. "/public/d/abc123" */
  path: string;
  /** Query parameters parsed from the URL */
  params: Record<string, string>;
  /** The raw URL string */
  raw: string;
}

/**
 * Parse a deep link URL into a route path and query parameters.
 *
 * Examples:
 *   https://dataforge.dev/public/d/abc123?view=chart
 *   → { path: "/public/d/abc123", params: { view: "chart" }, raw: "..." }
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  try {
    const parsed = new URL(url);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return {
      path: parsed.pathname,
      params,
      raw: url,
    };
  } catch {
    // If parsing fails, treat the whole string as a path
    return { path: url, params: {}, raw: url };
  }
}

/**
 * Set up deep link listening.
 *
 * Call this once during app initialisation (e.g. in a top-level layout effect).
 * Pass the Next.js `router` from `useRouter()` so we can navigate.
 *
 * Returns a cleanup function that removes the listener.
 */
export async function setupDeepLinks(
  router: Pick<AppRouterInstance, 'push' | 'replace'>
): Promise<() => void> {
  if (!isCapacitor()) {
    // On web, nothing to do — the browser handles URL navigation natively.
    return () => {};
  }

  try {
    const { App } = await import('@capacitor/app');

    const handle = await App.addListener('appUrlOpen', (event) => {
      const { path, params } = parseDeepLink(event.url);

      console.log('[deep-links] Navigating to', path, params);

      // Build a path with query string
      const query = new URLSearchParams(params).toString();
      const destination = query ? `${path}?${query}` : path;

      router.push(destination);
    });

    return () => {
      handle.remove();
    };
  } catch (err) {
    console.warn('[deep-links] Failed to set up deep link listener:', err);
    return () => {};
  }
}
