/**
 * Type stubs for Capacitor plugins.
 * These are declared as modules so TypeScript doesn't complain about missing types.
 * When @capacitor/* packages are installed, their real types will override these.
 */

declare module '@capacitor/haptics' {
  export const Haptics: {
    impact(options: { style: unknown }): Promise<void>;
    notification(options: { type: unknown }): Promise<void>;
    selectionStart(): Promise<void>;
    selectionChanged(): Promise<void>;
    selectionEnd(): Promise<void>;
  };
  export const ImpactStyle: { Heavy: string; Medium: string; Light: string };
  export const NotificationType: { Success: string; Warning: string; Error: string };
}

declare module '@capacitor/share' {
  export const Share: {
    share(options: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<void>;
  };
}

declare module '@capacitor/network' {
  export const Network: {
    getStatus(): Promise<{ connected: boolean; connectionType: string }>;
    addListener(event: string, callback: (status: { connected: boolean }) => void): Promise<{ remove: () => void }>;
  };
}

declare module '@capacitor/push-notifications' {
  export const PushNotifications: {
    requestPermissions(): Promise<{ receive: string }>;
    register(): Promise<void>;
    addListener(event: string, callback: (data: unknown) => void): Promise<{ remove: () => void }>;
    getDeliveredNotifications(): Promise<{ notifications: unknown[] }>;
  };
}

declare module '@capacitor/app' {
  export const App: {
    addListener(event: string, callback: (data: { url: string }) => void): Promise<{ remove: () => void }>;
    getLaunchUrl(): Promise<{ url: string } | null>;
  };
}

declare module '@capacitor/core' {
  export const Capacitor: {
    isNativePlatform(): boolean;
    getPlatform(): string;
    isPluginAvailable(name: string): boolean;
  };
}

declare module '@capacitor-community/speech-recognition' {
  export const SpeechRecognition: {
    available(): Promise<{ available: boolean }>;
    requestPermissions(): Promise<void>;
    start(options: { language: string; partialResults: boolean }): Promise<{ matches: string[] }>;
    stop(): Promise<{ matches: string[] }>;
    addListener(event: string, callback: (data: { matches: string[] }) => void): Promise<{ remove: () => void }>;
  };
}

declare module 'capacitor-native-biometric' {
  export const NativeBiometric: {
    isAvailable(): Promise<{ isAvailable: boolean; biometryType: number }>;
    verifyIdentity(options: { reason: string; title: string; subtitle?: string; description?: string }): Promise<void>;
  };
}

declare module '@capacitor/cli' {
  export interface CapacitorConfig {
    appId: string;
    appName: string;
    webDir: string;
    [key: string]: unknown;
  }
}

declare module '@capacitor/background-runner' {
  export const BackgroundRunner: {
    dispatchEvent(options: {
      label: string;
      event: string;
      details: Record<string, unknown>;
    }): Promise<void>;
    registerBackgroundTask(options: {
      label: string;
      src: string;
      event: string;
      repeat: boolean;
      interval: number;
    }): Promise<void>;
  };
}

declare module 'capacitor-siri-shortcuts' {
  export const SiriShortcuts: {
    donate(options: {
      persistentIdentifier: string;
      title: string;
      suggestedInvocationPhrase?: string;
      userInfo?: Record<string, unknown>;
    }): Promise<void>;
    getShortcuts(): Promise<{
      shortcuts: Array<{
        persistentIdentifier: string;
        title: string;
        userInfo?: Record<string, unknown>;
      }>;
    }>;
    delete(options: { identifiers: string[] }): Promise<void>;
  };
}
