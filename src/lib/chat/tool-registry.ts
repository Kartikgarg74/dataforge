import { z } from "zod";
import { executeQuery, getDatabaseSchema } from "@/db/connection";
import { profileDataset } from "@/lib/profiling";
import { profileColumn } from "@/lib/profiling/column-stats";
import { executePipeline, previewStep } from "@/lib/transforms";
import { splitDataset } from "@/lib/splitting";
import { exportData } from "@/lib/export";
import { listDatasets } from "@/lib/ingestion/ingest-sqlite";
import { getConnectionManager } from "@/lib/connectors";
import Database from "better-sqlite3";

export const sqlParamSchema = z.union([z.string(), z.number(), z.null()]);

const getDatabaseSchemaInputSchema = z.object({});
const executeSqlInputSchema = z.object({
  query: z.string().min(1).max(10000),
  params: z.array(sqlParamSchema).optional().default([]),
});
const showNeonDemoInputSchema = z.object({});

const uploadFileInputSchema = z.object({});
const profileDatasetInputSchema = z.object({
  table: z.string().min(1),
});
const profileColumnInputSchema = z.object({
  table: z.string().min(1),
  column: z.string().min(1),
});
const suggestTransformsInputSchema = z.object({
  table: z.string().min(1),
});
const applyTransformInputSchema = z.object({
  table: z.string().min(1),
  type: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  description: z.string().min(1),
});
const previewTransformInputSchema = z.object({
  table: z.string().min(1),
  type: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  description: z.string().min(1),
});
const splitDatasetInputSchema = z.object({
  table: z.string().min(1),
  strategy: z.string().min(1),
  ratios: z.object({
    train: z.number(),
    val: z.number(),
    test: z.number(),
  }),
});
const exportDatasetInputSchema = z.object({
  table: z.string().min(1),
  format: z.string().min(1),
});
const detectDuplicatesInputSchema = z.object({
  table: z.string().min(1),
});
const listDatasetsInputSchema = z.object({});
const connectDatabaseInputSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.unknown()).default({}),
});

export const toolSchemas = {
  getDatabaseSchema: {
    input: getDatabaseSchemaInputSchema,
  },
  executeSQL: {
    input: executeSqlInputSchema,
  },
  showNeonDemo: {
    input: showNeonDemoInputSchema,
  },
  uploadFile: {
    input: uploadFileInputSchema,
  },
  profileDataset: {
    input: profileDatasetInputSchema,
  },
  profileColumn: {
    input: profileColumnInputSchema,
  },
  suggestTransforms: {
    input: suggestTransformsInputSchema,
  },
  applyTransform: {
    input: applyTransformInputSchema,
  },
  previewTransform: {
    input: previewTransformInputSchema,
  },
  splitDataset: {
    input: splitDatasetInputSchema,
  },
  exportDataset: {
    input: exportDatasetInputSchema,
  },
  detectDuplicates: {
    input: detectDuplicatesInputSchema,
  },
  listDatasets: {
    input: listDatasetsInputSchema,
  },
  connectDatabase: {
    input: connectDatabaseInputSchema,
  },
};

export type ChatToolName = keyof typeof toolSchemas;

const WORKING_DB_PATH = process.env.WORKING_DB_PATH || "data/working.db";

