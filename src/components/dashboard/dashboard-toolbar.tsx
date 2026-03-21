'use client';

import React from 'react';
import { RefreshCw, Share2, Clock, Pencil, Plus } from 'lucide-react';

interface DashboardToolbarProps {
  dashboardName: string;
  isEditMode?: boolean;
  refreshInterval?: number;
  onRefresh?: () => void;
  onToggleEdit?: () => void;
  onShare?: () => void;
  onSchedule?: () => void;
  onAddWidget?: () => void;
  className?: string;
}

export function DashboardToolbar({
  dashboardName,
  isEditMode = false,
  refreshInterval,
  onRefresh,
  onToggleEdit,
  onShare,
  onSchedule,
  onAddWidget,
  className = '',
}: DashboardToolbarProps) {
  return (
    <div className={`flex items-center justify-between py-3 ${className}`}>
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{dashboardName}</h1>
        {refreshInterval && refreshInterval > 0 && (
          <p className="text-[10px] text-gray-400">
            Auto-refresh every {refreshInterval >= 60 ? `${refreshInterval / 60}m` : `${refreshInterval}s`}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {isEditMode && onAddWidget && (
          <button
            onClick={onAddWidget}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Widget
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh all widgets"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        )}

        {onShare && (
          <button
            onClick={onShare}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Share dashboard"
          >
            <Share2 className="w-4 h-4 text-gray-500" />
          </button>
        )}

        {onSchedule && (
          <button
            onClick={onSchedule}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Schedule reports"
          >
            <Clock className="w-4 h-4 text-gray-500" />
          </button>
        )}

        {onToggleEdit && (
          <button
            onClick={onToggleEdit}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isEditMode
                ? 'text-white bg-blue-600 hover:bg-blue-700'
                : 'text-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            {isEditMode ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
    </div>
  );
}
