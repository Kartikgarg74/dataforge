'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Play,
  LayoutDashboard,
  Clock,
  BarChart3,
  ArrowUpDown,
  Loader2,
  Tag,
} from 'lucide-react';
import type { SavedQuery } from '@/lib/dashboard/types';

type SortOption = 'usage' | 'recent' | 'name';

export default function QueriesPage() {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list',
          teamId: '',
          search: searchTerm || undefined,
          category: activeCategory || undefined,
          sortBy,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQueries(data.queries);
      } else {
        setError(data.error || 'Failed to load queries');
      }
    } catch {
      setError('Failed to load queries');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, activeCategory, sortBy]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  // Derive unique categories from loaded queries
  const categories = useMemo(() => {
    const cats = new Set<string>();
    queries.forEach((q) => {
      if (q.category) cats.add(q.category);
    });
    return Array.from(cats).sort();
  }, [queries]);

  const handleRun = (query: SavedQuery) => {
    // Navigate to chat with the query pre-filled
    const params = new URLSearchParams({ q: query.naturalLanguage });
    window.location.href = `/chat?${params.toString()}`;
  };

  const handleAddToDashboard = (query: SavedQuery) => {
    // Open a simple prompt for dashboard ID for now - the PinToDashboard component
    // provides a richer experience from within chat
    const dashboardId = prompt('Enter dashboard ID to add this query as a widget:');
    if (!dashboardId) return;

    fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_widget',
        dashboardId,
        title: query.name,
        widgetType: query.visualization?.chartType || 'table',
        queryNatural: query.naturalLanguage,
        querySQL: query.sql,
        connectorId: query.connectorId || 'default',
        visualization: query.visualization || { chartType: 'table' },
        position: { x: 0, y: 0, w: 6, h: 4 },
        sortOrder: 0,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          alert('Widget added to dashboard');
        } else {
          alert(data.error || 'Failed to add widget');
        }
      })
      .catch(() => alert('Failed to add widget'));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'usage', label: 'Most Used' },
    { value: 'recent', label: 'Recent' },
    { value: 'name', label: 'Name' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Query Library
          </h1>
          <p className="text-sm text-gray-500">
            Browse, run, and manage saved queries
          </p>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queries..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Category Sidebar */}
        {categories.length > 0 && (
          <div className="hidden w-48 shrink-0 lg:block">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Categories
            </h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`w-full text-left rounded-md px-3 py-1.5 text-sm transition-colors ${
                    activeCategory === null
                      ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  All
                </button>
              </li>
              {categories.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left rounded-md px-3 py-1.5 text-sm transition-colors ${
                      activeCategory === cat
                        ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1">
          {/* Mobile category filter */}
          {categories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
              <button
                onClick={() => setActiveCategory(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeCategory === null
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading queries...</span>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          ) : queries.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                No saved queries yet
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Save queries from the chat to build your library
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {queries.map((query) => (
                <div
                  key={query.id}
                  className="group rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
                >
                  {/* Title row */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                      {query.name}
                    </h3>
                    {query.category && (
                      <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <Tag className="w-2.5 h-2.5" />
                        {query.category}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {query.description && (
                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {query.description}
                    </p>
                  )}

                  {/* Natural language */}
                  <p className="mb-3 text-xs text-gray-600 dark:text-gray-300 line-clamp-2 italic">
                    &quot;{query.naturalLanguage}&quot;
                  </p>

                  {/* Meta row */}
                  <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1" title="Usage count">
                      <BarChart3 className="w-3 h-3" />
                      {query.usageCount} runs
                    </span>
                    <span className="flex items-center gap-1" title="Last run">
                      <Clock className="w-3 h-3" />
                      {formatDate(query.lastRunAt)}
                    </span>
                  </div>

                  {/* Tags */}
                  {query.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {query.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => handleRun(query)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <Play className="w-3 h-3" />
                      Run
                    </button>
                    <button
                      onClick={() => handleAddToDashboard(query)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      <LayoutDashboard className="w-3 h-3" />
                      Add to Dashboard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
