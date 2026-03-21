import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { beginRequest, completeRequest, failRequest } from '@/lib/observability/request-monitor';
import { enforceApiProtection } from '@/lib/security/api-guard';
import { z } from 'zod';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

type Row = Record<string, JsonValue>;

interface PythonResult {
  data: Row[];
  newColumns: string[];
}

const requestSchema = z.object({
  code: z.string().min(1).max(12000),
  data: z.array(z.record(z.string(), z.unknown())).max(10000).default([]),
});

const PYTHON_TIMEOUT_MS = 4000;
const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python3';

const PYTHON_RUNNER = String.raw`
import json
import math
import statistics
import datetime
import traceback
import sys

SAFE_BUILTINS = {
    "len": len,
    "min": min,
    "max": max,
    "sum": sum,
    "sorted": sorted,
    "range": range,
    "enumerate": enumerate,
    "list": list,
    "dict": dict,
    "set": set,
    "tuple": tuple,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "abs": abs,
    "round": round,
    "zip": zip,
    "all": all,
    "any": any,
}

def emit(payload):
    print(json.dumps(payload, separators=(",", ":")))

try:
    payload = json.load(sys.stdin)
    code = payload.get("code", "")
    rows = payload.get("data", [])

    if not isinstance(code, str) or not isinstance(rows, list):
        emit({"success": False, "error": "Invalid payload"})
        sys.exit(0)

    env = {
        "__builtins__": SAFE_BUILTINS,
        "math": math,
        "statistics": statistics,
        "datetime": datetime,
    }

    local_env = {}
    exec(code, env, local_env)
    transform = local_env.get("transform") or env.get("transform")

    if not callable(transform):
        emit({"success": False, "error": "Python code must define transform(data)"})
        sys.exit(0)

    result = transform(rows)
    if not isinstance(result, list):
        emit({"success": False, "error": "transform(data) must return a list of objects"})
        sys.exit(0)

    cleaned = []
    for item in result:
        if not isinstance(item, dict):
            emit({"success": False, "error": "All returned rows must be objects"})
            sys.exit(0)
        cleaned.append(item)

    input_keys = set()
    for row in rows:
        if isinstance(row, dict):
            input_keys.update(row.keys())

    output_keys = set()
    for row in cleaned:
        output_keys.update(row.keys())

    new_columns = sorted(output_keys - input_keys)
    emit({"success": True, "result": cleaned, "newColumns": new_columns})
except Exception as exc:
    emit({"success": False, "error": f"{type(exc).__name__}: {exc}"})
`;

function canExecutePython(): boolean {
  // Allow local development by default; require explicit opt-in in production.
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  return process.env.ENABLE_PYTHON_EXECUTION === 'true';
}

function executePython(code: string, data: Row[]): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_EXECUTABLE, ['-c', PYTHON_RUNNER], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Python execution timed out after ${PYTHON_TIMEOUT_MS}ms`));
    }, PYTHON_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    child.on('close', (codeExit) => {
      clearTimeout(timeout);

      if (!stdout.trim()) {
        const details = stderr.trim() || `Process exited with code ${String(codeExit)}`;
        reject(new Error(`Python execution failed: ${details}`));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch {
        reject(new Error('Invalid JSON returned by Python process'));
        return;
      }

      const pythonResponse = parsed as {
        success?: boolean;
        result?: Row[];
        newColumns?: string[];
        error?: string;
      };

      if (!pythonResponse.success) {
        reject(new Error(pythonResponse.error || 'Python execution failed'));
        return;
      }

      resolve({
        data: Array.isArray(pythonResponse.result) ? pythonResponse.result : [],
        newColumns: Array.isArray(pythonResponse.newColumns)
          ? pythonResponse.newColumns
          : [],
      });
    });

    child.stdin.write(JSON.stringify({ code, data }));
    child.stdin.end();
  });
}

export async function POST(request: Request) {
  const monitor = beginRequest('python', request);

  const blocked = enforceApiProtection(request, {
    route: 'python',
    rateLimit: { windowMs: 60_000, max: 20 },
    requireApiKey: process.env.PYTHON_API_KEY_REQUIRED === 'true',
  });
  if (blocked) {
    completeRequest(monitor, blocked.status, { blocked: true });
    return blocked;
  }

  try {
    if (!canExecutePython()) {
      completeRequest(monitor, 503, { reason: 'disabled' });
      return NextResponse.json({
        success: false,
        error: 'Python execution is disabled in production. Set ENABLE_PYTHON_EXECUTION=true to enable it.',
      }, { status: 503 });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      completeRequest(monitor, 400, { reason: 'invalid_payload' });
      return NextResponse.json({
        success: false,
        error: 'Invalid python execution payload',
      }, { status: 400 });
    }

    const { code, data } = parsed.data;

    const result = await executePython(code, data as Row[]);
    completeRequest(monitor, 200, { rowsProcessed: data?.length || 0, rowsReturned: result.data.length });

    return NextResponse.json({
      success: true,
      result: result.data,
      newColumns: result.newColumns,
      rowsProcessed: data?.length || 0,
      rowsReturned: result.data.length
    });

  } catch (error: unknown) {
    console.error('Python execution error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    failRequest(monitor, error, 500);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
