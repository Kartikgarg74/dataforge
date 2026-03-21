'use client';

import React from 'react';

interface GeoDataPoint {
  region: string;
  value: number;
}

interface GeoMapWidgetProps {
  data: GeoDataPoint[];
  title?: string;
  valueLabel?: string;
  height?: number;
  className?: string;
}

// Simplified US state coordinates for a basic choropleth
// In production, use @nivo/geo or a GeoJSON library
const US_STATES: Record<string, { x: number; y: number; abbr: string }> = {
  'Alabama': { x: 380, y: 320, abbr: 'AL' },
  'Alaska': { x: 80, y: 400, abbr: 'AK' },
  'Arizona': { x: 140, y: 300, abbr: 'AZ' },
  'California': { x: 60, y: 240, abbr: 'CA' },
  'Colorado': { x: 190, y: 230, abbr: 'CO' },
  'Florida': { x: 430, y: 380, abbr: 'FL' },
  'Georgia': { x: 400, y: 310, abbr: 'GA' },
  'Illinois': { x: 340, y: 210, abbr: 'IL' },
  'Michigan': { x: 360, y: 160, abbr: 'MI' },
  'New York': { x: 460, y: 140, abbr: 'NY' },
  'Ohio': { x: 390, y: 190, abbr: 'OH' },
  'Pennsylvania': { x: 430, y: 170, abbr: 'PA' },
  'Texas': { x: 240, y: 340, abbr: 'TX' },
  'Washington': { x: 80, y: 80, abbr: 'WA' },
};

function getColorIntensity(value: number, min: number, max: number): string {
  if (max === min) return '#3b82f6';
  const ratio = (value - min) / (max - min);
  const r = Math.round(219 - ratio * 160);
  const g = Math.round(234 - ratio * 104);
  const b = Math.round(254 - ratio * 8);
  return `rgb(${r}, ${g}, ${b})`;
}

export function GeoMapWidget({
  data,
  title,
  valueLabel = 'Value',
  height = 300,
  className = '',
}: GeoMapWidgetProps) {
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);

  // Match data regions to known states
  const matched = data.map((d) => {
    const state = US_STATES[d.region] || US_STATES[Object.keys(US_STATES).find(
      (k) => k.toLowerCase().startsWith(d.region.toLowerCase()) ||
             US_STATES[k].abbr.toLowerCase() === d.region.toLowerCase()
    ) || ''];
    return { ...d, state };
  }).filter((d) => d.state);

  // If no US states match, render as a bar-based map alternative
  if (matched.length === 0) {
    return (
      <div className={className}>
        {title && <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>}
        <div className="space-y-1.5">
          {data.sort((a, b) => b.value - a.value).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-24 truncate">{d.region}</span>
              <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${max > 0 ? (d.value / max) * 100 : 0}%`,
                    backgroundColor: getColorIntensity(d.value, min, max),
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 w-16 text-right">
                {d.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>}
      <svg viewBox="0 0 550 450" className="w-full" style={{ height }}>
        {/* Background */}
        <rect width="550" height="450" fill="#f8fafc" rx="8" className="dark:fill-gray-800" />

        {/* Plot data points as circles on the map */}
        {matched.map((d, i) => (
          <g key={i}>
            <circle
              cx={d.state.x}
              cy={d.state.y}
              r={Math.max(12, Math.min(30, 12 + (d.value / max) * 18))}
              fill={getColorIntensity(d.value, min, max)}
              stroke="white"
              strokeWidth="2"
              opacity={0.85}
            >
              <title>{`${d.region}: ${d.value.toLocaleString()}`}</title>
            </circle>
            <text
              x={d.state.x}
              y={d.state.y + 4}
              textAnchor="middle"
              fill="white"
              fontSize="10"
              fontWeight="bold"
            >
              {d.state.abbr}
            </text>
          </g>
        ))}

        {/* Legend */}
        <text x="20" y="430" fill="#6b7280" fontSize="10">{valueLabel}: {min.toLocaleString()} — {max.toLocaleString()}</text>
      </svg>
    </div>
  );
}
