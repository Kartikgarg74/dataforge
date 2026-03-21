'use client';

import React, { useState } from 'react';
import { Download, FileText, Braces, Database, Loader2 } from 'lucide-react';

interface ExportDialogProps {
  table: string;
  columns?: string[];
  rowCount?: number;
  onExportComplete?: () => void;
  className?: string;
}

const FORMATS: Array<{ value: string; label: string; icon: React.ReactNode; desc: string; disabled?: boolean }> = [
  { value: 'csv', label: 'CSV', icon: <FileText className="w-4 h-4" />, desc: 'Universal, Excel-compatible' },
  { value: 'json', label: 'JSON', icon: <Braces className="w-4 h-4" />, desc: 'Array of objects' },
  { value: 'jsonl', label: 'JSONL', icon: <Braces className="w-4 h-4" />, desc: 'Newline-delimited, LLM fine-tuning' },
  { value: 'parquet', label: 'Parquet', icon: <Database className="w-4 h-4" />, desc: 'Columnar, ML pipelines', disabled: true },
];

export function ExportDialog({
  table,
  columns,
  rowCount,
  onExportComplete,
  className = '',
}: ExportDialogProps) {
  const [format, setFormat] = useState<string>('csv');
  const [maxRows, setMaxRows] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          format,
          columns,
          maxRows: maxRows ? parseInt(maxRows, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')
        ?.match(/filename="(.+)"/)?.[1] || `${table}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onExportComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Export: {table}
        </h3>
        {rowCount !== undefined && (
          <p className="text-xs text-gray-500">{rowCount.toLocaleString()} rows</p>
        )}
      </div>

      {/* Format Selection */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Format
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              disabled={f.disabled}
              onClick={() => setFormat(f.value)}
              className={`flex items-center gap-2 p-2.5 text-left text-sm rounded-lg border transition-colors ${
                format === f.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              } ${f.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {f.icon}
              <div>
                <div className="font-medium">{f.label}</div>
                <div className="text-[10px] text-gray-500">{f.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Max Rows */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Max Rows (optional)
        </label>
        <input
          type="number"
          value={maxRows}
          onChange={(e) => setMaxRows(e.target.value)}
          placeholder="All rows"
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export as {format.toUpperCase()}
          </>
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
