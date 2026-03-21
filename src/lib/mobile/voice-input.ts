/**
 * Speech-to-text abstraction.
 *
 * Uses the Capacitor Speech Recognition plugin on native devices
 * and falls back to the Web Speech API in browsers that support it.
 */

function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

// Keep a handle so we can stop listening later
let webRecognition: any = null;
let nativeListening = false;

/**
 * Start speech recognition and resolve with the transcribed text
 * once the user stops speaking (or an error occurs).
 */
export async function startListening(): Promise<string> {
  if (isCapacitor()) {
    return startNativeListening();
  }
  return startWebListening();
}

/**
 * Abort any in-progress speech recognition session.
 */
export function stopListening(): void {
  // Web
  if (webRecognition) {
    try {
      webRecognition.abort();
    } catch {
      // ignore
    }
    webRecognition = null;
  }

  // Native
  if (nativeListening) {
    stopNativeListening();
  }
}

// ---------------------------------------------------------------------------
// Native (Capacitor Speech Recognition plugin)
// ---------------------------------------------------------------------------

async function startNativeListening(): Promise<string> {
  try {
    const { SpeechRecognition } = await import(
      '@capacitor-community/speech-recognition'
    );

    await SpeechRecognition.requestPermissions();

    nativeListening = true;

    const result = await SpeechRecognition.start({
      language: 'en-US',
      partialResults: false,
    });

    nativeListening = false;
    return result.matches?.[0] ?? '';
  } catch (err) {
    nativeListening = false;
    console.warn('[voice] Native speech recognition failed, trying web fallback:', err);
    return startWebListening();
  }
}

async function stopNativeListening(): Promise<void> {
  try {
    const { SpeechRecognition } = await import(
      '@capacitor-community/speech-recognition'
    );
    await SpeechRecognition.stop();
  } catch {
    // ignore
  }
  nativeListening = false;
}

// ---------------------------------------------------------------------------
// Web (Web Speech API)
// ---------------------------------------------------------------------------

function startWebListening(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionCtor) {
      reject(new Error('Speech recognition is not supported in this browser'));
      return;
    }

    const recognition: any = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    webRecognition = recognition;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      webRecognition = null;
      resolve(transcript);
    };

    recognition.onerror = (event: any) => {
      webRecognition = null;
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      // If we reach here without a result, resolve with empty string
      webRecognition = null;
      resolve('');
    };

    recognition.start();
  });
}