export async function runTool(name: ChatToolName, input: Record<string, unknown>) {
  if (name === "getDatabaseSchema") {
    const parsed = getDatabaseSchemaInputSchema.parse(input);
    void parsed;
    const schema = await getDatabaseSchema();
    return { schema };
  }

  if (name === "executeSQL") {
    const parsed = executeSqlInputSchema.parse(input);
    const { results, columns } = await executeQuery(parsed.query, parsed.params);
    return { results, columns, rowCount: results.length };
  }

  if (name === "showNeonDemo") {
    const parsed = showNeonDemoInputSchema.parse(input);
    void parsed;
    return {
      demoMode: true,
      databaseName: "demo-production-db",
      tables: [
        { name: "users", rowCount: 4 },
        { name: "orders", rowCount: 5 },
        { name: "products", rowCount: 4 },
      ],
    };
  }

  if (name === "uploadFile") {
    uploadFileInputSchema.parse(input);
    return {
      message: "File upload must be initiated from the upload UI. Use the /upload page or drag-and-drop a file into the chat.",
    };
  }

  if (name === "profileDataset") {
    const parsed = profileDatasetInputSchema.parse(input);
    const profile = profileDataset(parsed.table);
    return { profile };
  }

  if (name === "profileColumn") {
    const parsed = profileColumnInputSchema.parse(input);
    const db = new Database(WORKING_DB_PATH, { readonly: true });
    try {
      const tableInfo = db.prepare(`PRAGMA table_info("${parsed.table}")`).all() as Array<{ name: string; type: string }>;
      const colInfo = tableInfo.find((c) => c.name === parsed.column);
      if (!colInfo) {
        throw new Error(`Column '${parsed.column}' not found in table '${parsed.table}'`);
      }
      const rowCount = (db.prepare(`SELECT COUNT(*) as cnt FROM "${parsed.table}"`).get() as { cnt: number }).cnt;
      const profile = profileColumn(db, parsed.table, parsed.column, colInfo.type, rowCount);
      return { profile };
    } finally {
      db.close();
    }
  }

  if (name === "suggestTransforms") {
    const parsed = suggestTransformsInputSchema.parse(input);
    const profile = profileDataset(parsed.table);
    const suggestions: Array<{ type: string; description: string; reason: string }> = [];

    for (const alert of profile.alerts) {
      if (alert.severity === "warning" || alert.severity === "error") {
        if (alert.message?.includes("null")) {
          suggestions.push({
            type: "fill_nulls",
            description: `Fill null values in column '${alert.column}'`,
            reason: alert.message,
          });
          suggestions.push({
            type: "drop_nulls",
            description: `Drop rows with null values in column '${alert.column}'`,
            reason: alert.message,
          });
        }
        if (alert.message?.includes("cardinality")) {
          suggestions.push({
            type: "bin",
            description: `Bin high-cardinality column '${alert.column}' into groups`,
            reason: alert.message,
          });
        }
        if (alert.message?.includes("duplicate")) {
          suggestions.push({
            type: "dedup",
            description: `Remove duplicate rows`,
            reason: alert.message,
          });
        }
        if (alert.message?.includes("outlier")) {
          suggestions.push({
            type: "clip_outliers",
            description: `Clip outliers in column '${alert.column}'`,
            reason: alert.message,
          });
        }
      }
    }

    return { table: parsed.table, suggestions, alertCount: profile.alerts.length };
  }

  if (name === "applyTransform") {
    const parsed = applyTransformInputSchema.parse(input);
    const result = executePipeline(parsed.table, [
      {
        id: crypto.randomUUID(),
        type: parsed.type as import("@/lib/transforms").TransformType,
        params: parsed.params,
        description: parsed.description,
        createdBy: "ai",
      },
    ]);
    return { pipeline: result };
  }

  if (name === "previewTransform") {
    const parsed = previewTransformInputSchema.parse(input);
    const preview = previewStep(parsed.table, {
      type: parsed.type as import("@/lib/transforms").TransformType,
      params: parsed.params,
      description: parsed.description,
    });
    return { preview };
  }

  if (name === "splitDataset") {
    const parsed = splitDatasetInputSchema.parse(input);
    const result = splitDataset(parsed.table, {
      strategy: parsed.strategy as import("@/lib/splitting").SplitStrategy,
      ratios: parsed.ratios,
    });
    return { result };
  }

  if (name === "exportDataset") {
    const parsed = exportDatasetInputSchema.parse(input);
    const result = await exportData({
      table: parsed.table,
      format: parsed.format as import("@/lib/export").ExportFormat,
    });
    return {
      filename: result.filename,
      contentType: result.contentType,
      rowCount: result.rowCount,
      fileSizeBytes: result.fileSizeBytes,
    };
  }

  if (name === "detectDuplicates") {
    const parsed = detectDuplicatesInputSchema.parse(input);
    const db = new Database(WORKING_DB_PATH, { readonly: true });
    try {
      const columns = (db.prepare(`PRAGMA table_info("${parsed.table}")`).all() as Array<{ name: string }>)
        .map((c) => `"${c.name}"`)
        .join(", ");
      const result = db
        .prepare(
          `SELECT ${columns}, COUNT(*) as _dup_count FROM "${parsed.table}" GROUP BY ${columns} HAVING COUNT(*) > 1 ORDER BY _dup_count DESC LIMIT 100`
        )
        .all() as Array<Record<string, unknown>>;
      const totalDuplicates = result.reduce((sum, row) => sum + ((row._dup_count as number) - 1), 0);
      return { duplicateGroups: result.length, totalDuplicateRows: totalDuplicates, sample: result.slice(0, 20) };
    } finally {
      db.close();
    }
  }

  if (name === "listDatasets") {
    listDatasetsInputSchema.parse(input);
    const datasets = listDatasets();
    return { datasets };
  }

  if (name === "connectDatabase") {
    const parsed = connectDatabaseInputSchema.parse(input);
    const manager = getConnectionManager();
    const connectionId = crypto.randomUUID();
    manager.addConnection({
      id: connectionId,
      name: parsed.name,
      type: parsed.type as import("@/lib/connectors").ConnectorType,
      ...parsed.config,
    });
    return { connectionId, name: parsed.name, type: parsed.type, status: "added" };
  }

  throw new Error(`Unknown tool: ${name}`);
}
