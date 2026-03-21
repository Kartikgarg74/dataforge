'use client';

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

interface DataPreviewTableProps {
  rows: Record<string, unknown>[];
  columns?: Array<{
    name: string;
    type?: string;
  }>;
  maxRows?: number;
  className?: string;
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  integer: { label: 'INT', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  float: { label: 'FLOAT', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  string: { label: 'STR', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  boolean: { label: 'BOOL', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  date: { label: 'DATE', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  datetime: { label: 'DATETIME', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  json: { label: 'JSON', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300' },
  unknown: { label: '?', color: 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400' },
};

export function DataPreviewTable({
  rows,
  columns: columnDefs,
  maxRows = 100,
  className = '',
}: DataPreviewTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const columnNames = useMemo(() => {
    if (columnDefs) return columnDefs.map((c) => c.name);
    if (rows.length > 0) return Object.keys(rows[0]);
    return [];
  }, [rows, columnDefs]);

  const columnTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (columnDefs) {
      for (const col of columnDefs) {
        if (col.type) map.set(col.name, col.type);
      }
    }
    return map;
  }, [columnDefs]);

  const filteredAndSorted = useMemo(() => {
    let result = rows;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) =>
        columnNames.some((col) => {
          const val = row[col];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(query);
        })
      );
    }

    // Sort
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result.slice(0, maxRows);
  }, [rows, columnNames, searchQuery, sortColumn, sortDirection, maxRows]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '∅';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (rows.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        No data to display
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search across all columns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-[500px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-10">#</th>
              {columnNames.map((col) => {
                const type = columnTypeMap.get(col);
                const badge = type ? TYPE_BADGES[type] || TYPE_BADGES.unknown : null;
                return (
                  <th
                    key={col}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none whitespace-nowrap"
                    onClick={() => handleSort(col)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {badge && (
                        <span className={`inline-block px-1 py-0.5 text-[10px] rounded ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                      {sortColumn === col && (
                        sortDirection === 'asc'
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredAndSorted.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-1.5 text-xs text-gray-400">{i + 1}</td>
                {columnNames.map((col) => {
                  const val = row[col];
                  const isNull = val === null || val === undefined;
                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 max-w-[200px] truncate ${
                        isNull ? 'text-gray-300 dark:text-gray-600 italic' : 'text-gray-900 dark:text-gray-100'
                      }`}
                      title={formatValue(val)}
                    >
                      {formatValue(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          Showing {filteredAndSorted.length} of {rows.length} rows
          {rows.length > maxRows && ` (limited to ${maxRows})`}
        </span>
        <span>{columnNames.length} columns</span>
      </div>
    </div>
  );
}
