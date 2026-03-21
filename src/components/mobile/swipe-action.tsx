'use client';

import React, { useState, useRef, useCallback } from 'react';

interface SwipeActionProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  children: React.ReactNode;
  threshold?: number;
}

export function SwipeAction({
  onSwipeLeft,
  onSwipeRight,
  leftContent,
  rightContent,
  children,
  threshold = 80,
}: SwipeActionProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
  }, [isAnimating]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null || isAnimating) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startX.current;
      const diffY = currentY - startY.current;

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
          isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
        }
        return;
      }

      if (!isHorizontalSwipe.current) return;

      // Only allow swipe in directions that have handlers
      if (diffX < 0 && !onSwipeLeft && !rightContent) return;
      if (diffX > 0 && !onSwipeRight && !leftContent) return;

      // Apply resistance past threshold
      const maxSwipe = threshold * 1.5;
      let clampedX: number;
      if (Math.abs(diffX) > threshold) {
        const excess = Math.abs(diffX) - threshold;
        const dampened = threshold + excess * 0.3;
        clampedX = diffX > 0 ? Math.min(dampened, maxSwipe) : Math.max(-dampened, -maxSwipe);
      } else {
        clampedX = diffX;
      }

      setTranslateX(clampedX);
    },
    [isAnimating, onSwipeLeft, onSwipeRight, leftContent, rightContent, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    if (startX.current === null || isAnimating) return;

    setIsAnimating(true);

    if (translateX < -threshold && (onSwipeLeft || rightContent)) {
      // Swiped left past threshold
      setTranslateX(-threshold);
      onSwipeLeft?.();
      // Spring back after action
      setTimeout(() => {
        setTranslateX(0);
        setIsAnimating(false);
      }, 300);
    } else if (translateX > threshold && (onSwipeRight || leftContent)) {
      // Swiped right past threshold
      setTranslateX(threshold);
      onSwipeRight?.();
      // Spring back after action
      setTimeout(() => {
        setTranslateX(0);
        setIsAnimating(false);
      }, 300);
    } else {
      // Spring back
      setTranslateX(0);
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }

    startX.current = null;
    startY.current = null;
    isHorizontalSwipe.current = null;
  }, [translateX, threshold, onSwipeLeft, onSwipeRight, leftContent, rightContent, isAnimating]);

  return (
    <div className="relative overflow-hidden">
      {/* Left action (revealed on right swipe) */}
      {leftContent && (
        <div
          className="absolute inset-y-0 left-0 flex items-center"
          style={{ width: threshold }}
        >
          {leftContent}
        </div>
      )}

      {/* Right action (revealed on left swipe) */}
      {rightContent && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end"
          style={{ width: threshold }}
        >
          {rightContent}
        </div>
      )}

      {/* Main content */}
      <div
        className="relative bg-white dark:bg-gray-900"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
