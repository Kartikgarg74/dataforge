'use client';

import React, { useState, useCallback, useRef } from 'react';
import { startListening, stopListening } from '@/lib/mobile/voice-input';

interface VoiceInputProps {
  /** Called with the transcribed text when speech recognition completes */
  onTranscript: (text: string) => void;
  /** Optional class name for the button */
  className?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, className, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listeningRef = useRef(false);

  const toggle = useCallback(async () => {
    if (listeningRef.current) {
      // Stop current session
      stopListening();
      listeningRef.current = false;
      setListening(false);
      return;
    }

    setError(null);
    setListening(true);
    listeningRef.current = true;

    try {
      const transcript = await startListening();
      if (transcript && listeningRef.current) {
        onTranscript(transcript);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speech recognition failed';
      setError(message);
      console.warn('[VoiceInput]', message);
    } finally {
      listeningRef.current = false;
      setListening(false);
    }
  }, [onTranscript]);

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={listening ? 'Stop listening' : 'Start voice input'}
        className={[
          'relative flex items-center justify-center rounded-full p-3 transition-colors',
          listening
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Pulsing ring while listening */}
        {listening && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
        )}

        {/* Microphone icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </button>

      {listening && (
        <span className="text-xs font-medium text-red-500 animate-pulse">
          Listening...
        </span>
      )}

      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
