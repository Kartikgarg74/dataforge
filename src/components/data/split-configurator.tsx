'use client';

import React, { useState, useCallback } from 'react';
import {
  Shuffle,
  Layers,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import type { SplitStrategy, SplitResult } from '@/lib/splitting/types';

interface SplitConfiguratorProps {
  table: string;
  columns: string[];
  onSplitComplete?: (result: SplitResult) => void;
  className?: string;
}

const STRATEGIES: Array<{
  value: SplitStrategy;
  label: string;
  icon: React.ReactNode;
  desc: string;
  requiresColumn?: 'stratifyColumn' | 'groupColumn' | 'timeColumn';
}> = [
  {
    value: 'random',
    label: 'Random',
    icon: <Shuffle className="w-4 h-4" />,
    desc: 'Uniformly random assignment',
  },
  {
    value: 'stratified',
    label: 'Stratified',
    icon: <Layers className="w-4 h-4" />,
    desc: 'Preserves class distribution',
    requiresColumn: 'stratifyColumn',
  },
  {
    value: 'temporal',
    label: 'Temporal',
    icon: <Clock className="w-4 h-4" />,
    desc: 'Ordered by time column',
    requiresColumn: 'timeColumn',
  },
  {
    value: 'group',
    label: 'Group',
    icon: <Users className="w-4 h-4" />,
    desc: 'Groups stay in same split',
    requiresColumn: 'groupColumn',
  },
];

const COLUMN_LABELS: Record<string, string> = {
  stratifyColumn: 'Stratify Column',
  groupColumn: 'Group Column',
  timeColumn: 'Time Column',
};

function clampRatios(
  train: number,
  val: number,
  test: number,
  changed: 'train' | 'val' | 'test'
): { train: number; val: number; test: number } {
  const total = train + val + test;
  if (total === 100) return { train, val, test };

  const diff = total - 100;
  if (changed === 'train') {
    const remaining = val + test;
    if (remaining === 0) return { train: 100, val: 0, test: 0 };
    const scale = (remaining - diff) / remaining;
    return {
      train,
      val: Math.round(val * scale),
      test: Math.round(test * scale),
    };
  } else if (changed === 'val') {
    const remaining = train + test;
    if (remaining === 0) return { train: 0, val: 100, test: 0 };
    const scale = (remaining - diff) / remaining;
    return {
      train: Math.round(train * scale),
      val,
      test: Math.round(test * scale),
    };
  } else {
    const remaining = train + val;
    if (remaining === 0) return { train: 0, val: 0, test: 100 };
    const scale = (remaining - diff) / remaining;
    return {
      train: Math.round(train * scale),
      val: Math.round(val * scale),
      test,
    };
  }
}

export function SplitConfigurator({
  table,
  columns,
  onSplitComplete,
  className = '',
}: SplitConfiguratorProps) {
  const [strategy, setStrategy] = useState<SplitStrategy>('random');
  const [ratios, setRatios] = useState({ train: 70, val: 15, test: 15 });
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [seed, setSeed] = useState<number>(42);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SplitResult | null>(null);
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);

  const activeStrategy = STRATEGIES.find((s) => s.value === strategy)!;

  const handleRatioChange = useCallback(
    (key: 'train' | 'val' | 'test', value: number) => {
      const clamped = Math.max(0, Math.min(100, value));
      const newRatios = clampRatios(
        key === 'train' ? clamped : ratios.train,
        key === 'val' ? clamped : ratios.val,
        key === 'test' ? clamped : ratios.test,
        key
      );
      setRatios(newRatios);
    },
    [ratios]
  );

  const handleSplit = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      if (activeStrategy.requiresColumn && !selectedColumn) {
        throw new Error(
          `Please select a ${COLUMN_LABELS[activeStrategy.requiresColumn].toLowerCase()} for ${activeStrategy.label} split.`
        );
      }

      const total = ratios.train + ratios.val + ratios.test;
      if (total !== 100) {
        throw new Error(
          `Ratios must sum to 100%. Currently ${total}%.`
        );
      }

      const body: Record<string, unknown> = {
        table,
        strategy,
        ratios: {
          train: ratios.train / 100,
          val: ratios.val / 100,
          test: ratios.test / 100,
        },
        seed,
      };

      if (strategy === 'stratified') body.stratifyColumn = selectedColumn;
      if (strategy === 'group') body.groupColumn = selectedColumn;
      if (strategy === 'temporal') body.timeColumn = selectedColumn;

      const response = await fetch('/api/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Split failed');
      }

      const data: SplitResult & { success: boolean } = await response.json();
      setResult(data);
      onSplitComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split failed');
    } finally {
      setIsLoading(false);
    }
  };

  const ratioSum = ratios.train + ratios.val + ratios.test;
  const ratioValid = ratioSum === 100;

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Split Dataset: {table}
        </h3>
        <p className="text-xs text-gray-500">
          Partition data into train, validation, and test sets.
        </p>
      </div>

      {/* Strategy Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Strategy
        </label>
        <div className="grid grid-cols-2 gap-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setStrategy(s.value);
                setSelectedColumn('');
                setResult(null);
                setError(null);
              }}
              className={`flex items-center gap-2 p-2.5 text-left text-sm rounded-lg border transition-colors ${
                strategy === s.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } cursor-pointer`}
            >
              {s.icon}
              <div>
                <div className="font-medium">{s.label}</div>
                <div className="text-[10px] text-gray-500">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Column Picker (conditional) */}
      {activeStrategy.requiresColumn && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {COLUMN_LABELS[activeStrategy.requiresColumn]}
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setColumnDropdownOpen(!columnDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <span className={selectedColumn ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}>
                {selectedColumn || 'Select a column...'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {columnDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                {columns.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    No columns available
                  </div>
                ) : (
                  columns.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        setSelectedColumn(col);
                        setColumnDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        selectedColumn === col
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {col}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ratio Inputs */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Split Ratios
          <span className={`ml-2 ${ratioValid ? 'text-green-600' : 'text-red-500'}`}>
            ({ratioSum}%)
          </span>
        </label>
        <div className="space-y-3">
          {(['train', 'val', 'test'] as const).map((key) => {
            const label = key === 'val' ? 'Validation' : key.charAt(0).toUpperCase() + key.slice(1);
            const colors = {
              train: 'bg-blue-500',
              val: 'bg-amber-500',
              test: 'bg-emerald-500',
            };
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16">
                  {label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ratios[key]}
                  onChange={(e) => handleRatioChange(key, parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 accent-blue-600"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={ratios[key]}
                    onChange={(e) => handleRatioChange(key, parseInt(e.target.value, 10) || 0)}
                    className="w-14 px-2 py-1 text-xs text-center border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
            );
          })}

          {/* Ratio Preview Bar */}
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            {ratios.train > 0 && (
              <div
                className="bg-blue-500 transition-all duration-200"
                style={{ width: `${(ratios.train / ratioSum) * 100}%` }}
                title={`Train: ${ratios.train}%`}
              />
            )}
            {ratios.val > 0 && (
              <div
                className="bg-amber-500 transition-all duration-200"
                style={{ width: `${(ratios.val / ratioSum) * 100}%` }}
                title={`Validation: ${ratios.val}%`}
              />
            )}
            {ratios.test > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-200"
                style={{ width: `${(ratios.test / ratioSum) * 100}%` }}
                title={`Test: ${ratios.test}%`}
              />
            )}
          </div>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Train
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Val
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Test
            </span>
          </div>
        </div>
      </div>

      {/* Seed Input */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Random Seed
        </label>
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <p className="mt-0.5 text-[10px] text-gray-400">
          Same seed produces identical splits for reproducibility.
        </p>
      </div>

      {/* Split Button */}
      <button
        onClick={handleSplit}
        disabled={isLoading || !ratioValid}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Splitting...
          </>
        ) : (
          <>
            <Shuffle className="w-4 h-4" />
            Split Dataset
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Summary */}
      {result && (
        <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            Split Complete
          </div>

          {/* Row Counts */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(['train', 'val', 'test'] as const).map((key) => {
              const label = key === 'val' ? 'Validation' : key.charAt(0).toUpperCase() + key.slice(1);
              const colors = {
                train: 'text-blue-700 dark:text-blue-400',
                val: 'text-amber-700 dark:text-amber-400',
                test: 'text-emerald-700 dark:text-emerald-400',
              };
              return (
                <div
                  key={key}
                  className="text-center p-2 bg-white dark:bg-gray-900 rounded-md border border-gray-100 dark:border-gray-800"
                >
                  <div className="text-gray-500 mb-0.5">{label}</div>
                  <div className={`font-semibold ${colors[key]}`}>
                    {result.splits[key].rowCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5">
                    {result.splits[key].table}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Distribution (if stratified) */}
          {result.metadata.distribution && (
            <div className="mt-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Class Distribution
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-gray-600 dark:text-gray-400">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-1 pr-2 font-medium">Class</th>
                      <th className="text-right py-1 px-2 font-medium">Train</th>
                      <th className="text-right py-1 px-2 font-medium">Val</th>
                      <th className="text-right py-1 pl-2 font-medium">Test</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.metadata.distribution).map(
                      ([className, splits]) => (
                        <tr
                          key={className}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <td className="py-1 pr-2 font-medium truncate max-w-[100px]">
                            {className}
                          </td>
                          <td className="py-1 px-2 text-right">
                            {splits.train ?? '-'}
                          </td>
                          <td className="py-1 px-2 text-right">
                            {splits.val ?? '-'}
                          </td>
                          <td className="py-1 pl-2 text-right">
                            {splits.test ?? '-'}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-[10px] text-gray-400">
            Strategy: {result.metadata.strategy} | Seed: {result.metadata.seed} |
            Ratios: {Math.round(result.metadata.ratios.train * 100)}/
            {Math.round(result.metadata.ratios.val * 100)}/
            {Math.round(result.metadata.ratios.test * 100)}
          </div>
        </div>
      )}
    </div>
  );
}
