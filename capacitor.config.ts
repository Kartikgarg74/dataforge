// Capacitor config — requires @capacitor/cli to be installed
// Install with: npm install @capacitor/cli @capacitor/core

interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
  server?: Record<string, unknown>;
}

const config: CapacitorConfig = {
  appId: 'dev.dataforge.app',
  appName: 'DataForge',
  webDir: 'out',
  bundledWebRuntime: false,
  ios: {
    scheme: 'DataForge',
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
    captureInput: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'light',
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#ffffff',
    },
  },
  server: {
    url: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined,
    cleartext: process.env.NODE_ENV === 'development',
  },
};

export default config;
