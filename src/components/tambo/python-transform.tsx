"use client";

import { z } from 'zod';
import { useState } from 'react';
import DOMPurify from 'dompurify';

export const pythonTransformSchema = z.object({
  code: z.string().describe('Python code that was executed'),
  explanation: z.string().describe('What this code does in plain English'),
  inputRows: z.number().describe('Number of input rows'),
  outputRows: z.number().describe('Number of output rows after transformation'),
  newColumns: z.array(z.string()).optional().describe('New columns added by transformation'),
});

type PythonTransformProps = z.infer<typeof pythonTransformSchema>;

export function PythonTransform({ code, explanation, inputRows, outputRows, newColumns }: PythonTransformProps) {
  const [showCode, setShowCode] = useState(false);

  // Simple syntax highlighting mock
  const highlightedCode = code
    .split('\n')
    .map((line: string) => {
      const trimmed = line.trim();
      let color = 'text-slate-300';
      if (trimmed.startsWith('#')) color = 'text-gray-500';
      else if (trimmed.startsWith('import') || trimmed.startsWith('from')) color = 'text-pink-400';
      else if (trimmed.startsWith('def') || trimmed.startsWith('class')) color = 'text-blue-400';
      else if (trimmed.startsWith('return') || trimmed.startsWith('yield')) color = 'text-purple-400';
      else if (trimmed.includes('=') && !trimmed.startsWith('=')) color = 'text-green-400';
      return `<span class="${color}">${line}</span>`;
    })
    .join('\n');

  return (
    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm border border-slate-700">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-lg">🐍</span>
          <span className="text-green-400 font-semibold">Python AI Transformation</span>
        </div>
        <button 
          onClick={() => setShowCode(!showCode)}
          className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded transition-colors"
        >
          {showCode ? 'Hide Code' : 'Show Code'}
        </button>
      </div>
      
      <p className="text-slate-300 mb-3 text-sm leading-relaxed">{explanation}</p>
      
      {newColumns && newColumns.length > 0 && (
        <div className="mb-3 text-xs">
          <span className="text-yellow-400">New columns added:</span>{' '}
          {newColumns.map((col: string) => (
            <span key={col} className="bg-yellow-900 text-yellow-200 px-2 py-0.5 rounded mr-1">
              {col}
            </span>
          ))}
        </div>
      )}
      
      {showCode && (
        <div className="mb-3 p-3 bg-slate-800 rounded overflow-x-auto text-xs leading-relaxed">
          <pre dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(highlightedCode) : highlightedCode }} />
        </div>
      )}
      
      <div className="flex gap-4 text-xs text-slate-400 border-t border-slate-700 pt-2">
        <span>📥 Input: {inputRows} rows</span>
        <span>📤 Output: {outputRows} rows</span>
        <span className="text-green-500">✓ Executed successfully</span>
      </div>
    </div>
  );
}
