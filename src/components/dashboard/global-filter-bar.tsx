'use client';

import React, { useState } from 'react';
import { Filter, X, Calendar, ChevronDown } from 'lucide-react';

interface FilterConfig {
  id: string;
  name: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text';
  options?: string[];
  defaultValue?: unknown;
}

interface GlobalFilterBarProps {
  filters: FilterConfig[];
  values: Record<string, unknown>;
  onChange: (filterId: string, value: unknown) => void;
  onClear?: () => void;
  className?: string;
}

export function GlobalFilterBar({
  filters,
  values,
  onChange,
  onClear,
  className = '',
}: GlobalFilterBarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const activeCount = Object.keys(values).filter((k) => values[k] !== undefined && values[k] !== null).length;

  if (filters.length === 0) return null;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Filter className="w-3.5 h-3.5" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-medium">
            {activeCount}
          </span>
        )}
      </div>

      {filters.map((filter) => {
        const value = values[filter.id];
        const isActive = value !== undefined && value !== null;

        return (
          <div key={filter.id} className="relative">
            <button
              onClick={() => setExpanded(expanded === filter.id ? null : filter.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                isActive
                  ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-700'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 hover:border-gray-300'
              }`}
            >
              {filter.type === 'date_range' && <Calendar className="w-3 h-3" />}
              <span>{filter.name}</span>
              {isActive && <span className="font-medium">: {String(value)}</span>}
              <ChevronDown className="w-3 h-3" />
            </button>

            {expanded === filter.id && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-[180px]">
                {filter.type === 'select' && filter.options?.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { onChange(filter.id, opt); setExpanded(null); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      value === opt ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}

                {filter.type === 'text' && (
                  <input
                    type="text"
                    value={String(value || '')}
                    onChange={(e) => onChange(filter.id, e.target.value || null)}
                    placeholder={`Filter by ${filter.name}`}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                )}

                {filter.type === 'date_range' && (
                  <div className="space-y-2">
                    {['Last 7 days', 'Last 30 days', 'Last 90 days', 'This year', 'All time'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => { onChange(filter.id, preset); setExpanded(null); }}
                        className="block w-full text-left px-3 py-1.5 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {activeCount > 0 && onClear && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );
}
