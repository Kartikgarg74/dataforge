'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import type { QualityAlert } from '@/lib/profiling/types';

interface QualityAlertBannerProps {
  alerts: QualityAlert[];
  onDismiss?: () => void;
}

const SEVERITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const SEVERITY_COLOR = {
  info: 'text-blue-500',
  warning: 'text-yellow-600',
  error: 'text-red-500',
};

export function QualityAlertBanner({ alerts, onDismiss }: QualityAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || alerts.length === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {alerts.length} quality {alerts.length === 1 ? 'issue' : 'issues'} detected
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-amber-500" />
        </button>
      </div>

      <div className="mt-2 space-y-1.5">
        {alerts.map((alert, i) => {
          const Icon = SEVERITY_ICON[alert.severity] || Info;
          const color = SEVERITY_COLOR[alert.severity] || 'text-gray-500';
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${color}`} />
              <div>
                <span className="text-gray-700 dark:text-gray-300">{alert.message}</span>
                {alert.column && (
                  <span className="text-gray-400 ml-1">({alert.column})</span>
                )}
                {alert.suggestion && (
                  <span className="block text-gray-400 mt-0.5">{alert.suggestion}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
