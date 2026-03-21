'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Lock, BookOpen, Eye, AlertTriangle, BarChart3 } from 'lucide-react';

interface ShareInfo {
  id: string;
  resourceType: 'dashboard' | 'query';
  resourceId: string;
  slug: string;
  accessType: string;
  viewCount: number;
  createdAt: string;
  needsPassword: boolean;
}

interface QueryResource {
  type: 'query';
  id: string;
  name: string;
}

type PageState = 'loading' | 'not-found' | 'password' | 'ready';

export default function PublicQueryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [query, setQuery] = useState<QueryResource | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  const fetchShare = useCallback(async (shareSlug: string) => {
    try {
      const res = await fetch('/api/public-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', slug: shareSlug }),
      });

      if (!res.ok) {
        setState('not-found');
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setState('not-found');
        return;
      }

      setShare(data.share);

      if (data.share.needsPassword) {
        setState('password');
      } else {
        await loadQuery(shareSlug);
      }
    } catch {
      setState('not-found');
    }
  }, []);

  const loadQuery = async (shareSlug: string) => {
    try {
      const res = await fetch('/api/public-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view', slug: shareSlug }),
      });

      if (!res.ok) {
        setState('not-found');
        return;
      }

      const data = await res.json();
      if (data.success && data.resource) {
        setQuery(data.resource as QueryResource);
        setState('ready');
      } else {
        setState('not-found');
      }
    } catch {
      setState('not-found');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;

    setPasswordError('');

    try {
      const res = await fetch('/api/public-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', slug, password }),
      });

      const data = await res.json();

      if (data.success && data.verified) {
        await loadQuery(slug);
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch {
      setPasswordError('Something went wrong. Please try again.');
    }
  };

  useEffect(() => {
    if (slug) {
      fetchShare(slug);
    }
  }, [slug, fetchShare]);

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-500">Loading query...</p>
        </div>
      </div>
    );
  }

  // --- Not Found / Expired ---
  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Query Not Found
          </h1>
          <p className="text-sm text-gray-500">
            This query link may have expired, been revoked, or reached its maximum view count.
          </p>
        </div>
      </div>
    );
  }

  // --- Password Required ---
  if (state === 'password') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="max-w-sm w-full mx-auto px-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h2 className="text-center text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Password Protected
            </h2>
            <p className="text-center text-xs text-gray-500 mb-5">
              Enter the password to view this query result.
            </p>
            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-red-500 mb-3">{passwordError}</p>
              )}
              <button
                type="submit"
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Unlock Query
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- Ready: Show Query Result ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {query?.name || 'Shared Query'}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
            {share && (
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                {share.viewCount + 1}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              Powered by <span className="font-semibold text-gray-600 dark:text-gray-300">DataForge</span>
            </span>
          </div>
        </div>
      </header>

      {/* Query Result */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Query Result
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded">
              READ-ONLY
            </span>
          </div>
          {/* Placeholder visualization */}
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <BarChart3 className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-500 mb-1">Query Visualization</p>
            <p className="text-xs text-gray-400">
              Result data will be rendered here once query execution is wired up.
            </p>
            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-2">
              SQL hidden in public view
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
