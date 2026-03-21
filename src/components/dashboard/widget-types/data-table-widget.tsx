'use client';

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface DataTableWidgetProps {
  data: Record<string, unknown>[];
  columns?: string[];
  title?: string;
  pageSize?: number;
  height?: number;
  className?: string;
}

export function DataTableWidget({
  data,
  columns: propColumns,
  title,
  pageSize = 10,
  className = '',
}: DataTableWidgetProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  const columns = useMemo(() => {
    if (propColumns) return propColumns;
    return data.length > 0 ? Object.keys(data[0]) : [];
  }, [data, propColumns]);

  const sorted = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const va = a[sortColumn];
      const vb = b[sortColumn];
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  return (
    <div className={className}>
      {title && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</div>
      )}
      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    {sortColumn === col && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                    {row[col] == null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{sorted.length} rows</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
