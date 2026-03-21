'use client';

import React, { useState } from 'react';
import { FileDropZone } from '@/components/data/file-drop-zone';
import { DataPreviewTable } from '@/components/data/data-preview-table';
import { ProfileDashboard } from '@/components/data/profile-dashboard';
import { ExportDialog } from '@/components/data/export-dialog';
import { Upload, BarChart3, Download } from 'lucide-react';

type Tab = 'preview' | 'profile' | 'export';

export default function UploadPage() {
  const [uploadResult, setUploadResult] = useState<{
    table: { name: string; rowCount: number; columnCount: number; columns: Array<{ name: string; type: string }> };
    preview: { rows: Record<string, unknown>[]; totalRows: number };
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('preview');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Upload className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Upload Data</h1>
          <p className="text-sm text-gray-500">Upload CSV, JSON, Parquet, or Excel files to explore and transform</p>
        </div>
      </div>

      <FileDropZone
        onUploadComplete={(result) => {
          setUploadResult(result as typeof uploadResult);
          setActiveTab('preview');
        }}
        className="mb-6"
      />

      {uploadResult && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
            {([
              { id: 'preview' as Tab, label: 'Preview', icon: Upload },
              { id: 'profile' as Tab, label: 'Profile', icon: BarChart3 },
              { id: 'export' as Tab, label: 'Export', icon: Download },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'preview' && (
            <DataPreviewTable
              rows={uploadResult.preview.rows}
              columns={uploadResult.table.columns}
              maxRows={100}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileDashboard table={uploadResult.table.name} />
          )}

          {activeTab === 'export' && (
            <ExportDialog
              table={uploadResult.table.name}
              rowCount={uploadResult.table.rowCount}
            />
          )}
        </>
      )}
    </div>
  );
}
