'use client';

import React from 'react';

interface GaugeWidgetProps {
  value: number;
  min?: number;
  max?: number;
  goal?: number;
  label?: string;
  format?: 'number' | 'currency' | 'percent';
  className?: string;
}

function formatGaugeValue(value: number, format?: string): string {
  if (format === 'currency') {
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (format === 'percent') {
    return value.toFixed(1) + '%';
  }
  return value.toLocaleString();
}

export function GaugeWidget({
  value,
  min = 0,
  max = 100,
  goal,
  label,
  format,
  className = '',
}: GaugeWidgetProps) {
  const range = max - min || 1;
  const clampedValue = Math.max(min, Math.min(max, value));
  const normalizedValue = (clampedValue - min) / range;

  // Semi-circle arc: from 180 degrees (left) to 0 degrees (right)
  const startAngle = Math.PI; // 180 degrees
  const endAngle = 0;
  const sweepAngle = startAngle - endAngle;

  const cx = 100;
  const cy = 90;
  const outerR = 75;
  const innerR = 55;

  // Helper to get point on arc
  const getPoint = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  });

  // Color segments: red (0-33%), yellow (33-66%), green (66-100%)
  const segments = [
    { start: 0, end: 0.33, color: '#ef4444' },
    { start: 0.33, end: 0.66, color: '#f59e0b' },
    { start: 0.66, end: 1.0, color: '#22c55e' },
  ];

  // Build arc path for a segment
  const arcPath = (startFrac: number, endFrac: number, rOuter: number, rInner: number) => {
    const a1 = startAngle - startFrac * sweepAngle;
    const a2 = startAngle - endFrac * sweepAngle;
    const largeArc = Math.abs(a1 - a2) > Math.PI ? 1 : 0;

    const outerStart = getPoint(a1, rOuter);
    const outerEnd = getPoint(a2, rOuter);
    const innerEnd = getPoint(a2, rInner);
    const innerStart = getPoint(a1, rInner);

    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  };

  // Needle angle
  const needleAngle = startAngle - normalizedValue * sweepAngle;
  const needleTip = getPoint(needleAngle, outerR - 5);
  const needleBase1 = getPoint(needleAngle + Math.PI / 2, 4);
  const needleBase2 = getPoint(needleAngle - Math.PI / 2, 4);

  // Goal line
  const goalFrac = goal !== undefined ? Math.max(0, Math.min(1, (goal - min) / range)) : null;
  const goalAngle = goalFrac !== null ? startAngle - goalFrac * sweepAngle : null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 200 110" className="w-full max-w-[240px]">
        {/* Color segments */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(seg.start, seg.end, outerR, innerR)}
            fill={seg.color}
            opacity={0.2}
          />
        ))}

        {/* Filled arc up to value */}
        {normalizedValue > 0 && (
          <path
            d={arcPath(0, normalizedValue, outerR, innerR)}
            fill={
              normalizedValue >= 0.66
                ? '#22c55e'
                : normalizedValue >= 0.33
                ? '#f59e0b'
                : '#ef4444'
            }
            opacity={0.7}
          />
        )}

        {/* Goal line */}
        {goalAngle !== null && (
          <line
            x1={getPoint(goalAngle, innerR - 2).x}
            y1={getPoint(goalAngle, innerR - 2).y}
            x2={getPoint(goalAngle, outerR + 4).x}
            y2={getPoint(goalAngle, outerR + 4).y}
            stroke="#6b7280"
            strokeWidth="2"
            strokeDasharray="3 2"
          />
        )}

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill="#374151"
        />
        <circle cx={cx} cy={cy} r="5" fill="#374151" />

        {/* Min/Max labels */}
        <text x={cx - outerR - 2} y={cy + 14} textAnchor="start" className="fill-gray-400" style={{ fontSize: '9px' }}>
          {formatGaugeValue(min, format)}
        </text>
        <text x={cx + outerR + 2} y={cy + 14} textAnchor="end" className="fill-gray-400" style={{ fontSize: '9px' }}>
          {formatGaugeValue(max, format)}
        </text>

        {/* Center value */}
        <text x={cx} y={cy + 2} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100 font-bold" style={{ fontSize: '18px' }}>
          {formatGaugeValue(value, format)}
        </text>
      </svg>

      {/* Labels */}
      <div className="text-center -mt-2">
        {label && (
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
        )}
        {goal !== undefined && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            Goal: {formatGaugeValue(goal, format)}
          </div>
        )}
      </div>
    </div>
  );
}
