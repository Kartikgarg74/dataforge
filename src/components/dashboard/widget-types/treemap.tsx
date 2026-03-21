'use client';

import React from 'react';

interface TreemapItem {
  name: string;
  value: number;
  children?: TreemapItem[];
}

interface TreemapWidgetProps {
  data: TreemapItem[];
  title?: string;
  height?: number;
  className?: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

interface Rect { x: number; y: number; w: number; h: number; item: TreemapItem; color: string; }

function squarify(items: TreemapItem[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0 || items.length === 0) return [];

  const rects: Rect[] = [];
  let cx = x, cy = y, cw = w, ch = h;

  const sorted = [...items].sort((a, b) => b.value - a.value);
  let remaining = total;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const ratio = item.value / remaining;
    const isHorizontal = cw >= ch;

    if (isHorizontal) {
      const itemW = cw * ratio;
      rects.push({ x: cx, y: cy, w: itemW, h: ch, item, color: COLORS[i % COLORS.length] });
      cx += itemW;
      cw -= itemW;
    } else {
      const itemH = ch * ratio;
      rects.push({ x: cx, y: cy, w: cw, h: itemH, item, color: COLORS[i % COLORS.length] });
      cy += itemH;
      ch -= itemH;
    }
    remaining -= item.value;
  }

  return rects;
}

export function TreemapWidget({ data, title, height = 300, className = '' }: TreemapWidgetProps) {
  const width = 600;
  const rects = squarify(data, 0, 0, width, height);

  return (
    <div className={className}>
      {title && <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {rects.map((r, i) => (
          <g key={i}>
            <rect
              x={r.x + 1} y={r.y + 1}
              width={Math.max(0, r.w - 2)} height={Math.max(0, r.h - 2)}
              fill={r.color} rx={3} opacity={0.85}
            >
              <title>{`${r.item.name}: ${r.item.value.toLocaleString()}`}</title>
            </rect>
            {r.w > 50 && r.h > 25 && (
              <>
                <text x={r.x + 6} y={r.y + 18} fill="white" fontSize="12" fontWeight="600">
                  {r.item.name.length > r.w / 8 ? r.item.name.slice(0, Math.floor(r.w / 8)) + '…' : r.item.name}
                </text>
                {r.h > 40 && (
                  <text x={r.x + 6} y={r.y + 34} fill="rgba(255,255,255,0.8)" fontSize="11">
                    {r.item.value.toLocaleString()}
                  </text>
                )}
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
