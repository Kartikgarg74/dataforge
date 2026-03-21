'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, Maximize2 } from 'lucide-react';

interface LongPressTooltip {
  x: number;
  y: number;
  value: string;
}

interface MobileChartProps {
  children: React.ReactNode;
  title?: string;
  onExpand?: () => void;
  className?: string;
}

export function MobileChart({ children, title, onExpand, className = '' }: MobileChartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [longPressTooltip, setLongPressTooltip] = useState<LongPressTooltip | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      // Find the nearest data element under the touch point
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      let dataValue = '';

      if (target) {
        // Try to extract data from common chart element attributes
        dataValue =
          target.getAttribute('data-value') ||
          target.getAttribute('aria-label') ||
          target.textContent?.trim() ||
          '';
      }

      if (dataValue) {
        setLongPressTooltip({
          x: touch.clientX,
          y: touch.clientY - 50,
          value: dataValue,
        });
      }
    }, 500);
  }, []);

  const handleTouchMove = useCallback(() => {
    // Clear timer if user moves finger (not a long press)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLongPressTooltip(null);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Dismiss tooltip after a delay
    setTimeout(() => setLongPressTooltip(null), 1500);
  }, []);

  const handleExpand = () => {
    setIsExpanded(true);
    onExpand?.();
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  return (
    <>
      <div
        className={`relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${className}`}
      >
        {/* Title bar */}
        {title && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h3>
            {/* Expand button - only visible on mobile */}
            <button
              onClick={handleExpand}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Expand chart"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chart content with long-press support */}
        <div
          className="w-full relative"
          style={{
            height: 'var(--chart-height-mobile, 220px)',
            touchAction: 'pan-x pan-y',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
          {/* Long-press tooltip overlay */}
          {longPressTooltip && (
            <div
              className="fixed z-[200] px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium rounded-lg shadow-lg pointer-events-none"
              style={{
                left: `${longPressTooltip.x}px`,
                top: `${longPressTooltip.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {longPressTooltip.value}
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-100"
              />
            </div>
          )}
        </div>

        {/* Expand button when no title (floating) */}
        {!title && (
          <button
            onClick={handleExpand}
            className="md:hidden absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-lg bg-white/80 dark:bg-gray-900/80 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors backdrop-blur-sm"
            aria-label="Expand chart"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isExpanded && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          {/* Overlay header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 safe-area-top">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title || 'Chart'}
            </h3>
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close fullscreen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Expanded chart content */}
          <div
            className="flex-1 p-4 safe-area-bottom"
            style={{ touchAction: 'pan-x pan-y' }}
          >
            {children}
          </div>
        </div>
      )}
    </>
  );
}
