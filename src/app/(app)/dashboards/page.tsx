'use client';

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Plus, Loader2 } from 'lucide-react';

interface DashboardSummary {
  id: string;
  name: string;
  description?: string;
  widgetCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', teamId: '' }),
      });
      const data = await res.json();
      if (data.success) setDashboards(data.dashboards || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: newName, teamId: '', createdBy: '' }),
      });
      const data = await res.json();
      if (data.success) {
        setNewName('');
        setShowCreate(false);
        fetchDashboards();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboards</h1>
            <p className="text-sm text-gray-500">Create and manage your data dashboards</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Dashboard
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Dashboard name"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : dashboards.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
          <LayoutDashboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">No dashboards yet</h3>
          <p className="text-xs text-gray-400 mt-1">Create your first dashboard to start visualizing data</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d) => (
            <div
              key={d.id}
              className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
            >
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{d.name}</h3>
              {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span>{d.widgetCount || 0} widgets</span>
                {d.isPublic && <span className="text-green-500">Public</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
