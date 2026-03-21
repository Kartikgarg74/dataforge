'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Database,
  Bell,
  Shield,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Check,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationPrefs {
  pushEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  environment: string;
  metrics?: Record<string, unknown>;
  alerts?: { message: string; level: string; ts: string }[];
}

// ---------------------------------------------------------------------------
// Expandable Card wrapper
// ---------------------------------------------------------------------------

function ExpandableCard({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk_live_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function maskKey(key: string): string {
  if (key.length <= 12) return '*'.repeat(key.length);
  return key.slice(0, 8) + '*'.repeat(key.length - 12) + key.slice(-4);
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  // --- Database state ---
  const dbProvider = process.env.NEXT_PUBLIC_DB_PROVIDER || 'sqlite';
  const apiAuthRequired = process.env.NEXT_PUBLIC_API_AUTH === 'true';

  // --- Notification state ---
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    pushEnabled: false,
    emailEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  });
  const [notifSaved, setNotifSaved] = useState(false);

  // --- Security state ---
  const [apiKey, setApiKey] = useState('');
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [csrfToken] = useState(() =>
    typeof window !== 'undefined'
      ? crypto.randomUUID()
      : '00000000-0000-0000-0000-000000000000',
  );

  // Load persisted notification prefs and api key from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('notificationPrefs');
      if (stored) setNotifPrefs(JSON.parse(stored));

      const storedKey = localStorage.getItem('apiKey');
      if (storedKey) {
        setApiKey(storedKey);
      } else {
        const newKey = generateApiKey();
        setApiKey(newKey);
        localStorage.setItem('apiKey', newKey);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Save notification preferences
  const saveNotifPrefs = useCallback(() => {
    localStorage.setItem('notificationPrefs', JSON.stringify(notifPrefs));
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2000);
  }, [notifPrefs]);

  // Generate new API key
  const handleGenerateKey = useCallback(() => {
    setGeneratingKey(true);
    setTimeout(() => {
      const newKey = generateApiKey();
      setApiKey(newKey);
      localStorage.setItem('apiKey', newKey);
      setKeyRevealed(true);
      setGeneratingKey(false);
    }, 600);
  }, []);

  // Fetch health / audit data
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch {
      setHealthData({ status: 'error', timestamp: new Date().toISOString(), environment: 'unknown' });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* ================================================================ */}
        {/* DATABASE SECTION                                                 */}
        {/* ================================================================ */}
        <ExpandableCard
          icon={Database}
          title="Database"
          description="Default database provider and connection settings"
          defaultOpen
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {/* DB Provider */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Database Provider
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">
                {dbProvider}
              </p>
            </div>

            {/* API Auth */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                API Auth Required
              </p>
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                  apiAuthRequired
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-yellow-700 dark:text-yellow-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiAuthRequired ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                />
                {apiAuthRequired ? 'Enabled' : 'Disabled'}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                Set <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">NEXT_PUBLIC_API_AUTH=true</code> in your env to enable.
              </p>
            </div>
          </div>
        </ExpandableCard>

        {/* ================================================================ */}
        {/* NOTIFICATIONS SECTION                                            */}
        {/* ================================================================ */}
        <ExpandableCard
          icon={Bell}
          title="Notifications"
          description="Push, email, and in-app notification preferences"
        >
          {/* Push toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Push Notifications</p>
              <p className="text-xs text-gray-500">Receive browser push notifications</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifPrefs.pushEnabled}
              onClick={() => setNotifPrefs((p) => ({ ...p, pushEnabled: !p.pushEnabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifPrefs.pushEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifPrefs.pushEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          {/* Email toggle */}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Email Notifications</p>
              <p className="text-xs text-gray-500">Receive email alerts for important events</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notifPrefs.emailEnabled}
              onClick={() => setNotifPrefs((p) => ({ ...p, emailEnabled: !p.emailEnabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifPrefs.emailEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifPrefs.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          {/* Quiet hours */}
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Quiet Hours</p>
            <div className="flex items-center gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Start</label>
                <input
                  type="time"
                  value={notifPrefs.quietHoursStart}
                  onChange={(e) =>
                    setNotifPrefs((p) => ({ ...p, quietHoursStart: e.target.value }))
                  }
                  className="block mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <span className="text-gray-400 mt-5">to</span>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">End</label>
                <input
                  type="time"
                  value={notifPrefs.quietHoursEnd}
                  onChange={(e) =>
                    setNotifPrefs((p) => ({ ...p, quietHoursEnd: e.target.value }))
                  }
                  className="block mt-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={saveNotifPrefs}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {notifSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </ExpandableCard>

        {/* ================================================================ */}
        {/* SECURITY SECTION                                                 */}
        {/* ================================================================ */}
        <ExpandableCard
          icon={Shield}
          title="Security"
          description="API keys, session management, audit logs"
        >
          {/* API Key */}
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">API Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono break-all">
                {keyRevealed ? apiKey : maskKey(apiKey)}
              </code>
              <button
                type="button"
                onClick={() => setKeyRevealed((v) => !v)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title={keyRevealed ? 'Hide' : 'Reveal'}
              >
                {keyRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerateKey}
              disabled={generatingKey}
              className="mt-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors disabled:opacity-50"
            >
              {generatingKey ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Generate New API Key
            </button>
          </div>

          {/* CSRF Token */}
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">CSRF Token</p>
            <code className="block px-3 py-2 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-gray-600 dark:text-gray-400 break-all">
              {csrfToken}
            </code>
          </div>

          {/* Audit Log */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Audit Log</p>
              <button
                type="button"
                onClick={fetchHealth}
                disabled={healthLoading}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                {healthLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Refresh
              </button>
            </div>

            {healthData ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      healthData.status === 'ok' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Status: {healthData.status}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{healthData.timestamp}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500">{healthData.environment}</span>
                </div>

                {healthData.alerts && healthData.alerts.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {healthData.alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`px-3 py-1.5 text-xs rounded-lg border ${
                          alert.level === 'error'
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                            : alert.level === 'warn'
                            ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <span className="font-medium">[{alert.level}]</span> {alert.message}
                        {alert.ts && (
                          <span className="ml-2 text-gray-400">{alert.ts}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No recent alerts. System is healthy.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">
                Click &quot;Refresh&quot; to load audit log from /api/health.
              </p>
            )}
          </div>
        </ExpandableCard>

        {/* ================================================================ */}
        {/* BILLING SECTION                                                  */}
        {/* ================================================================ */}
        <ExpandableCard
          icon={CreditCard}
          title="Billing"
          description="Plan, usage, and payment settings"
        >
          {/* Current Plan */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Current Plan:
            </span>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              Free
            </span>
          </div>

          {/* Feature Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 text-left font-medium text-gray-500 dark:text-gray-400">
                    Feature
                  </th>
                  <th className="py-2 px-4 text-center font-medium text-gray-500 dark:text-gray-400">
                    Free
                  </th>
                  <th className="py-2 px-4 text-center font-medium text-gray-500 dark:text-gray-400">
                    Pro
                  </th>
                  <th className="py-2 px-4 text-center font-medium text-gray-500 dark:text-gray-400">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {[
                  { feature: 'Queries / month', free: '100', pro: '10,000', enterprise: 'Unlimited' },
                  { feature: 'Dashboards', free: '3', pro: '50', enterprise: 'Unlimited' },
                  { feature: 'Team members', free: '1', pro: '10', enterprise: 'Unlimited' },
                  { feature: 'API access', free: 'No', pro: 'Yes', enterprise: 'Yes' },
                  { feature: 'SSO / SAML', free: 'No', pro: 'No', enterprise: 'Yes' },
                  { feature: 'Priority support', free: 'No', pro: 'Email', enterprise: '24/7' },
                ].map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 pr-4 font-medium">{row.feature}</td>
                    <td className="py-2 px-4 text-center">{row.free}</td>
                    <td className="py-2 px-4 text-center">{row.pro}</td>
                    <td className="py-2 px-4 text-center">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Upgrade button */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled
              className="px-4 py-2 text-sm font-medium text-white bg-gray-400 dark:bg-gray-600 rounded-lg cursor-not-allowed"
            >
              Upgrade (Coming Soon)
            </button>
          </div>
        </ExpandableCard>
      </div>
    </div>
  );
}
