'use client';

import React, { useCallback } from 'react';
import type { QueryParameter } from '@/lib/dashboard/types';

interface QueryParameterFormProps {
  parameters: QueryParameter[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

/**
 * Renders a dynamic form for query parameters.
 * Supports date, string, number, and select parameter types.
 */
export function QueryParameterForm({
  parameters,
  values,
  onChange,
}: QueryParameterFormProps) {
  const handleChange = useCallback(
    (name: string, value: unknown) => {
      onChange({ ...values, [name]: value });
    },
    [values, onChange]
  );

  const missingRequired = parameters.filter(
    (p) => p.required && (values[p.name] === undefined || values[p.name] === '')
  );

  if (parameters.length === 0) return null;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Parameters
      </h4>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {parameters.map((param) => (
          <ParameterInput
            key={param.name}
            parameter={param}
            value={values[param.name]}
            onChange={handleChange}
          />
        ))}
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {missingRequired.length} required parameter{missingRequired.length > 1 ? 's' : ''} missing:{' '}
          {missingRequired.map((p) => p.label).join(', ')}
        </p>
      )}
    </div>
  );
}

interface ParameterInputProps {
  parameter: QueryParameter;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
}

function ParameterInput({ parameter, value, onChange }: ParameterInputProps) {
  const { name, type, label, required, options, defaultValue } = parameter;

  const currentValue = value ?? defaultValue ?? '';

  const inputClasses =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
    'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
    'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 ' +
    'dark:focus:border-blue-400 dark:focus:ring-blue-400';

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`param-${name}`}
        className="text-xs font-medium text-gray-600 dark:text-gray-400"
      >
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {type === 'select' && options ? (
        <select
          id={`param-${name}`}
          value={String(currentValue)}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputClasses}
          required={required}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : type === 'date' ? (
        <input
          id={`param-${name}`}
          type="date"
          value={String(currentValue)}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputClasses}
          required={required}
        />
      ) : type === 'number' ? (
        <input
          id={`param-${name}`}
          type="number"
          value={currentValue === '' ? '' : Number(currentValue)}
          onChange={(e) =>
            onChange(name, e.target.value === '' ? '' : Number(e.target.value))
          }
          className={inputClasses}
          placeholder={`Enter ${label.toLowerCase()}`}
          required={required}
        />
      ) : (
        <input
          id={`param-${name}`}
          type="text"
          value={String(currentValue)}
          onChange={(e) => onChange(name, e.target.value)}
          className={inputClasses}
          placeholder={`Enter ${label.toLowerCase()}`}
          required={required}
        />
      )}
    </div>
  );
}
