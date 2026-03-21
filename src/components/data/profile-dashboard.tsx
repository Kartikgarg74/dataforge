'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { ColumnProfileCard } from './column-profile-card';
import type { DatasetProfile, QualityAlert } from '@/lib/profiling/types';

interface ProfileDashboardProps {
  table: string;
  className?: string;
}

function AlertItem({ alert }: { alert: QualityAlert }) {
  const icon = alert.severity === 'warning'
    ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
    : alert.severity === 'error'
    ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
    : <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;

  return (
    <div className="flex items-start gap-2 text-xs">
      {icon}
      <div>
        <span className="text-gray-700 dark:text-gray-300">{alert.message}</span>
        {alert.suggestion && (
          <span className="block text-gray-400 mt-0.5">{alert.suggestion}</span>
        )}
      </div>
    </div>
  );
}

export function ProfileDashboard({ table, className = '' }: ProfileDashboardProps) {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to profile');
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to profile dataset');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (table) fetchProfile();
  }, [table]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-12 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">Profiling {table}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={fetchProfile} className="mt-2 text-xs text-blue-500 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Data Profile: {profile.table}
          </h2>
        </div>
        <button
          onClick={fetchProfile}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Refresh profile"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Rows', value: profile.rowCount.toLocaleString() },
          { label: 'Columns', value: profile.columnCount.toString() },
          { label: 'Duplicates', value: profile.duplicateCount.toString() },
          { label: 'Completeness', value: `${profile.completeness}%` },
          { label: 'Profile Time', value: `${profile.profileTimeMs}ms` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {/* Quality Alerts */}
      {profile.alerts.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">
            Data Quality Alerts ({profile.alerts.length})
          </div>
          {profile.alerts.map((alert, i) => (
            <AlertItem key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Column Cards */}
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
          Column Profiles ({profile.columns.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {profile.columns.map((col) => (
            <ColumnProfileCard key={col.name} profile={col} />
          ))}
        </div>
      </div>

      {/* Sampled indicator */}
      {profile.sampled && (
        <p className="text-[10px] text-gray-400 text-center">
          Profile based on sample of {profile.sampledFrom?.toLocaleString()} rows
        </p>
      )}
    </div>
  );
}
