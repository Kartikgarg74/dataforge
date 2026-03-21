'use client';

import { useState, useEffect, useCallback } from 'react';

interface PlatformState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isOnline: boolean;
}

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

function getInitialState(): PlatformState {
  if (typeof window === 'undefined') {
    return { isMobile: false, isTablet: false, isDesktop: true, isOnline: true };
  }
  return {
    isMobile: window.matchMedia(MOBILE_QUERY).matches,
    isTablet: window.matchMedia(TABLET_QUERY).matches,
    isDesktop: window.matchMedia(DESKTOP_QUERY).matches,
    isOnline: navigator.onLine,
  };
}

export function usePlatform(): PlatformState {
  const [state, setState] = useState<PlatformState>(getInitialState);

  useEffect(() => {
    const mobileMedia = window.matchMedia(MOBILE_QUERY);
    const tabletMedia = window.matchMedia(TABLET_QUERY);
    const desktopMedia = window.matchMedia(DESKTOP_QUERY);

    const updateViewport = () => {
      setState((prev) => ({
        ...prev,
        isMobile: mobileMedia.matches,
        isTablet: tabletMedia.matches,
        isDesktop: desktopMedia.matches,
      }));
    };

    mobileMedia.addEventListener('change', updateViewport);
    tabletMedia.addEventListener('change', updateViewport);
    desktopMedia.addEventListener('change', updateViewport);

    return () => {
      mobileMedia.removeEventListener('change', updateViewport);
      tabletMedia.removeEventListener('change', updateViewport);
      desktopMedia.removeEventListener('change', updateViewport);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
}

export function useOnlineStatus(): boolean {
  const { isOnline } = usePlatform();
  return isOnline;
}
