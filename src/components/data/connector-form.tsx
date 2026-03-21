'use client';

import React, { useState } from 'react';
import { Database, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface ConnectorFormProps {
  onConnect?: (connector: ConnectorResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface ConnectorResult {
  id: string;
  name: string;
  type: string;
  status: string;
  message?: string;
  serverVersion?: string;
}

type DbType = 'postgres' | 'mysql' | 'sqlite';

const DB_TYPES: Array<{ value: DbType; label: string; defaultPort: number }> = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'sqlite', label: 'SQLite', defaultPort: 0 },
];

export function ConnectorForm({ onConnect, onError, className = '' }: ConnectorFormProps) {
  const [dbType, setDbType] = useState<DbType>('postgres');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(true);
  const [connectionString, setConnectionString] = useState('');
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [result, setResult] = useState<ConnectorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (type: DbType) => {
    setDbType(type);
    const dbInfo = DB_TYPES.find((d) => d.value === type);
    if (dbInfo) setPort(String(dbInfo.defaultPort));
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        action: 'add',
        connector: {
          type: dbType,
          name: name || `${dbType}-connection`,
          ...(useConnectionString
            ? { connectionString }
            : {
                host,
                port: parseInt(port, 10),
                database,
                username,
                password,
                ssl,
              }),
        },
      };

      const response = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      setResult(data.connector);
      onConnect?.(data.connector);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={`${className}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Database Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Database Type
          </label>
          <div className="flex gap-2">
            {DB_TYPES.map((db) => (
              <button
                key={db.value}
                type="button"
                onClick={() => handleTypeChange(db.value)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  dbType === db.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="w-4 h-4" />
                {db.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connection Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Connection Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Production DB"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Connection String Toggle */}
        {dbType !== 'sqlite' && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={useConnectionString}
              onChange={(e) => setUseConnectionString(e.target.checked)}
              className="rounded"
            />
            Use connection string
          </label>
        )}

        {useConnectionString && dbType !== 'sqlite' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Connection String
            </label>
            <input
              type="password"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="postgresql://user:pass@host:5432/database"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>
        ) : dbType !== 'sqlite' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Host</label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="localhost"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Database</label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="my_database"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="postgres"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="rounded"
              />
              Use SSL
            </label>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              SQLite File Path
            </label>
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="/path/to/database.db"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing Connection...
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Connect
            </>
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className={`mt-3 p-3 rounded-lg border ${
          result.status === 'connected'
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {result.status === 'connected' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {result.status === 'connected' ? 'Connected' : 'Connection Failed'}
            </span>
          </div>
          {result.serverVersion && (
            <p className="text-xs text-gray-500 mt-1">Server: {result.serverVersion}</p>
          )}
          {result.message && result.status !== 'connected' && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{result.message}</p>
          )}
        </div>
      )}

      {error && !result && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
