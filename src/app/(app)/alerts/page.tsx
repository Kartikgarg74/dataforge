'use client';

import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { ScheduleList } from '@/components/scheduling/schedule-list';

interface AlertHistoryItem {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  read: boolean;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950/20' },
  error: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20' },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'alerts' | 'schedules'>('alerts');

  useEffect(() => {
    // Simulated alert history - in production this would come from an API
    const mockAlerts: AlertHistoryItem[] = [
      {
        id: '1',
        type: 'warning',
        message: 'Column "email" has 12% null values',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: false,
      },
      {
        id: '2',
        type: 'error',
        message: 'Scheduled report "Weekly Sales" failed to execute',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        read: false,
      },
      {
        id: '3',
        type: 'info',
        message: 'Data profile completed for table "customers"',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        read: true,
      },
    ];
    setAlerts(mockAlerts);
    setLoading(false);
  }, []);

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-500">Recent alerts and scheduled report statuses</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {([
          { id: 'alerts' as const, label: 'Recent Alerts' },
          { id: 'schedules' as const, label: 'Scheduled Reports' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'alerts' && (
        <>
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">All clear</h3>
              <p className="text-xs text-gray-400 mt-1">No recent alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => {
                const config = SEVERITY_CONFIG[alert.type];
                const Icon = config.icon;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 ${
                      !alert.read ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(alert.timestamp)}</p>
                    </div>
                    {!alert.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'schedules' && (
        <ScheduleList className="mt-2" />
      )}
    </div>
  );
}
