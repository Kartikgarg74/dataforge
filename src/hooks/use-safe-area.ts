'use client';

import { useState, useEffect } from 'react';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Hook that reads the device safe-area insets via CSS `env()` values.
 *
 * On devices with notches / dynamic islands the insets will be non-zero.
 * On regular browsers they default to 0.
 *
 * Make sure your HTML includes `<meta name="viewport" content="viewport-fit=cover">` for
 * `env(safe-area-inset-*)` to report real values.
 *
 * Usage:
 * ```tsx
 * const { top, bottom } = useSafeArea();
 * <div style={{ paddingTop: top, paddingBottom: bottom }}>...</div>
 * ```
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    function measure() {
      if (typeof document === 'undefined') return;

      // Create a temporary element that uses the CSS env() values
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      el.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
      el.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
      el.style.paddingRight = 'env(safe-area-inset-right, 0px)';
      document.body.appendChild(el);

      const computed = getComputedStyle(el);
      setInsets({
        top: parseFloat(computed.paddingTop) || 0,
        bottom: parseFloat(computed.paddingBottom) || 0,
        left: parseFloat(computed.paddingLeft) || 0,
        right: parseFloat(computed.paddingRight) || 0,
      });

      document.body.removeChild(el);
    }

    measure();

    // Re-measure on resize / orientation change
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return insets;
}
