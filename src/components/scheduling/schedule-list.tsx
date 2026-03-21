'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Play, Pause, Trash2, Loader2, AlertTriangle, Mail } from 'lucide-react';

interface ScheduleItem {
  id: string;
  name: string;
  type: 'report' | 'alert';
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: string;
  channels: Record<string, unknown>;
}

interface ScheduleListProps {
  teamId?: string;
  className?: string;
}

const CRON_LABELS: Record<string, string> = {
  '0 * * * *': 'Every hour',
  '0 9 * * *': 'Daily at 9 AM',
  '0 9 * * 1': 'Weekly (Monday 9 AM)',
  '0 9 1 * *': 'Monthly (1st at 9 AM)',
};

export function ScheduleList({ teamId, className = '' }: ScheduleListProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', teamId: teamId || '' }),
      });
      const data = await res.json();
      if (data.success) setSchedules(data.schedules || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', scheduleId: id, enabled }),
    });
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', scheduleId: id }),
    });
    fetchSchedules();
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  if (schedules.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No schedules yet</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {schedules.map((s) => (
        <div key={s.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center gap-3 min-w-0">
            {s.type === 'alert'
              ? <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              : <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
            }
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-xs text-gray-500">
                {CRON_LABELS[s.cronExpression] || s.cronExpression}
                {s.lastRunAt && ` · Last: ${new Date(s.lastRunAt).toLocaleDateString()}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`px-1.5 py-0.5 text-[9px] rounded ${
              s.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {s.enabled ? 'ACTIVE' : 'PAUSED'}
            </span>
            <button
              onClick={() => handleToggle(s.id, !s.enabled)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title={s.enabled ? 'Pause' : 'Resume'}
            >
              {s.enabled ? <Pause className="w-3.5 h-3.5 text-gray-400" /> : <Play className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
            >
              <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
