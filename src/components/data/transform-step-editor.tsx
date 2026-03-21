'use client';

import React, { useState, useCallback } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import type { TransformType } from '@/lib/transforms/types';

interface TransformStepEditorProps {
  onAddStep: (step: { type: TransformType; params: Record<string, unknown>; description: string }) => void;
  columns: string[];
  className?: string;
}

interface TransformOption {
  value: TransformType;
  label: string;
  description: string;
}

const TRANSFORM_OPTIONS: TransformOption[] = [
  { value: 'filter', label: 'Filter', description: 'Filter rows by condition' },
  { value: 'fill_nulls', label: 'Fill Nulls', description: 'Replace null values' },
  { value: 'drop_columns', label: 'Drop Columns', description: 'Remove selected columns' },
  { value: 'rename', label: 'Rename', description: 'Rename columns' },
  { value: 'normalize', label: 'Normalize', description: 'Normalize column values' },
  { value: 'bin', label: 'Bin', description: 'Bin numeric column into buckets' },
  { value: 'one_hot_encode', label: 'One-Hot Encode', description: 'One-hot encode a categorical column' },
  { value: 'round', label: 'Round', description: 'Round numeric column' },
  { value: 'clip_outliers', label: 'Clip Outliers', description: 'Clip values to bounds' },
  { value: 'sort', label: 'Sort', description: 'Sort rows by column' },
  { value: 'custom_sql', label: 'Custom SQL', description: 'Execute custom SQL transform' },
];

const FILL_STRATEGIES = ['mean', 'median', 'mode', 'constant', 'forward_fill', 'backward_fill'] as const;
const NORMALIZE_METHODS = ['min_max', 'z_score', 'robust'] as const;

function generateDescription(type: TransformType, params: Record<string, unknown>): string {
  switch (type) {
    case 'filter':
      return `Filter rows where ${params.condition || '...'}`;
    case 'fill_nulls':
      return `Fill nulls in "${params.column}" using ${params.strategy}${params.strategy === 'constant' ? ` (${params.value})` : ''}`;
    case 'drop_columns':
      return `Drop columns: ${(params.columns as string[] || []).join(', ') || '...'}`;
    case 'rename': {
      const pairs = params.pairs as Array<{ from: string; to: string }> || [];
      return `Rename: ${pairs.map((p) => `${p.from} -> ${p.to}`).join(', ') || '...'}`;
    }
    case 'normalize':
      return `Normalize "${params.column}" using ${params.method}`;
    case 'bin':
      return `Bin "${params.column}" into ${params.bins} buckets`;
    case 'one_hot_encode':
      return `One-hot encode "${params.column}"`;
    case 'round':
      return `Round "${params.column}" to ${params.decimals} decimals`;
    case 'clip_outliers':
      return `Clip "${params.column}" to [${params.lower ?? '-inf'}, ${params.upper ?? 'inf'}]`;
    case 'sort':
      return `Sort by "${params.column}" ${params.direction || 'asc'}`;
    case 'custom_sql':
      return `Custom SQL transform`;
    default:
      return `${type} transform`;
  }
}

// --- Sub-forms for each transform type ---

function FilterForm({ params, onChange }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        Condition (SQL WHERE clause)
      </label>
      <input
        type="text"
        value={(params.condition as string) || ''}
        onChange={(e) => onChange({ ...params, condition: e.target.value })}
        placeholder='e.g. age > 18 AND status = "active"'
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
      />
    </div>
  );
}

function FillNullsForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <div className="space-y-3">
      <ColumnSelect label="Column" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Strategy</label>
        <select
          value={(params.strategy as string) || 'mean'}
          onChange={(e) => onChange({ ...params, strategy: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {FILL_STRATEGIES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>
      {params.strategy === 'constant' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fill Value</label>
          <input
            type="text"
            value={(params.value as string) || ''}
            onChange={(e) => onChange({ ...params, value: e.target.value })}
            placeholder="Enter fill value"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      )}
    </div>
  );
}

function DropColumnsForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  const selected = (params.columns as string[]) || [];
  const toggle = (col: string) => {
    const next = selected.includes(col) ? selected.filter((c) => c !== col) : [...selected, col];
    onChange({ ...params, columns: next });
  };
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        Select columns to drop
      </label>
      <div className="max-h-40 overflow-y-auto space-y-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
        {columns.length === 0 ? (
          <span className="text-xs text-gray-400">No columns available</span>
        ) : (
          columns.map((col) => (
            <label key={col} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 px-1.5 py-1 rounded">
              <input
                type="checkbox"
                checked={selected.includes(col)}
                onChange={() => toggle(col)}
                className="rounded border-gray-300"
              />
              {col}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

function RenameForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  const pairs = (params.pairs as Array<{ from: string; to: string }>) || [];

  const addPair = () => onChange({ ...params, pairs: [...pairs, { from: '', to: '' }] });
  const removePair = (idx: number) => onChange({ ...params, pairs: pairs.filter((_, i) => i !== idx) });
  const updatePair = (idx: number, field: 'from' | 'to', value: string) => {
    const next = pairs.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
    onChange({ ...params, pairs: next });
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
        Rename Pairs
      </label>
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <select
            value={pair.from}
            onChange={(e) => updatePair(idx, 'from', e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            {columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">-&gt;</span>
          <input
            type="text"
            value={pair.to}
            onChange={(e) => updatePair(idx, 'to', e.target.value)}
            placeholder="New name"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button type="button" onClick={() => removePair(idx)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add pair
      </button>
    </div>
  );
}

function NormalizeForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <div className="space-y-3">
      <ColumnSelect label="Column" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Method</label>
        <select
          value={(params.method as string) || 'min_max'}
          onChange={(e) => onChange({ ...params, method: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {NORMALIZE_METHODS.map((m) => (
            <option key={m} value={m}>{m.replace('_', ' ')}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function BinForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <div className="space-y-3">
      <ColumnSelect label="Column" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Number of Bins</label>
        <input
          type="number"
          min={2}
          max={100}
          value={(params.bins as number) || 5}
          onChange={(e) => onChange({ ...params, bins: parseInt(e.target.value, 10) || 5 })}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  );
}

function OneHotEncodeForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <ColumnSelect label="Column to encode" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
  );
}

function RoundForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <div className="space-y-3">
      <ColumnSelect label="Column" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Decimal Places</label>
        <input
          type="number"
          min={0}
          max={15}
          value={(params.decimals as number) ?? 2}
          onChange={(e) => onChange({ ...params, decimals: parseInt(e.target.value, 10) || 0 })}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  );
}

function ClipOutliersForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <div className="space-y-3">
      <ColumnSelect label="Column" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Lower Bound</label>
          <input
            type="number"
            value={(params.lower as number) ?? ''}
            onChange={(e) => onChange({ ...params, lower: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            placeholder="No limit"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Upper Bound</label>
          <input
            type="number"
            value={(params.upper as number) ?? ''}
            onChange={(e) => onChange({ ...params, upper: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            placeholder="No limit"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
}

function SortForm({ params, onChange, columns }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; columns: string[] }) {
  return (
    <div className="space-y-3">
      <ColumnSelect label="Column" value={(params.column as string) || ''} columns={columns} onChange={(v) => onChange({ ...params, column: v })} />
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Direction</label>
        <div className="flex gap-2">
          {(['asc', 'desc'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => onChange({ ...params, direction: dir })}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                (params.direction || 'asc') === dir
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              {dir === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomSqlForm({ params, onChange }: { params: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        SQL Statement
      </label>
      <textarea
        value={(params.sql as string) || ''}
        onChange={(e) => onChange({ ...params, sql: e.target.value })}
        placeholder="SELECT * FROM {{input}} WHERE ..."
        rows={5}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-mono resize-y"
      />
      <p className="mt-0.5 text-[10px] text-gray-400">
        Use {'{{input}}'} as the source table placeholder.
      </p>
    </div>
  );
}

// --- Shared column select ---

function ColumnSelect({
  label,
  value,
  columns,
  onChange,
}: {
  label: string;
  value: string;
  columns: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">Select column...</option>
        {columns.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}

// --- Main component ---

export function TransformStepEditor({
  onAddStep,
  columns,
  className = '',
}: TransformStepEditorProps) {
  const [selectedType, setSelectedType] = useState<TransformType | ''>('');
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeOption = TRANSFORM_OPTIONS.find((o) => o.value === selectedType);

  const handleSelectType = useCallback((type: TransformType) => {
    setSelectedType(type);
    setParams({});
    setDropdownOpen(false);
  }, []);

  const handleAdd = () => {
    if (!selectedType) return;
    const description = generateDescription(selectedType, params);
    onAddStep({ type: selectedType, params, description });
    setSelectedType('');
    setParams({});
  };

  const renderForm = () => {
    switch (selectedType) {
      case 'filter':
        return <FilterForm params={params} onChange={setParams} />;
      case 'fill_nulls':
        return <FillNullsForm params={params} onChange={setParams} columns={columns} />;
      case 'drop_columns':
        return <DropColumnsForm params={params} onChange={setParams} columns={columns} />;
      case 'rename':
        return <RenameForm params={params} onChange={setParams} columns={columns} />;
      case 'normalize':
        return <NormalizeForm params={params} onChange={setParams} columns={columns} />;
      case 'bin':
        return <BinForm params={params} onChange={setParams} columns={columns} />;
      case 'one_hot_encode':
        return <OneHotEncodeForm params={params} onChange={setParams} columns={columns} />;
      case 'round':
        return <RoundForm params={params} onChange={setParams} columns={columns} />;
      case 'clip_outliers':
        return <ClipOutliersForm params={params} onChange={setParams} columns={columns} />;
      case 'sort':
        return <SortForm params={params} onChange={setParams} columns={columns} />;
      case 'custom_sql':
        return <CustomSqlForm params={params} onChange={setParams} />;
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Transform Type Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Transform Type
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <span className={activeOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}>
              {activeOption ? activeOption.label : 'Select transform...'}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {dropdownOpen && (
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
              {TRANSFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectType(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    selectedType === opt.value
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] text-gray-500">{opt.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Form */}
      {selectedType && (
        <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {activeOption?.description}
          </div>
          {renderForm()}
        </div>
      )}

      {/* Auto-generated description preview */}
      {selectedType && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic px-1">
          {generateDescription(selectedType, params)}
        </div>
      )}

      {/* Add Step Button */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!selectedType}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Step
      </button>
    </div>
  );
}
