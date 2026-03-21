'use client';

import React from 'react';
import {
  ArrowDown,
  X,
  Plus,
  Table2,
  Clock,
  Rows,
  Columns,
  GitBranch,
} from 'lucide-react';
import type { TransformPipeline, TransformStep } from '@/lib/transforms/types';

interface TransformPipelineViewProps {
  pipeline: TransformPipeline;
  onRemoveStep?: (stepId: string) => void;
  onAddStep?: () => void;
  className?: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMs(ms: number): string {
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)}s`;
  return `${ms}ms`;
}

function DeltaBadge({ before, after, label }: { before: number; after: number; label: string }) {
  const delta = after - before;
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
        isPositive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
          : isNegative
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
      title={`${label}: ${before.toLocaleString()} -> ${after.toLocaleString()} (${delta >= 0 ? '+' : ''}${delta.toLocaleString()})`}
    >
      {label} {formatCount(before)} &rarr; {formatCount(after)}
      {delta !== 0 && (
        <span className="opacity-75">
          ({isPositive ? '+' : ''}{formatCount(delta)})
        </span>
      )}
    </span>
  );
}

function StepCard({
  step,
  index,
  onRemove,
}: {
  step: TransformStep;
  index: number;
  onRemove?: () => void;
}) {
  const rowDelta = step.outputRowCount - step.inputRowCount;
  const borderColor =
    rowDelta > 0
      ? 'border-green-300 dark:border-green-700'
      : rowDelta < 0
        ? 'border-red-300 dark:border-red-700'
        : 'border-gray-200 dark:border-gray-700';

  return (
    <div
      className={`relative border ${borderColor} rounded-lg bg-white dark:bg-gray-900 p-3 shadow-sm transition-colors`}
    >
      {/* Step header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs font-semibold text-blue-700 dark:text-blue-300">
            {index + 1}
          </span>
          <div className="min-w-0">
            <span className="inline-block text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
              {step.type.replace(/_/g, ' ')}
            </span>
            <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
              {step.description}
            </p>
          </div>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="flex-shrink-0 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove step"
            aria-label={`Remove step ${index + 1}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <DeltaBadge before={step.inputRowCount} after={step.outputRowCount} label="Rows" />
        <DeltaBadge before={step.inputColumnCount} after={step.outputColumnCount} label="Cols" />
        <span
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500"
          title={`Execution time: ${step.executionTimeMs}ms`}
        >
          <Clock className="w-3 h-3" />
          {formatMs(step.executionTimeMs)}
        </span>
        {step.createdBy === 'ai' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 font-medium">
            AI
          </span>
        )}
      </div>
    </div>
  );
}

function ConnectorArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowDown className="w-4 h-4 text-gray-300 dark:text-gray-600" />
    </div>
  );
}

export function TransformPipelineView({
  pipeline,
  onRemoveStep,
  onAddStep,
  className = '',
}: TransformPipelineViewProps) {
  const { steps } = pipeline;

  const originalRows = steps.length > 0 ? steps[0].inputRowCount : 0;
  const finalRows = steps.length > 0 ? steps[steps.length - 1].outputRowCount : originalRows;
  const originalCols = steps.length > 0 ? steps[0].inputColumnCount : 0;
  const finalCols = steps.length > 0 ? steps[steps.length - 1].outputColumnCount : originalCols;
  const totalExecutionMs = steps.reduce((sum, s) => sum + s.executionTimeMs, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Summary bar */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {pipeline.name}
          </h3>
          <span
            className={`ml-auto text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${
              pipeline.status === 'executed'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : pipeline.status === 'failed'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
            }`}
          >
            {pipeline.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Table2 className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Source: <strong className="text-gray-800 dark:text-gray-200">{pipeline.sourceTable}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Rows className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Rows: <strong className="text-gray-800 dark:text-gray-200">{formatCount(originalRows)}</strong>
              {' '}&rarr;{' '}
              <strong
                className={
                  finalRows > originalRows
                    ? 'text-green-600 dark:text-green-400'
                    : finalRows < originalRows
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-800 dark:text-gray-200'
                }
              >
                {formatCount(finalRows)}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Columns className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Cols: <strong className="text-gray-800 dark:text-gray-200">{formatCount(originalCols)}</strong>
              {' '}&rarr;{' '}
              <strong className="text-gray-800 dark:text-gray-200">{formatCount(finalCols)}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>
              {steps.length} step{steps.length !== 1 ? 's' : ''} in{' '}
              <strong className="text-gray-800 dark:text-gray-200">{formatMs(totalExecutionMs)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline steps */}
      {steps.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          No transform steps yet. Add a step to get started.
        </div>
      ) : (
        <div className="space-y-0">
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              {i > 0 && <ConnectorArrow />}
              <StepCard
                step={step}
                index={i}
                onRemove={onRemoveStep ? () => onRemoveStep(step.id) : undefined}
              />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Add Step button */}
      {onAddStep && (
        <>
          {steps.length > 0 && <ConnectorArrow />}
          <button
            onClick={onAddStep}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </>
      )}
    </div>
  );
}
