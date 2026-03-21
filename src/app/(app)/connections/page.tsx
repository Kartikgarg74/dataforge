'use client';

import React, { useState } from 'react';
import { ConnectorForm } from '@/components/data/connector-form';
import { ConnectorList } from '@/components/data/connector-list';
import { Database, Plus } from 'lucide-react';

export default function ConnectionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Connections</h1>
            <p className="text-sm text-gray-500">Connect to PostgreSQL, MySQL, SQLite, and more</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Connection
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <ConnectorForm
            onConnect={() => {
              setShowForm(false);
              setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <ConnectorList key={refreshKey} />
      </div>
    </div>
  );
}
