import type { ChatToolName } from "@/lib/chat/tool-registry";
import { runTool } from "@/lib/chat/tool-registry";

export interface ToolExecutionResult {
  ok: boolean;
  name: ChatToolName;
  callId: string;
  output?: unknown;
  error?: string;
}

/** Human-readable descriptions used in error messages and logs. */
const toolDescriptions: Record<ChatToolName, string> = {
  getDatabaseSchema: "Fetch database schema",
  executeSQL: "Execute SQL query",
  showNeonDemo: "Show Neon demo",
  uploadFile: "Upload and ingest a data file into the working database",
  profileDataset: "Generate a comprehensive data profile for a table",
  profileColumn: "Deep-dive profile a specific column",
  suggestTransforms: "Suggest data cleaning steps based on profile results",
  applyTransform: "Apply a transformation step to a dataset",
  previewTransform: "Preview a transformation without applying it",
  splitDataset: "Split a dataset into train/val/test sets",
  exportDataset: "Export a dataset in a specified format",
  detectDuplicates: "Find and count duplicate rows",
  listDatasets: "List all uploaded and transformed datasets",
  connectDatabase: "Connect to an external database",
};

export async function executeToolCall(
  name: ChatToolName,
  callId: string,
  input: Record<string, unknown>
): Promise<ToolExecutionResult> {
  try {
    const output = await runTool(name, input);
    return { ok: true, name, callId, output };
  } catch (error: unknown) {
    const description = toolDescriptions[name] || name;
    return {
      ok: false,
      name,
      callId,
      error: error instanceof Error
        ? `${description} failed: ${error.message}`
        : `${description} failed`,
    };
  }
}
