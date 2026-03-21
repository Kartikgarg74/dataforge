/**
 * Transform Pipeline Executor
 *
 * Executes a series of transform steps on a working database table.
 * Each step creates an intermediate table for undo/preview capability.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { TransformStep, TransformPipeline, TransformPreview, TransformType } from './types';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

function getDb(readonly = false): Database.Database {
  return new Database(WORKING_DB_PATH, readonly ? { readonly: true } : undefined);
}

function getRowCount(db: Database.Database, table: string): number {
  const result = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get() as { count: number };
  return result?.count || 0;
}

function getColumnCount(db: Database.Database, table: string): number {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all();
  return cols.length;
}

function getColumns(db: Database.Database, table: string): string[] {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return cols.map((c) => c.name);
}

/**
 * Generate SQL for a transform step.
 */
function generateStepSQL(
  step: Omit<TransformStep, 'inputRowCount' | 'outputRowCount' | 'inputColumnCount' | 'outputColumnCount' | 'executionTimeMs' | 'createdAt'>,
  sourceTable: string,
  db: Database.Database
): string {
  const tbl = `"${sourceTable}"`;
  const p = step.params;

  switch (step.type) {
    case 'filter':
      // params: { condition: string } e.g., "age > 18"
      return `SELECT * FROM ${tbl} WHERE ${p.condition}`;

    case 'dedup': {
      // params: { columns?: string[] } — dedup on all or specific columns
      const cols = (p.columns as string[])?.map((c) => `"${c}"`).join(', ') || '*';
      if (cols === '*') {
        const allCols = getColumns(db, sourceTable).map((c) => `"${c}"`).join(', ');
        return `SELECT DISTINCT ${allCols} FROM ${tbl}`;
      }
      return `SELECT * FROM ${tbl} GROUP BY ${cols}`;
    }

    case 'sample':
      // params: { size: number, seed?: number }
      return `SELECT * FROM ${tbl} ORDER BY RANDOM() LIMIT ${p.size}`;

    case 'sort':
      // params: { column: string, direction: 'asc' | 'desc' }
      return `SELECT * FROM ${tbl} ORDER BY "${p.column}" ${p.direction === 'desc' ? 'DESC' : 'ASC'}`;

    case 'limit':
      // params: { count: number }
      return `SELECT * FROM ${tbl} LIMIT ${p.count}`;

    case 'fill_nulls': {
      // params: { column: string, strategy: 'value' | 'mean' | 'median' | 'mode', value?: unknown }
      const col = `"${p.column}"`;
      let fillValue: string;

      if (p.strategy === 'value') {
        fillValue = typeof p.value === 'string' ? `'${p.value}'` : String(p.value);
      } else if (p.strategy === 'mean') {
        fillValue = `(SELECT AVG(CAST(${col} AS REAL)) FROM ${tbl} WHERE ${col} IS NOT NULL)`;
      } else if (p.strategy === 'median') {
        fillValue = `(SELECT ${col} FROM ${tbl} WHERE ${col} IS NOT NULL ORDER BY CAST(${col} AS REAL) LIMIT 1 OFFSET (SELECT COUNT(${col}) FROM ${tbl} WHERE ${col} IS NOT NULL) / 2)`;
      } else if (p.strategy === 'mode') {
        fillValue = `(SELECT ${col} FROM ${tbl} WHERE ${col} IS NOT NULL GROUP BY ${col} ORDER BY COUNT(*) DESC LIMIT 1)`;
      } else {
        fillValue = "''";
      }

      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => {
          if (c === p.column) {
            return `COALESCE(${col}, ${fillValue}) AS "${c}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'drop_nulls':
      // params: { columns?: string[] } — drop rows where ANY of these columns is null
      if (p.columns && (p.columns as string[]).length > 0) {
        const conditions = (p.columns as string[]).map((c) => `"${c}" IS NOT NULL`).join(' AND ');
        return `SELECT * FROM ${tbl} WHERE ${conditions}`;
      }
      // Drop rows where ANY column is null
      const allColsForNull = getColumns(db, sourceTable);
      const allConditions = allColsForNull.map((c) => `"${c}" IS NOT NULL`).join(' AND ');
      return `SELECT * FROM ${tbl} WHERE ${allConditions}`;

    case 'drop_columns': {
      // params: { columns: string[] }
      const dropCols = new Set(p.columns as string[]);
      const keepCols = getColumns(db, sourceTable)
        .filter((c) => !dropCols.has(c))
        .map((c) => `"${c}"`)
        .join(', ');
      return `SELECT ${keepCols} FROM ${tbl}`;
    }

    case 'rename': {
      // params: { renames: Record<string, string> }
      const renames = p.renames as Record<string, string>;
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => {
          if (renames[c]) {
            return `"${c}" AS "${renames[c]}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'cast_type': {
      // params: { column: string, targetType: string }
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => {
          if (c === p.column) {
            return `CAST("${c}" AS ${p.targetType}) AS "${c}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'computed_column':
      // params: { name: string, expression: string }
      return `SELECT *, (${p.expression}) AS "${p.name}" FROM ${tbl}`;

    case 'lowercase': {
      // params: { column: string }
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => (c === p.column ? `LOWER("${c}") AS "${c}"` : `"${c}"`))
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'uppercase': {
      // params: { column: string }
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => (c === p.column ? `UPPER("${c}") AS "${c}"` : `"${c}"`))
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'trim': {
      // params: { column: string }
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => (c === p.column ? `TRIM("${c}") AS "${c}"` : `"${c}"`))
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'round': {
      // params: { column: string, decimals: number }
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) =>
          c === p.column
            ? `ROUND(CAST("${c}" AS REAL), ${p.decimals || 0}) AS "${c}"`
            : `"${c}"`
        )
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'clip_outliers': {
      // params: { column: string, lower?: number, upper?: number }
      const allCols = getColumns(db, sourceTable);
      const selectCols = allCols
        .map((c) => {
          if (c === p.column) {
            let expr = `CAST("${c}" AS REAL)`;
            if (p.lower !== undefined) expr = `MAX(${p.lower}, ${expr})`;
            if (p.upper !== undefined) expr = `MIN(${p.upper}, ${expr})`;
            return `${expr} AS "${c}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'normalize': {
      // params: { column: string, method: 'min_max' | 'z_score' }
      const allCols = getColumns(db, sourceTable);
      const col = `"${p.column}"`;
      const selectCols = allCols
        .map((c) => {
          if (c === p.column) {
            if (p.method === 'z_score') {
              // z-score: (value - mean) / stddev. Returns 0.0 when stddev is 0 (all values identical)
              return `COALESCE((CAST(${col} AS REAL) - (SELECT AVG(CAST(${col} AS REAL)) FROM ${tbl})) / NULLIF((SELECT SQRT(AVG(CAST(${col} AS REAL) * CAST(${col} AS REAL)) - AVG(CAST(${col} AS REAL)) * AVG(CAST(${col} AS REAL))) FROM ${tbl}), 0), 0.0) AS "${c}"`;
            }
            // min_max: (value - min) / (max - min). Returns 0.0 when max == min (all values identical)
            return `COALESCE((CAST(${col} AS REAL) - (SELECT MIN(CAST(${col} AS REAL)) FROM ${tbl})) / NULLIF((SELECT MAX(CAST(${col} AS REAL)) - MIN(CAST(${col} AS REAL)) FROM ${tbl}), 0), 0.0) AS "${c}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'bin': {
      // params: { column: string, bins: number }
      const allCols = getColumns(db, sourceTable);
      const col = `"${p.column}"`;
      const bins = Number(p.bins);
      const existingCols = allCols.map((c) => `"${c}"`).join(', ');
      const binExpr = `CASE WHEN ${col} IS NULL THEN NULL WHEN CAST(${col} AS REAL) = (SELECT MAX(CAST(${col} AS REAL)) FROM ${tbl}) THEN ${bins - 1} ELSE CAST((CAST(${col} AS REAL) - (SELECT MIN(CAST(${col} AS REAL)) FROM ${tbl})) / NULLIF(((SELECT MAX(CAST(${col} AS REAL)) - MIN(CAST(${col} AS REAL)) FROM ${tbl}) / ${bins}), 0) AS INTEGER) END`;
      return `SELECT ${existingCols}, ${binExpr} AS "${p.column}_bin" FROM ${tbl}`;
    }

    case 'one_hot_encode': {
      // params: { column: string }
      const allCols = getColumns(db, sourceTable);
      const col = `"${p.column}"`;
      const existingCols = allCols.map((c) => `"${c}"`).join(', ');
      // Get distinct values from the column
      const distinctRows = db.prepare(`SELECT DISTINCT ${col} AS val FROM "${sourceTable}" WHERE ${col} IS NOT NULL ORDER BY ${col}`).all() as Array<{ val: string | number }>;
      const oneHotCols = distinctRows
        .map((row) => {
          const val = row.val;
          const safeVal = String(val).replace(/"/g, '""');
          const colName = `${p.column}_${String(val)}`;
          if (typeof val === 'string') {
            return `CASE WHEN ${col} = '${val.replace(/'/g, "''")}' THEN 1 ELSE 0 END AS "${colName}"`;
          }
          return `CASE WHEN ${col} = ${val} THEN 1 ELSE 0 END AS "${colName}"`;
        })
        .join(', ');
      if (!oneHotCols) {
        return `SELECT ${existingCols} FROM ${tbl}`;
      }
      return `SELECT ${existingCols}, ${oneHotCols} FROM ${tbl}`;
    }

    case 'label_encode': {
      // params: { column: string }
      const allCols = getColumns(db, sourceTable);
      const col = `"${p.column}"`;
      const selectCols = allCols
        .map((c) => {
          if (c === p.column) {
            return `(DENSE_RANK() OVER (ORDER BY ${col})) - 1 AS "${c}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'regex_replace': {
      // params: { column: string, pattern: string, replacement: string }
      const allCols = getColumns(db, sourceTable);
      const col = `"${p.column}"`;
      const replacement = String(p.replacement).replace(/'/g, "''");
      const pattern = String(p.pattern).replace(/'/g, "''");
      const selectCols = allCols
        .map((c) => {
          if (c === p.column) {
            return `REPLACE(${col}, '${pattern}', '${replacement}') AS "${c}"`;
          }
          return `"${c}"`;
        })
        .join(', ');
      return `SELECT ${selectCols} FROM ${tbl}`;
    }

    case 'extract': {
      // params: { column: string, part: 'year'|'month'|'day'|'hour', newColumn?: string }
      const allCols = getColumns(db, sourceTable);
      const col = `"${p.column}"`;
      const existingCols = allCols.map((c) => `"${c}"`).join(', ');
      const formatMap: Record<string, string> = {
        year: '%Y',
        month: '%m',
        day: '%d',
        hour: '%H',
      };
      const fmt = formatMap[p.part as string] || '%Y';
      const newCol = (p.newColumn as string) || `${p.column}_${p.part}`;
      return `SELECT ${existingCols}, strftime('${fmt}', ${col}) AS "${newCol}" FROM ${tbl}`;
    }

    case 'reorder': {
      // params: { columns: string[] }
      const orderedCols = (p.columns as string[]).map((c) => `"${c}"`).join(', ');
      return `SELECT ${orderedCols} FROM ${tbl}`;
    }

    case 'join': {
      // params: { rightTable: string, leftColumn: string, rightColumn: string, joinType: 'inner'|'left'|'right'|'outer' }
      const rightTableName = p.rightTable as string;
      if (!rightTableName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rightTableName)) {
        throw new Error(`Invalid right table name for join: "${rightTableName}"`);
      }
      const joinType = (p.joinType as string || 'inner').toUpperCase();
      if (!['INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS'].includes(joinType)) {
        throw new Error(`Invalid join type: "${joinType}"`);
      }
      const rightTbl = `"${rightTableName}"`;
      const leftColName = p.leftColumn as string;
      const rightColName = p.rightColumn as string;
      // Verify right table exists
      const rightTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(rightTableName);
      if (!rightTableExists) {
        throw new Error(`Right table "${rightTableName}" does not exist`);
      }
      const allLeftCols = getColumns(db, sourceTable).map(c => `${tbl}."${c}"`).join(', ');
      const rightCols = getColumns(db, rightTableName)
        .filter(c => c !== rightColName)
        .map(c => `${rightTbl}."${c}"`).join(', ');
      const selectCols = rightCols ? `${allLeftCols}, ${rightCols}` : allLeftCols;
      return `SELECT ${selectCols} FROM ${tbl} ${joinType} JOIN ${rightTbl} ON ${tbl}."${leftColName}" = ${rightTbl}."${rightColName}"`;
    }

    case 'group_aggregate': {
      // params: { groupBy: string[], aggregations: Array<{column: string, function: 'count'|'sum'|'avg'|'min'|'max'}> }
      const groupByArr = p.groupBy as string[];
      const aggsArr = p.aggregations as Array<{column: string, function: string}>;
      if (!groupByArr || groupByArr.length === 0) {
        throw new Error('group_aggregate requires at least one groupBy column');
      }
      if (!aggsArr || aggsArr.length === 0) {
        // If no aggregations specified, just do a GROUP BY with COUNT(*)
        const groupCols = groupByArr.map(c => `"${c}"`).join(', ');
        return `SELECT ${groupCols}, COUNT(*) AS row_count FROM ${tbl} GROUP BY ${groupCols}`;
      }
      const groupCols = groupByArr.map(c => `"${c}"`).join(', ');
      const aggExprs = aggsArr
        .map(a => `${a.function.toUpperCase()}("${a.column}") AS "${a.column}_${a.function}"`)
        .join(', ');
      return `SELECT ${groupCols}, ${aggExprs} FROM ${tbl} GROUP BY ${groupCols}`;
    }

    case 'pivot': {
      // params: { indexColumn: string, pivotColumn: string, valueColumn: string, aggFunction?: string }
      const idx = `"${p.indexColumn}"`;
      const pivotCol = `"${p.pivotColumn}"`;
      const valCol = `"${p.valueColumn}"`;
      const aggFn = (p.aggFunction as string) || 'SUM';
      const pivotVals = db.prepare(`SELECT DISTINCT ${pivotCol} AS val FROM "${sourceTable}" WHERE ${pivotCol} IS NOT NULL ORDER BY ${pivotCol}`).all() as Array<{val: string|number}>;
      const pivotCols = pivotVals.map(v => {
        const safe = String(v.val).replace(/'/g, "''");
        return `${aggFn}(CASE WHEN ${pivotCol} = '${safe}' THEN CAST(${valCol} AS REAL) END) AS "${p.pivotColumn}_${v.val}"`;
      }).join(', ');
      return `SELECT ${idx}, ${pivotCols} FROM ${tbl} GROUP BY ${idx}`;
    }

    case 'unpivot': {
      // params: { idColumns: string[], valueColumns: string[], nameColumn?: string, valueColumn?: string }
      const idCols = (p.idColumns as string[]).map(c => `"${c}"`).join(', ');
      const valueCols = p.valueColumns as string[];
      const nameCol = (p.nameColumn as string) || 'variable';
      const valCol = (p.valueColumn as string) || 'value';
      const unions = valueCols.map(vc =>
        `SELECT ${idCols}, '${vc}' AS "${nameCol}", CAST("${vc}" AS TEXT) AS "${valCol}" FROM ${tbl}`
      ).join(' UNION ALL ');
      return unions;
    }

    case 'custom_python': {
      // Python transforms should use the /api/python endpoint
      throw new Error('Python transforms should use the /api/python endpoint. Use custom_sql for SQL-based transforms.');
    }

    case 'custom_sql':
      // params: { sql: string }
      return p.sql as string;

    default:
      throw new Error(`Unsupported transform type: ${step.type}`);
  }
}

/**
 * Execute a single transform step, creating a new table.
 */
function executeStep(
  db: Database.Database,
  step: Omit<TransformStep, 'inputRowCount' | 'outputRowCount' | 'inputColumnCount' | 'outputColumnCount' | 'executionTimeMs' | 'createdAt'>,
  sourceTable: string,
  targetTable: string
): TransformStep {
  const start = Date.now();
  const inputRowCount = getRowCount(db, sourceTable);
  const inputColumnCount = getColumnCount(db, sourceTable);

  const sql = generateStepSQL(step, sourceTable, db);

  db.exec(`DROP TABLE IF EXISTS "${targetTable}"`);
  db.exec(`CREATE TABLE "${targetTable}" AS ${sql}`);

  const outputRowCount = getRowCount(db, targetTable);
  const outputColumnCount = getColumnCount(db, targetTable);
  const executionTimeMs = Date.now() - start;

  return {
    ...step,
    sql,
    inputRowCount,
    outputRowCount,
    inputColumnCount,
    outputColumnCount,
    executionTimeMs,
    createdAt: new Date().toISOString(),
  } as TransformStep;
}

/**
 * Execute a full transform pipeline.
 */
export function executePipeline(
  sourceTable: string,
  steps: Array<{
    id: string;
    type: TransformType;
    params: Record<string, unknown>;
    description: string;
    createdBy?: 'user' | 'ai';
  }>,
  options?: {
    pipelineId?: string;
    pipelineName?: string;
  }
): TransformPipeline {
  const db = getDb();
  const pipelineId = options?.pipelineId || crypto.randomUUID();
  const executedSteps: TransformStep[] = [];

  try {
    let currentTable = sourceTable;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const targetTable = `_transform_${pipelineId}_step${i}`;

      const result = executeStep(db, {
        ...step,
        createdBy: step.createdBy || 'user',
      } as Omit<TransformStep, 'inputRowCount' | 'outputRowCount' | 'inputColumnCount' | 'outputColumnCount' | 'executionTimeMs' | 'createdAt'>, currentTable, targetTable);

      executedSteps.push(result);
      currentTable = targetTable;
    }

    // Create final result table
    const resultTable = `${sourceTable}_transformed`;
    db.exec(`DROP TABLE IF EXISTS "${resultTable}"`);
    db.exec(`CREATE TABLE "${resultTable}" AS SELECT * FROM "${currentTable}"`);

    // Clean up intermediate tables
    for (let i = 0; i < steps.length; i++) {
      const intermediateTable = `_transform_${pipelineId}_step${i}`;
      db.exec(`DROP TABLE IF EXISTS "${intermediateTable}"`);
    }

    return {
      id: pipelineId,
      name: options?.pipelineName || `Pipeline for ${sourceTable}`,
      sourceTable,
      steps: executedSteps,
      resultTable,
      status: 'executed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Clean up on failure
    for (let i = 0; i < steps.length; i++) {
      const intermediateTable = `_transform_${pipelineId}_step${i}`;
      try {
        db.exec(`DROP TABLE IF EXISTS "${intermediateTable}"`);
      } catch { /* ignore */ }
    }

    return {
      id: pipelineId,
      name: options?.pipelineName || `Pipeline for ${sourceTable}`,
      sourceTable,
      steps: executedSteps,
      resultTable: '',
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } finally {
    db.close();
  }
}

/**
 * Save a pipeline as a reusable template.
 */
export function savePipelineTemplate(pipeline: TransformPipeline): void {
  const db = getDb();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _pipeline_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.prepare(
      'INSERT INTO _pipeline_templates (id, name, steps_json, created_at) VALUES (?, ?, ?, ?)'
    ).run(
      pipeline.id,
      pipeline.name,
      JSON.stringify(pipeline.steps),
      new Date().toISOString()
    );
  } finally {
    db.close();
  }
}

/**
 * List all saved pipeline templates.
 */
export function listPipelineTemplates(): Array<{ id: string; name: string; steps: TransformStep[]; createdAt: string }> {
  const db = getDb(true);
  try {
    // Ensure the table exists before querying
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = '_pipeline_templates'")
      .get();
    if (!tableExists) return [];

    const rows = db.prepare('SELECT * FROM _pipeline_templates ORDER BY created_at DESC').all() as Array<{
      id: string;
      name: string;
      steps_json: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      steps: JSON.parse(row.steps_json) as TransformStep[],
      createdAt: row.created_at,
    }));
  } finally {
    db.close();
  }
}

/**
 * Apply a saved template to a source table, executing its steps.
 */
export function applyTemplate(templateId: string, sourceTable: string): TransformPipeline {
  const db = getDb(true);
  let steps: TransformStep[];

  try {
    const row = db.prepare('SELECT * FROM _pipeline_templates WHERE id = ?').get(templateId) as {
      id: string;
      name: string;
      steps_json: string;
    } | undefined;

    if (!row) {
      throw new Error(`Pipeline template '${templateId}' not found`);
    }

    steps = JSON.parse(row.steps_json) as TransformStep[];
  } finally {
    db.close();
  }

  return executePipeline(
    sourceTable,
    steps.map((s) => ({
      id: crypto.randomUUID(),
      type: s.type,
      params: s.params,
      description: s.description,
      createdBy: s.createdBy,
    })),
    {
      pipelineName: `Template applied to ${sourceTable}`,
    }
  );
}

/**
 * Preview a transform step without persisting.
 */
export function previewStep(
  sourceTable: string,
  step: {
    type: TransformType;
    params: Record<string, unknown>;
    description: string;
  },
  previewRows: number = 100
): TransformPreview {
  const db = getDb(true);

  try {
    const sql = generateStepSQL(
      { ...step, id: 'preview', createdBy: 'user' },
      sourceTable,
      db
    );

    const rows = db.prepare(`${sql} LIMIT ${previewRows}`).all() as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // Get counts from a CTE to avoid re-executing the full query
    const rowCountBefore = getRowCount(db, sourceTable);
    const columnCountBefore = getColumnCount(db, sourceTable);

    // For row count after, we need to execute the full query
    let rowCountAfter = rows.length;
    try {
      const countResult = db.prepare(`SELECT COUNT(*) AS count FROM (${sql})`).get() as { count: number };
      rowCountAfter = countResult?.count || rows.length;
    } catch {
      // Fall back to preview row count
    }

    return {
      rows,
      columns,
      rowCountBefore,
      rowCountAfter,
      columnCountBefore,
      columnCountAfter: columns.length,
    };
  } finally {
    db.close();
  }
}
