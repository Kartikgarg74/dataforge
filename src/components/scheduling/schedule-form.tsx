'use client';

import React, { useState } from 'react';
import { Clock, Mail, MessageSquare, Globe, Loader2, AlertTriangle } from 'lucide-react';

interface ScheduleFormProps {
  sourceType: 'dashboard' | 'query';
  sourceId: string;
  sourceName: string;
  onCreated?: () => void;
  className?: string;
}

type ScheduleType = 'report' | 'alert';
type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

const FREQUENCY_CRONS: Record<Frequency, string> = {
  hourly: '0 * * * *',
  daily: '0 9 * * *',
  weekly: '0 9 * * 1',
  monthly: '0 9 1 * *',
};

export function ScheduleForm({
  sourceType,
  sourceId,
  sourceName,
  onCreated,
  className = '',
}: ScheduleFormProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>('report');
  const [name, setName] = useState(`${sourceName} - Report`);
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [alertColumn, setAlertColumn] = useState('');
  const [alertCondition, setAlertCondition] = useState<'gt' | 'lt' | 'change_pct'>('gt');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const channels: Record<string, unknown> = {};
      if (emailRecipients.trim()) {
        channels.email = { recipients: emailRecipients.split(',').map((e) => e.trim()) };
      }
      if (slackWebhook.trim()) {
        channels.slack = { webhookUrl: slackWebhook };
      }
      if (webhookUrl.trim()) {
        channels.webhook = { url: webhookUrl };
      }

      if (Object.keys(channels).length === 0) {
        setError('Add at least one delivery channel (email, Slack, or webhook)');
        setIsCreating(false);
        return;
      }

      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          type: scheduleType,
          source: { type: sourceType, id: sourceId },
          cron: FREQUENCY_CRONS[frequency],
          timezone,
          channels,
          alert: scheduleType === 'alert' ? {
            condition: alertCondition,
            threshold: parseFloat(alertThreshold),
            column: alertColumn,
          } : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create schedule');
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Schedule: {sourceName}
      </h3>

      {/* Type */}
      <div className="flex gap-2">
        {(['report', 'alert'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setScheduleType(t)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              scheduleType === t
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {t === 'report' ? <Mail className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {t === 'report' ? 'Scheduled Report' : 'Threshold Alert'}
          </button>
        ))}
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
        <div className="grid grid-cols-4 gap-2">
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
                frequency === f
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
        />
      </div>

      {/* Alert config */}
      {scheduleType === 'alert' && (
        <div className="space-y-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Column to Monitor</label>
            <input
              value={alertColumn}
              onChange={(e) => setAlertColumn(e.target.value)}
              placeholder="revenue, user_count, etc."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Condition</label>
              <select
                value={alertCondition}
                onChange={(e) => setAlertCondition(e.target.value as 'gt' | 'lt' | 'change_pct')}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
              >
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="change_pct">Change % exceeds</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Threshold</label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="1000"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Channels */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-gray-500">Delivery Channels</label>

        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={emailRecipients}
            onChange={(e) => setEmailRecipients(e.target.value)}
            placeholder="email@example.com, another@example.com"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={slackWebhook}
            onChange={(e) => setSlackWebhook(e.target.value)}
            placeholder="Slack webhook URL"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="Custom webhook URL"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isCreating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
      >
        {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
        Create Schedule
      </button>
    </form>
  );
}
