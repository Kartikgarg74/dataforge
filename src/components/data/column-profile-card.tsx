'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Key, Mail, Phone, Hash, Calendar, ToggleLeft, Type } from 'lucide-react';
import type { ColumnProfile } from '@/lib/profiling/types';

interface ColumnProfileCardProps {
  profile: ColumnProfile;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  INTEGER: <Hash className="w-3.5 h-3.5" />,
  REAL: <Hash className="w-3.5 h-3.5" />,
  TEXT: <Type className="w-3.5 h-3.5" />,
  integer: <Hash className="w-3.5 h-3.5" />,
  float: <Hash className="w-3.5 h-3.5" />,
  string: <Type className="w-3.5 h-3.5" />,
  boolean: <ToggleLeft className="w-3.5 h-3.5" />,
  date: <Calendar className="w-3.5 h-3.5" />,
  datetime: <Calendar className="w-3.5 h-3.5" />,
};

const PATTERN_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5 text-yellow-500" />,
  phone: <Phone className="w-3.5 h-3.5 text-yellow-500" />,
};

function NullBar({ percent }: { percent: number }) {
  const color = percent > 50 ? 'bg-red-400' : percent > 20 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, 100 - percent)}%` }} />
    </div>
  );
}

export function ColumnProfileCard({ profile, className = '' }: ColumnProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = TYPE_ICONS[profile.type] || <Type className="w-3.5 h-3.5" />;
  const patternIcon = profile.detectedPattern ? PATTERN_ICONS[profile.detectedPattern] : null;

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <span className="text-sm font-medium truncate">{profile.name}</span>
          {patternIcon}
          {profile.outliers && profile.outliers.outlierCount > 0 && (
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
          )}
          {profile.uniqueCount === profile.totalCount && profile.nullCount === 0 && (
            <span title="Candidate PK"><Key className="w-3 h-3 text-blue-500 flex-shrink-0" /></span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {/* Quick Stats */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-500">
        <div>
          <span className="block text-gray-400">Nulls</span>
          <span className={profile.nullPercent > 50 ? 'text-red-500 font-medium' : ''}>
            {profile.nullPercent}%
          </span>
        </div>
        <div>
          <span className="block text-gray-400">Unique</span>
          <span>{profile.uniqueCount.toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-gray-400">Type</span>
          <span className="uppercase">{profile.type}</span>
        </div>
      </div>

      {/* Completeness bar */}
      <div className="mt-2">
        <NullBar percent={profile.nullPercent} />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
          {/* Numeric Stats */}
          {profile.numericStats && (
            <div className="grid grid-cols-2 gap-1.5 text-gray-600 dark:text-gray-400">
              <div>Min: <strong>{profile.numericStats.min}</strong></div>
              <div>Max: <strong>{profile.numericStats.max}</strong></div>
              <div>Mean: <strong>{profile.numericStats.mean}</strong></div>
              <div>Median: <strong>{profile.numericStats.median}</strong></div>
              <div>Std Dev: <strong>{profile.numericStats.stdDev}</strong></div>
              <div>Zeros: <strong>{profile.numericStats.zeros}</strong></div>
            </div>
          )}

          {/* String Stats */}
          {profile.stringStats && (
            <div className="grid grid-cols-2 gap-1.5 text-gray-600 dark:text-gray-400">
              <div>Min Length: <strong>{profile.stringStats.minLength}</strong></div>
              <div>Max Length: <strong>{profile.stringStats.maxLength}</strong></div>
              <div>Avg Length: <strong>{profile.stringStats.avgLength}</strong></div>
              <div>Empty: <strong>{profile.stringStats.emptyCount}</strong></div>
            </div>
          )}

          {/* Date Stats */}
          {profile.dateStats && (
            <div className="text-gray-600 dark:text-gray-400">
              <div>Earliest: <strong>{profile.dateStats.earliest}</strong></div>
              <div>Latest: <strong>{profile.dateStats.latest}</strong></div>
              <div>Range: <strong>{profile.dateStats.range}</strong></div>
            </div>
          )}

          {/* Pattern */}
          {profile.detectedPattern && (
            <div className="text-yellow-600 dark:text-yellow-400">
              Pattern detected: <strong>{profile.detectedPattern}</strong>
            </div>
          )}

          {/* Outliers */}
          {profile.outliers && profile.outliers.outlierCount > 0 && (
            <div className="text-yellow-600 dark:text-yellow-400">
              {profile.outliers.outlierCount} outliers ({profile.outliers.outlierPercent}%)
              — Bounds: [{profile.outliers.lowerBound}, {profile.outliers.upperBound}]
            </div>
          )}

          {/* Top Values */}
          {profile.mostFrequent.length > 0 && (
            <div>
              <div className="text-gray-400 mb-1">Top Values:</div>
              {profile.mostFrequent.slice(0, 5).map((v, i) => (
                <div key={i} className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span className="truncate max-w-[60%]">{v.value}</span>
                  <span>{v.count} ({v.percent.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
