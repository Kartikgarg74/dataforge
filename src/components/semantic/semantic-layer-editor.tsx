'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, Plus, Trash2, Layers } from 'lucide-react';
import type { SchemaInfo } from '@/lib/connectors/interface';
import {
  TableDescriptionForm,
  type TableDescriptionData,
} from './table-description-form';

interface SynonymEntry {
  term: string;
  column: string;
}

interface MetricEntry {
  name: string;
  sql: string;
  description: string;
  unit: string;
}

interface SemanticLayerEditorProps {
  connectorId: string;
  schema: SchemaInfo;
}

export function SemanticLayerEditor({
  connectorId,
  schema,
}: SemanticLayerEditorProps) {
  const [tableData, setTableData] = useState<
    Record<string, TableDescriptionData>
  >({});
  const [synonyms, setSynonyms] = useState<SynonymEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Load existing semantic layer data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/semantic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', connectorId }),
        });
        const data = await res.json();
        if (data.success && data.semanticLayer) {
          const layer = data.semanticLayer;

          // Restore table data
          if (layer.tables) {
            const restored: Record<string, TableDescriptionData> = {};
            for (const [tableName, tableSem] of Object.entries(layer.tables) as Array<
              [string, Record<string, unknown>]
            >) {
              const columns: Record<string, TableDescriptionData['columns'][string]> = {};
              if (tableSem.columns && typeof tableSem.columns === 'object') {
                for (const [colName, colSem] of Object.entries(
                  tableSem.columns as Record<string, Record<string, unknown>>,
                )) {
                  columns[colName] = {
                    description: (colSem.description as string) ?? '',
                    businessName: (colSem.businessName as string) ?? '',
                    unit: (colSem.unit as string) ?? '',
                    isMetric: (colSem.isMetric as boolean) ?? false,
                    isDimension: (colSem.isDimension as boolean) ?? false,
                    sensitivity:
                      (colSem.sensitivityLevel as 'public' | 'internal' | 'restricted') ?? 'public',
                  };
                }
              }

              restored[tableName] = {
                description: (tableSem.description as string) ?? '',
                businessName: (tableSem.businessName as string) ?? '',
                commonQuestions: Array.isArray(tableSem.commonQuestions)
                  ? (tableSem.commonQuestions as string[]).join('\n')
                  : '',
                columns,
              };
            }
            setTableData(restored);
          }

          // Restore synonyms
          if (layer.synonyms && typeof layer.synonyms === 'object') {
            const restored: SynonymEntry[] = Object.entries(
              layer.synonyms as Record<string, string>,
            ).map(([term, column]) => ({ term, column }));
            setSynonyms(restored);
          }

          // Restore metrics
          if (layer.metrics && typeof layer.metrics === 'object') {
            const restored: MetricEntry[] = Object.entries(
              layer.metrics as Record<string, Record<string, string>>,
            ).map(([name, m]) => ({
              name,
              sql: m.sql ?? '',
              description: m.description ?? '',
              unit: m.unit ?? '',
            }));
            setMetrics(restored);
          }
        }
      } catch {
        // Fresh start
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [connectorId]);

  const getTableData = (tableName: string): TableDescriptionData => {
    return (
      tableData[tableName] ?? {
        description: '',
        businessName: '',
        commonQuestions: '',
        columns: {},
      }
    );
  };

  const handleTableChange = (
    tableName: string,
    data: TableDescriptionData,
  ) => {
    setTableData((prev) => ({ ...prev, [tableName]: data }));
  };

  // Synonym helpers
  const addSynonym = () => {
    setSynonyms((prev) => [...prev, { term: '', column: '' }]);
  };

  const updateSynonym = (
    index: number,
    field: 'term' | 'column',
    value: string,
  ) => {
    setSynonyms((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const removeSynonym = (index: number) => {
    setSynonyms((prev) => prev.filter((_, i) => i !== index));
  };

  // Metric helpers
  const addMetric = () => {
    setMetrics((prev) => [
      ...prev,
      { name: '', sql: '', description: '', unit: '' },
    ]);
  };

  const updateMetric = (
    index: number,
    field: keyof MetricEntry,
    value: string,
  ) => {
    setMetrics((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  };

  const removeMetric = (index: number) => {
    setMetrics((prev) => prev.filter((_, i) => i !== index));
  };

  // Build and save the semantic layer JSON
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Build tables object
      const tables: Record<string, unknown> = {};
      for (const { table } of schema.tables) {
        const td = getTableData(table.name);
        const columns: Record<string, unknown> = {};

        for (const [colName, colData] of Object.entries(td.columns)) {
          columns[colName] = {
            description: colData.description,
            businessName: colData.businessName || undefined,
            unit: colData.unit || undefined,
            isMetric: colData.isMetric || undefined,
            isDimension: colData.isDimension || undefined,
            sensitivityLevel: colData.sensitivity,
          };
        }

        tables[table.name] = {
          description: td.description,
          businessName: td.businessName || undefined,
          commonQuestions: td.commonQuestions
            ? td.commonQuestions
                .split('\n')
                .map((q) => q.trim())
                .filter(Boolean)
            : undefined,
          columns,
        };
      }

      // Build synonyms object
      const synonymsObj: Record<string, string> = {};
      for (const s of synonyms) {
        if (s.term.trim() && s.column.trim()) {
          synonymsObj[s.term.trim()] = s.column.trim();
        }
      }

      // Build metrics object
      const metricsObj: Record<string, unknown> = {};
      for (const m of metrics) {
        if (m.name.trim()) {
          metricsObj[m.name.trim()] = {
            sql: m.sql,
            description: m.description,
            unit: m.unit,
          };
        }
      }

      const semanticLayer = {
        tables,
        synonyms: Object.keys(synonymsObj).length > 0 ? synonymsObj : undefined,
        metrics: Object.keys(metricsObj).length > 0 ? metricsObj : undefined,
      };

      const res = await fetch('/api/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          connectorId,
          semanticLayer,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Semantic layer saved successfully.' });
      } else {
        throw new Error(result.error ?? 'Unknown error');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Semantic Layer Editor
        </h2>
      </div>

      {/* Table descriptions */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Tables
        </h3>
        {schema.tables.map(({ table, columns }) => (
          <TableDescriptionForm
            key={table.name}
            tableName={table.name}
            columns={columns}
            data={getTableData(table.name)}
            onChange={(d) => handleTableChange(table.name, d)}
          />
        ))}
      </div>

      {/* Synonyms */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Synonyms (Business Term to Column Mapping)
          </h3>
          <button
            type="button"
            onClick={addSynonym}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Synonym
          </button>
        </div>

        {synonyms.length === 0 && (
          <p className="text-xs text-gray-400 italic">
            No synonyms defined. Add one to map business terms to column names.
          </p>
        )}

        {synonyms.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={s.term}
              onChange={(e) => updateSynonym(i, 'term', e.target.value)}
              placeholder="Business term"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-gray-400 text-sm">maps to</span>
            <input
              type="text"
              value={s.column}
              onChange={(e) => updateSynonym(i, 'column', e.target.value)}
              placeholder="table.column"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={() => removeSynonym(i)}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Custom Metrics
          </h3>
          <button
            type="button"
            onClick={addMetric}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Metric
          </button>
        </div>

        {metrics.length === 0 && (
          <p className="text-xs text-gray-400 italic">
            No custom metrics defined. Add one to define reusable SQL-based metrics.
          </p>
        )}

        {metrics.map((m, i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateMetric(i, 'name', e.target.value)}
                  placeholder="Metric name"
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={m.description}
                  onChange={(e) =>
                    updateMetric(i, 'description', e.target.value)
                  }
                  placeholder="Description"
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={m.unit}
                  onChange={(e) => updateMetric(i, 'unit', e.target.value)}
                  placeholder="Unit (e.g. USD, %)"
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeMetric(i)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={m.sql}
              onChange={(e) => updateMetric(i, 'sql', e.target.value)}
              placeholder="SQL expression, e.g. SUM(amount) / COUNT(DISTINCT customer_id)"
              className="w-full px-3 py-1.5 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Semantic Layer
            </>
          )}
        </button>
      </div>
    </div>
  );
}
