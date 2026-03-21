export {
  registerServiceWorker,
  unregisterServiceWorker,
  isServiceWorkerSupported,
  onUpdateAvailable,
  skipWaitingOnUpdate,
} from './service-worker';

export {
  initInstallPrompt,
  showInstallPrompt,
  isInstallable,
  isPWA,
} from './install-prompt';

export {
  clearAllCaches,
  getCacheSize,
  cacheDashboardData,
  getCachedDashboardData,
  cacheDashboardForOffline,
  getOfflineDashboard,
  listOfflineDashboards,
} from './cache-strategy';
