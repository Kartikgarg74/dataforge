'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Search, LayoutGrid, List, Table, ArrowUp, ArrowDown } from 'lucide-react';

type ViewMode = 'card' | 'list' | 'table';

interface MobileDataTableProps {
  data: Record<string, unknown>[];
  columns?: string[];
  primaryColumn?: string;
  className?: string;
}

const PAGE_SIZE = 20;

export function MobileDataTable({
  data,
  columns: columnsProp,
  primaryColumn,
  className = '',
}: MobileDataTableProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  // Derive columns from data if not provided
  const columns = useMemo(() => {
    if (columnsProp && columnsProp.length > 0) return columnsProp;
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [columnsProp, data]);

  const primary = primaryColumn || columns[0] || '';
  const secondaryColumns = columns.filter((c) => c !== primary);

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, searchQuery, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      let cmp: number;
      if (!isNaN(aNum) && !isNaN(bNum)) {
        cmp = aNum - bNum;
      } else {
        cmp = aStr.localeCompare(bStr);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginated data for infinite scroll
  const visibleData = useMemo(
    () => sortedData.slice(0, visibleCount),
    [sortedData, visibleCount]
  );

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < sortedData.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedData.length));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, sortedData.length]);

  // Reset visible count on search/sort change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (col: string) => {
      if (sortColumn === col) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortColumn(col);
        setSortDirection('asc');
      }
    },
    [sortColumn]
  );

  const formatValue = (val: unknown): string => {
    if (val == null) return '--';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
  };

  const viewModes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'card', icon: <LayoutGrid className="w-4 h-4" />, label: 'Card' },
    { mode: 'list', icon: <List className="w-4 h-4" />, label: 'List' },
    { mode: 'table', icon: <Table className="w-4 h-4" />, label: 'Table' },
  ];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* View mode toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {viewModes.map(({ mode, icon, label }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
              viewMode === mode
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {sortedData.length} result{sortedData.length !== 1 ? 's' : ''}
      </div>

      {/* Card view */}
      {viewMode === 'card' && (
        <div className="flex flex-col gap-3">
          {visibleData.map((row, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
            >
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">
                {formatValue(row[primary])}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {secondaryColumns.map((col) => (
                  <div key={col} className="min-w-0">
                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">
                      {col}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                      {formatValue(row[col])}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {visibleData.map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {formatValue(row[primary])}
                </div>
              </div>
              {secondaryColumns.slice(0, 2).map((col) => (
                <div key={col} className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {formatValue(row[col])}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  {columns.map((col, colIndex) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        colIndex === 0 ? 'sticky left-0 z-10 bg-gray-50 dark:bg-gray-800' : ''
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {col}
                        {sortColumn === col && (
                          sortDirection === 'asc'
                            ? <ArrowUp className="w-3 h-3" />
                            : <ArrowDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibleData.map((row, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-900">
                    {columns.map((col, colIndex) => (
                      <td
                        key={col}
                        className={`px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap ${
                          colIndex === 0
                            ? 'sticky left-0 z-10 bg-white dark:bg-gray-900 font-medium'
                            : ''
                        }`}
                      >
                        {formatValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {visibleCount < sortedData.length && (
        <div ref={scrollSentinelRef} className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {sortedData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Search className="w-8 h-8 mb-2" />
          <p className="text-sm">No results found</p>
        </div>
      )}
    </div>
  );
}
