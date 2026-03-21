'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ConnectorForm } from '@/components/data/connector-form';
import { ArrowLeft, Database } from 'lucide-react';

export default function NewConnectionPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/connections')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Connections
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Database className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            New Connection
          </h1>
          <p className="text-sm text-gray-500">
            Connect to a PostgreSQL, MySQL, or SQLite database
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <ConnectorForm
          onConnect={() => {
            router.push('/connections');
          }}
        />
      </div>
    </div>
  );
}
