/**
 * Siri Shortcut integration for iOS.
 *
 * Allows users to register Siri shortcuts that open the app and pre-fill
 * a chat query. Uses the Capacitor Siri Shortcuts plugin on native iOS.
 * No-op on web and Android.
 */

function isCapacitorIOS(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as any).Capacitor;
    return cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios';
  } catch {
    return false;
  }
}

/**
 * Register a Siri shortcut that opens DataForge and pre-fills the given query.
 *
 * @param query - The natural language query to pre-fill in the chat input.
 * @param title - A human-readable title for the shortcut (shown in Siri settings).
 */
export async function registerSiriShortcut(
  query: string,
  title: string
): Promise<void> {
  if (!isCapacitorIOS()) return;

  try {
    const { SiriShortcuts } = await import('capacitor-siri-shortcuts');

    await SiriShortcuts.donate({
      persistentIdentifier: `dataforge-query-${encodeURIComponent(title)}`,
      title,
      suggestedInvocationPhrase: title,
      userInfo: {
        query,
        action: 'prefill-chat',
      },
    });
  } catch (err) {
    console.warn('[siri-shortcuts] Failed to register shortcut:', err);
  }
}

/**
 * Retrieve all registered Siri shortcuts for DataForge.
 *
 * Returns an empty array on web/Android or if the plugin is unavailable.
 */
export async function getSiriShortcuts(): Promise<
  Array<{ title: string; query: string }>
> {
  if (!isCapacitorIOS()) return [];

  try {
    const { SiriShortcuts } = await import('capacitor-siri-shortcuts');

    const result = await SiriShortcuts.getShortcuts();

    return (result.shortcuts ?? []).map((s: any) => ({
      title: s.title ?? '',
      query: s.userInfo?.query ?? '',
    }));
  } catch (err) {
    console.warn('[siri-shortcuts] Failed to get shortcuts:', err);
    return [];
  }
}

/**
 * Remove a previously registered Siri shortcut by title.
 *
 * No-op on web/Android or if the plugin is unavailable.
 */
export async function removeSiriShortcut(title: string): Promise<void> {
  if (!isCapacitorIOS()) return;

  try {
    const { SiriShortcuts } = await import('capacitor-siri-shortcuts');

    await SiriShortcuts.delete({
      identifiers: [`dataforge-query-${encodeURIComponent(title)}`],
    });
  } catch (err) {
    console.warn('[siri-shortcuts] Failed to remove shortcut:', err);
  }
}
