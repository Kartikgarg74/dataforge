'use client';

import React from 'react';
import type { ColumnInfo } from '@/lib/connectors/interface';

export interface TableDescriptionData {
  description: string;
  businessName: string;
  commonQuestions: string;
  columns: Record<
    string,
    {
      description: string;
      businessName: string;
      unit: string;
      isMetric: boolean;
      isDimension: boolean;
      sensitivity: 'public' | 'internal' | 'restricted';
    }
  >;
}

interface TableDescriptionFormProps {
  tableName: string;
  columns: ColumnInfo[];
  data: TableDescriptionData;
  onChange: (data: TableDescriptionData) => void;
}

export function TableDescriptionForm({
  tableName,
  columns,
  data,
  onChange,
}: TableDescriptionFormProps) {
  const updateField = <K extends keyof TableDescriptionData>(
    key: K,
    value: TableDescriptionData[K],
  ) => {
    onChange({ ...data, [key]: value });
  };

  const updateColumn = (
    columnName: string,
    field: string,
    value: string | boolean,
  ) => {
    const colData = data.columns[columnName] ?? {
      description: '',
      businessName: '',
      unit: '',
      isMetric: false,
      isDimension: false,
      sensitivity: 'public' as const,
    };

    onChange({
      ...data,
      columns: {
        ...data.columns,
        [columnName]: { ...colData, [field]: value },
      },
    });
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
        {tableName}
      </h3>

      {/* Table-level fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Business Name
          </label>
          <input
            type="text"
            value={data.businessName}
            onChange={(e) => updateField('businessName', e.target.value)}
            placeholder={`Friendly name for ${tableName}`}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Description
          </label>
          <textarea
            value={data.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="What does this table contain?"
            rows={2}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Common Questions (one per line)
        </label>
        <textarea
          value={data.commonQuestions}
          onChange={(e) => updateField('commonQuestions', e.target.value)}
          placeholder={"What are the total sales by region?\nShow me the top 10 products by revenue"}
          rows={3}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />
      </div>

      {/* Column-level fields */}
      <div>
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
          Columns
        </h4>
        <div className="space-y-3">
          {columns.map((col) => {
            const colData = data.columns[col.name] ?? {
              description: '',
              businessName: '',
              unit: '',
              isMetric: false,
              isDimension: false,
              sensitivity: 'public' as const,
            };

            return (
              <div
                key={col.name}
                className="grid grid-cols-[140px_1fr_1fr_80px_auto_auto_auto] gap-2 items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2"
              >
                {/* Column name */}
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                  {col.name}
                  <span className="block text-[10px] text-gray-400">
                    {col.nativeType}
                  </span>
                </span>

                {/* Description */}
                <input
                  type="text"
                  value={colData.description}
                  onChange={(e) =>
                    updateColumn(col.name, 'description', e.target.value)
                  }
                  placeholder="Description"
                  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
                />

                {/* Business name */}
                <input
                  type="text"
                  value={colData.businessName}
                  onChange={(e) =>
                    updateColumn(col.name, 'businessName', e.target.value)
                  }
                  placeholder="Business name"
                  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
                />

                {/* Unit */}
                <input
                  type="text"
                  value={colData.unit}
                  onChange={(e) =>
                    updateColumn(col.name, 'unit', e.target.value)
                  }
                  placeholder="Unit"
                  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
                />

                {/* isMetric toggle */}
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colData.isMetric}
                    onChange={(e) =>
                      updateColumn(col.name, 'isMetric', e.target.checked)
                    }
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    Metric
                  </span>
                </label>

                {/* isDimension toggle */}
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colData.isDimension}
                    onChange={(e) =>
                      updateColumn(col.name, 'isDimension', e.target.checked)
                    }
                    className="rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    Dimension
                  </span>
                </label>

                {/* Sensitivity dropdown */}
                <select
                  value={colData.sensitivity}
                  onChange={(e) =>
                    updateColumn(col.name, 'sensitivity', e.target.value)
                  }
                  className="px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
