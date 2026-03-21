'use client';

import React, { useState, useMemo } from 'react';

interface CorrelationEntry {
  column1: string;
  column2: string;
  correlation: number;
}

interface CorrelationHeatmapProps {
  correlations: CorrelationEntry[];
  className?: string;
}

/**
 * Returns a CSS background color for a correlation value in [-1, 1].
 * Blue for positive, red for negative, gray for near-zero.
 */
function correlationColor(value: number): string {
  const abs = Math.abs(value);
  if (abs < 0.05) return 'rgb(229, 231, 235)'; // gray-200

  if (value > 0) {
    // Blue scale: stronger correlation = deeper blue
    const intensity = Math.round(abs * 255);
    return `rgb(${255 - intensity}, ${255 - Math.round(intensity * 0.4)}, 255)`;
  } else {
    // Red scale: stronger negative = deeper red
    const intensity = Math.round(abs * 255);
    return `rgb(255, ${255 - intensity}, ${255 - Math.round(intensity * 0.4)})`;
  }
}

function textColorForBg(value: number): string {
  return Math.abs(value) > 0.6 ? 'text-white' : 'text-gray-800 dark:text-gray-200';
}

export function CorrelationHeatmap({
  correlations,
  className = '',
}: CorrelationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    row: string;
    col: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  // Extract unique column names and build a lookup map
  const { columns, matrix } = useMemo(() => {
    const colSet = new Set<string>();
    for (const c of correlations) {
      colSet.add(c.column1);
      colSet.add(c.column2);
    }
    const cols = Array.from(colSet);

    const map = new Map<string, number>();
    for (const c of correlations) {
      map.set(`${c.column1}::${c.column2}`, c.correlation);
      map.set(`${c.column2}::${c.column1}`, c.correlation);
    }
    // Diagonal = 1
    for (const col of cols) {
      map.set(`${col}::${col}`, 1);
    }

    return { columns: cols, matrix: map };
  }, [correlations]);

  if (columns.length === 0) {
    return (
      <div className={`text-sm text-gray-400 p-4 text-center ${className}`}>
        No correlation data available.
      </div>
    );
  }

  const getCellValue = (row: string, col: string): number => {
    return matrix.get(`${row}::${col}`) ?? 0;
  };

  return (
    <div className={`relative ${className}`}>
      <div className="overflow-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              {/* Top-left corner cell */}
              <th className="sticky left-0 z-10 bg-white dark:bg-gray-900 p-1.5 min-w-[40px]" />
              {columns.map((col) => (
                <th
                  key={col}
                  className="p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="max-w-[80px] truncate block">{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map((rowCol) => (
              <tr key={rowCol}>
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 p-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap max-w-[100px] truncate">
                  {rowCol}
                </td>
                {columns.map((colCol) => {
                  const value = getCellValue(rowCol, colCol);
                  return (
                    <td
                      key={colCol}
                      className={`p-0 border border-white/20 dark:border-gray-800/50 transition-transform cursor-pointer ${textColorForBg(value)}`}
                      style={{
                        backgroundColor: correlationColor(value),
                        minWidth: '36px',
                        height: '36px',
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredCell({
                          row: rowCol,
                          col: colCol,
                          value,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="flex items-center justify-center w-full h-full text-[9px] font-mono font-medium">
                        {value.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span>-1.0</span>
        <div className="flex h-3 flex-1 rounded-sm overflow-hidden">
          <div className="flex-1" style={{ background: 'linear-gradient(to right, rgb(255,0,153), rgb(229,231,235), rgb(0,153,255))' }} />
        </div>
        <span>+1.0</span>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div
          className="fixed z-50 px-2.5 py-1.5 text-xs bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-medium">
            {hoveredCell.row} / {hoveredCell.col}
          </div>
          <div className="font-mono">
            r = {hoveredCell.value.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}
