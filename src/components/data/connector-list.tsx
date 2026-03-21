'use client';

import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, AlertCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';

interface ConnectionInfo {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  statusMessage?: string;
  tables?: number;
  lastUsed?: string;
  createdAt: string;
}

interface ConnectorListProps {
  onSelect?: (connectorId: string) => void;
  className?: string;
}

const DB_TYPE_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
  bigquery: 'BigQuery',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  connected: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  disconnected: <AlertCircle className="w-3.5 h-3.5 text-gray-400" />,
  error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

export function ConnectorList({ onSelect, className = '' }: ConnectorListProps) {
  const [connectors, setConnectors] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchConnectors = async () => {
    try {
      const response = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      const data = await response.json();
      if (data.success) {
        setConnectors(data.connectors);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const response = await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', connectorId: id }),
      });
      await response.json();
      await fetchConnectors(); // Refresh list
    } catch {
      // Silently fail
    } finally {
      setTestingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch('/api/connector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', connectorId: id }),
      });
      await fetchConnectors();
    } catch {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No connections yet</p>
        <p className="text-xs text-gray-400 mt-1">Add a database connection to get started</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {connectors.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
          onClick={() => onSelect?.(conn.id)}
        >
          <div className="flex items-center gap-3 min-w-0">
            {STATUS_ICONS[conn.status]}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{conn.name}</div>
              <div className="text-xs text-gray-500">
                {DB_TYPE_LABELS[conn.type] || conn.type}
                {conn.tables !== undefined && ` · ${conn.tables} tables`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handleTest(conn.id); }}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Test connection"
            >
              {testingId === conn.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                : <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
              }
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleRemove(conn.id); }}
              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Remove connection"
            >
              <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
