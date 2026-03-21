'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Shield, ChevronDown, X } from 'lucide-react';

type TableVisibility = 'visible' | 'hidden' | 'restricted';
type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

const ALL_ROLES: UserRole[] = ['owner', 'admin', 'editor', 'viewer'];

interface TablePermissionState {
  visibility: TableVisibility;
  allowedRoles: UserRole[];
  hiddenColumns: string[];
}

interface TablePermissionsEditorProps {
  connectorId: string;
  tables: string[];
}

export function TablePermissionsEditor({
  connectorId,
  tables,
}: TablePermissionsEditorProps) {
  const [permissions, setPermissions] = useState<
    Record<string, TablePermissionState>
  >({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [columnsMap, setColumnsMap] = useState<Record<string, string[]>>({});

  // Load existing permissions
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', connectorId }),
        });
        const data = await res.json();
        if (data.success && data.permissions) {
          const map: Record<string, TablePermissionState> = {};
          for (const p of data.permissions) {
            map[p.tableName] = {
              visibility: p.visibility,
              allowedRoles: p.allowedRoles,
              hiddenColumns: p.hiddenColumns,
            };
          }
          setPermissions(map);
        }
      } catch {
        // Permissions not loaded — start fresh
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [connectorId]);

  const getPermission = useCallback(
    (table: string): TablePermissionState => {
      return (
        permissions[table] ?? {
          visibility: 'visible' as TableVisibility,
          allowedRoles: [],
          hiddenColumns: [],
        }
      );
    },
    [permissions],
  );

  const updatePermission = (
    table: string,
    updates: Partial<TablePermissionState>,
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [table]: { ...getPermission(table), ...updates },
    }));
  };

  const toggleRole = (table: string, role: UserRole) => {
    const perm = getPermission(table);
    const roles = perm.allowedRoles.includes(role)
      ? perm.allowedRoles.filter((r) => r !== role)
      : [...perm.allowedRoles, role];
    updatePermission(table, { allowedRoles: roles });
  };

  const toggleHiddenColumn = (table: string, column: string) => {
    const perm = getPermission(table);
    const cols = perm.hiddenColumns.includes(column)
      ? perm.hiddenColumns.filter((c) => c !== column)
      : [...perm.hiddenColumns, column];
    updatePermission(table, { hiddenColumns: cols });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      for (const table of tables) {
        const perm = getPermission(table);
        await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set',
            connectorId,
            tableName: table,
            visibility: perm.visibility,
            allowedRoles: perm.allowedRoles,
            hiddenColumns: perm.hiddenColumns,
          }),
        });
      }
      setMessage({ type: 'success', text: 'Permissions saved successfully.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save permissions.' });
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
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Table Permissions
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Table
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Visibility
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Allowed Roles
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Hidden Columns
              </th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const perm = getPermission(table);
              const availableColumns = columnsMap[table] ?? [];

              return (
                <tr
                  key={table}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  {/* Table name */}
                  <td className="py-3 px-4">
                    <span className="font-mono text-gray-900 dark:text-white">
                      {table}
                    </span>
                  </td>

                  {/* Visibility dropdown */}
                  <td className="py-3 px-4">
                    <div className="relative">
                      <select
                        value={perm.visibility}
                        onChange={(e) =>
                          updatePermission(table, {
                            visibility: e.target.value as TableVisibility,
                          })
                        }
                        className="appearance-none w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 pr-8 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="visible">Visible</option>
                        <option value="hidden">Hidden</option>
                        <option value="restricted">Restricted</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </td>

                  {/* Role checkboxes */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      {ALL_ROLES.map((role) => (
                        <label
                          key={role}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={perm.allowedRoles.includes(role)}
                            onChange={() => toggleRole(table, role)}
                            disabled={perm.visibility !== 'restricted'}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          />
                          <span
                            className={`text-xs ${
                              perm.visibility !== 'restricted'
                                ? 'text-gray-400'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {role}
                          </span>
                        </label>
                      ))}
                    </div>
                  </td>

                  {/* Hidden columns multi-select */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {perm.hiddenColumns.map((col) => (
                        <span
                          key={col}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full"
                        >
                          {col}
                          <button
                            type="button"
                            onClick={() => toggleHiddenColumn(table, col)}
                            className="hover:text-red-900 dark:hover:text-red-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder="Add column..."
                        className="w-28 px-2 py-0.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const value = (e.target as HTMLInputElement).value.trim();
                            if (value && !perm.hiddenColumns.includes(value)) {
                              toggleHiddenColumn(table, value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Permissions
            </>
          )}
        </button>
      </div>
    </div>
  );
}
