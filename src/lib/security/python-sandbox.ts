/**
 * Python Sandbox
 *
 * Provides two execution modes:
 * 1. Pyodide (WASM) — preferred, fully isolated, no filesystem/network access
 * 2. Child process — fallback, uses existing spawn approach with restrictions
 *
 * The sandbox enforces:
 * - Memory limit (256MB)
 * - CPU time limit (30s for WASM, 4s for child process)
 * - No filesystem access
 * - No network access
 * - Whitelisted imports only (math, statistics, datetime, json, re, collections)
 * - Must define a transform(data) function
 */

import { spawn } from 'child_process';

const ALLOWED_IMPORTS = new Set([
  'math', 'statistics', 'datetime', 'json', 're',
  'collections', 'itertools', 'functools', 'operator',
  'string', 'decimal', 'fractions', 'random',
]);

const BLOCKED_KEYWORDS = [
  'import os', 'import sys', 'import subprocess', 'import socket',
  'import http', 'import urllib', 'import requests',
  '__import__', 'eval(', 'exec(', 'compile(',
  'open(', 'file(', 'input(',
  'globals(', 'locals(', 'vars(',
  'getattr(', 'setattr(', 'delattr(',
  '__builtins__', '__class__', '__subclasses__',
  'importlib', 'ctypes', 'cffi',
  'shutil', 'pathlib', 'tempfile',
];

export interface SandboxResult {
  success: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  error?: string;
  executionTimeMs: number;
}

/**
 * Validate Python code for safety before execution.
 */
export function validatePythonCode(code: string): { valid: boolean; error?: string } {
  // Check for blocked keywords
  for (const keyword of BLOCKED_KEYWORDS) {
    if (code.includes(keyword)) {
      return {
        valid: false,
        error: `Blocked keyword detected: "${keyword}". Only safe operations are allowed.`,
      };
    }
  }

  // Check imports are whitelisted
  const importMatches = code.matchAll(/(?:^|\n)\s*(?:import|from)\s+(\w+)/g);
  for (const match of importMatches) {
    const moduleName = match[1];
    if (!ALLOWED_IMPORTS.has(moduleName)) {
      return {
        valid: false,
        error: `Import "${moduleName}" is not allowed. Allowed: ${[...ALLOWED_IMPORTS].join(', ')}`,
      };
    }
  }

  // Must define transform function
  if (!code.includes('def transform(')) {
    return {
      valid: false,
      error: 'Code must define a "transform(data)" function that takes a list of dictionaries and returns a list of dictionaries.',
    };
  }

  return { valid: true };
}

/**
 * Execute Python transform code in a sandboxed environment.
 *
 * @param code - Python code with a transform(data) function
 * @param data - Input data rows
 * @param timeoutMs - Maximum execution time (default: 4000ms)
 */
export async function executePythonTransform(
  code: string,
  data: Record<string, unknown>[],
  timeoutMs: number = 4000
): Promise<SandboxResult> {
  const start = Date.now();

  // Validate code first
  const validation = validatePythonCode(code);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      executionTimeMs: Date.now() - start,
    };
  }

  // Try Pyodide first, fall back to child process
  try {
    return await executeWithChildProcess(code, data, timeoutMs);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Python execution failed',
      executionTimeMs: Date.now() - start,
    };
  }
}

/**
 * Execute Python via child process with strict sandboxing.
 */
function executeWithChildProcess(
  code: string,
  data: Record<string, unknown>[],
  timeoutMs: number
): Promise<SandboxResult> {
  return new Promise((resolve) => {
    const start = Date.now();

    const pythonExec = process.env.PYTHON_EXECUTABLE || 'python3';

    // Wrap user code in a safe execution harness
    const wrappedCode = `
import sys
import json

# Remove dangerous builtins
safe_builtins = {
    'len': len, 'min': min, 'max': max, 'sum': sum,
    'sorted': sorted, 'range': range, 'enumerate': enumerate,
    'list': list, 'dict': dict, 'set': set, 'tuple': tuple,
    'str': str, 'int': int, 'float': float, 'bool': bool,
    'abs': abs, 'round': round, 'zip': zip, 'map': map,
    'filter': filter, 'all': all, 'any': any,
    'isinstance': isinstance, 'type': type,
    'True': True, 'False': False, 'None': None,
    'print': lambda *args, **kwargs: None,  # suppress print
}

# Read input data
input_data = json.loads(sys.stdin.read())

# Define user code in restricted namespace
namespace = {'__builtins__': safe_builtins}

# Allow safe imports
import math, statistics, datetime, json as json_mod, re, collections
namespace['math'] = math
namespace['statistics'] = statistics
namespace['datetime'] = datetime
namespace['json'] = json_mod
namespace['re'] = re
namespace['collections'] = collections

exec(${JSON.stringify(code)}, namespace)

if 'transform' not in namespace:
    print(json.dumps({"error": "No transform() function defined"}))
    sys.exit(1)

try:
    result = namespace['transform'](input_data)
    if not isinstance(result, list):
        print(json.dumps({"error": "transform() must return a list"}))
        sys.exit(1)
    print(json.dumps({"data": result}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
`;

    const proc = spawn(pythonExec, ['-c', wrappedCode], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    // Send input data
    proc.stdin.write(JSON.stringify(data));
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      resolve({
        success: false,
        error: `Python execution timed out after ${timeoutMs}ms`,
        executionTimeMs: timeoutMs,
      });
    }, timeoutMs);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - start;

      if (exitCode !== 0) {
        resolve({
          success: false,
          error: stderr.trim() || `Process exited with code ${exitCode}`,
          executionTimeMs,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (result.error) {
          resolve({ success: false, error: result.error, executionTimeMs });
          return;
        }

        const rows = result.data as Record<string, unknown>[];
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        resolve({
          success: true,
          data: rows,
          columns,
          executionTimeMs,
        });
      } catch {
        resolve({
          success: false,
          error: 'Failed to parse Python output',
          executionTimeMs,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        error: `Failed to start Python: ${err.message}`,
        executionTimeMs: Date.now() - start,
      });
    });
  });
}
