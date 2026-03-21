/**
 * Biometric authentication helpers.
 *
 * Uses the Capacitor BiometricAuth plugin on native devices.
 * Falls back gracefully on web (always returns false / unavailable).
 */

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Check whether biometric authentication (Face ID / Touch ID / fingerprint)
 * is available on this device.
 */
export async function checkBiometricAvailable(): Promise<boolean> {
  if (!isCapacitor()) return false;

  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Prompt the user for biometric authentication.
 * Resolves `true` if the user successfully authenticates, `false` otherwise.
 */
export async function authenticateWithBiometric(): Promise<boolean> {
  if (!isCapacitor()) return false;

  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');

    const available = await NativeBiometric.isAvailable();
    if (!available.isAvailable) return false;

    await NativeBiometric.verifyIdentity({
      reason: 'Authenticate to access DataForge',
      title: 'Biometric Login',
      subtitle: 'Use biometrics to unlock the app',
      description: 'Place your finger on the sensor or look at the camera.',
    });

    // If verifyIdentity resolves, authentication succeeded
    return true;
  } catch {
    // User cancelled or authentication failed
    return false;
  }
}
