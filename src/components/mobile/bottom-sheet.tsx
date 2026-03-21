'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

type SnapPoint = 'collapsed' | 'half' | 'full';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: SnapPoint[];
}

const SNAP_HEIGHTS: Record<SnapPoint, number> = {
  collapsed: 0,
  half: 50,
  full: 90,
};

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = ['collapsed', 'half', 'full'],
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>('half');
  const [sheetHeight, setSheetHeight] = useState(SNAP_HEIGHTS.half);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Reset to half when opened
  useEffect(() => {
    if (isOpen) {
      const initialSnap = snapPoints.includes('half') ? 'half' : snapPoints[snapPoints.length - 1];
      setCurrentSnap(initialSnap);
      setSheetHeight(SNAP_HEIGHTS[initialSnap]);
    }
  }, [isOpen, snapPoints]);

  const findNearestSnap = useCallback(
    (heightPercent: number): SnapPoint => {
      let nearest = snapPoints[0];
      let minDist = Math.abs(SNAP_HEIGHTS[nearest] - heightPercent);

      for (const sp of snapPoints) {
        const dist = Math.abs(SNAP_HEIGHTS[sp] - heightPercent);
        if (dist < minDist) {
          minDist = dist;
          nearest = sp;
        }
      }
      return nearest;
    },
    [snapPoints]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      dragStartY.current = e.touches[0].clientY;
      dragStartHeight.current = sheetHeight;
    },
    [sheetHeight]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      const currentY = e.touches[0].clientY;
      const deltaY = dragStartY.current - currentY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.max(0, Math.min(95, dragStartHeight.current + deltaPercent));

      setSheetHeight(newHeight);
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged below collapsed threshold, close
    if (sheetHeight < 10) {
      onClose();
      return;
    }

    const nearest = findNearestSnap(sheetHeight);
    if (nearest === 'collapsed') {
      onClose();
    } else {
      setCurrentSnap(nearest);
      setSheetHeight(SNAP_HEIGHTS[nearest]);
    }
  }, [isDragging, sheetHeight, findNearestSnap, onClose]);

  const handleHandleTap = useCallback(() => {
    if (isDragging) return;
    // Toggle between half and full
    if (currentSnap === 'half' && snapPoints.includes('full')) {
      setCurrentSnap('full');
      setSheetHeight(SNAP_HEIGHTS.full);
    } else if (currentSnap === 'full' && snapPoints.includes('half')) {
      setCurrentSnap('half');
      setSheetHeight(SNAP_HEIGHTS.half);
    }
  }, [currentSnap, isDragging, snapPoints]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 transition-opacity duration-300"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[91] bg-white dark:bg-gray-900 flex flex-col"
        style={{
          height: `${sheetHeight}vh`,
          borderTopLeftRadius: 'var(--sheet-border-radius, 16px)',
          borderTopRightRadius: 'var(--sheet-border-radius, 16px)',
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          maxHeight: '95vh',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleHandleTap}
          role="button"
          tabIndex={0}
          aria-label="Drag to resize"
        >
          <div
            className="rounded-full bg-gray-300 dark:bg-gray-600"
            style={{
              width: 'var(--sheet-handle-width, 36px)',
              height: 'var(--sheet-handle-height, 5px)',
            }}
          />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
