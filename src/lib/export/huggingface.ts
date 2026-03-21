/**
 * HuggingFace Dataset Push
 *
 * Exports table data from the working SQLite database and pushes it
 * to a HuggingFace Hub dataset repository as CSV.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { rowsToCSV } from './csv';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');

export interface HuggingFacePushOptions {
  /** Table name in the working database */
  table: string;
  /** HuggingFace repo ID (e.g. "username/dataset-name") */
  repoId: string;
  /** HuggingFace API token */
  token: string;
  /** Whether the dataset repo should be private */
  private?: boolean;
  /** Dataset split name */
  split?: 'train' | 'test' | 'val';
  /** Human-readable description for the dataset card */
  description?: string;
}

export interface HuggingFacePushResult {
  url: string;
  datasetId: string;
}

const HF_API_BASE = 'https://huggingface.co/api';
const HF_UPLOAD_BASE = 'https://huggingface.co/api';

/**
 * Read all rows and column names from a table in the working database.
 */
function readTable(table: string): {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
} {
  const db = new Database(WORKING_DB_PATH, { readonly: true });

  try {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
      throw new Error('Invalid table name');
    }

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(table);
    if (!tableExists) {
      throw new Error(`Table '${table}' not found`);
    }

    const rows = db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    // If no rows, get column names from pragma
    if (columns.length === 0) {
      const colInfo = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
      return { rows: [], columns: colInfo.map((c) => c.name), rowCount: 0 };
    }

    return { rows, columns, rowCount: rows.length };
  } finally {
    db.close();
  }
}

/**
 * Create or ensure a dataset repository exists on HuggingFace.
 */
async function ensureRepo(
  repoId: string,
  token: string,
  isPrivate: boolean
): Promise<void> {
  const response = await fetch(`${HF_API_BASE}/repos/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'dataset',
      name: repoId,
      private: isPrivate,
    }),
  });

  // 409 means repo already exists, which is fine
  if (!response.ok && response.status !== 409) {
    const errorBody = await response.text();
    throw new Error(`Failed to create HuggingFace repo: ${response.status} ${errorBody}`);
  }
}

/**
 * Upload a file to a HuggingFace dataset repo.
 */
async function uploadFile(
  repoId: string,
  token: string,
  filePath: string,
  content: string | Buffer
): Promise<void> {
  const encodedPath = encodeURIComponent(filePath);
  const url = `${HF_UPLOAD_BASE}/datasets/${repoId}/upload/main/${encodedPath}`;

  const blobContent = typeof content === 'string' ? content : new Uint8Array(content);
  const blob = new Blob([blobContent]);

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: blob,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to upload file '${filePath}': ${response.status} ${errorBody}`);
  }
}

/**
 * Generate a dataset card (README.md) for the HuggingFace repo.
 */
function generateDatasetCard(options: {
  repoId: string;
  description?: string;
  columns: string[];
  rowCount: number;
}): string {
  const { repoId, description, columns, rowCount } = options;
  const now = new Date().toISOString().split('T')[0];

  const lines: string[] = [
    '---',
    'license: mit',
    'task_categories:',
    '  - tabular-classification',
    'language:',
    '  - en',
    `size_categories:`,
    `  - ${rowCount < 1000 ? 'n<1K' : rowCount < 10000 ? '1K<n<10K' : rowCount < 100000 ? '10K<n<100K' : '100K<n<1M'}`,
    '---',
    '',
    `# ${repoId.split('/').pop() || repoId}`,
    '',
    description || 'Dataset exported from DataForge.',
    '',
    '## Dataset Information',
    '',
    `- **Rows**: ${rowCount.toLocaleString()}`,
    `- **Columns**: ${columns.length}`,
    `- **Created**: ${now}`,
    `- **Source**: Exported via DataForge generative-sql-viz`,
    '',
    '## Columns',
    '',
    '| Column |',
    '|--------|',
    ...columns.map((col) => `| ${col} |`),
    '',
  ];

  return lines.join('\n');
}

/**
 * Push a table from the working SQLite database to a HuggingFace dataset repo.
 */
export async function pushToHuggingFace(
  options: HuggingFacePushOptions
): Promise<HuggingFacePushResult> {
  const {
    table,
    repoId,
    token,
    private: isPrivate = false,
    split = 'train',
    description,
  } = options;

  // 1. Read data from the working database
  const { rows, columns, rowCount } = readTable(table);
  if (rowCount === 0) {
    throw new Error(`Table '${table}' is empty — nothing to push`);
  }

  // 2. Convert to CSV
  const csvContent = rowsToCSV(rows, columns, { sanitize: false });

  // 3. Create or ensure repo exists
  await ensureRepo(repoId, token, isPrivate);

  // 4. Upload CSV file
  const csvFileName = `${split}.csv`;
  await uploadFile(repoId, token, csvFileName, csvContent);

  // 5. Generate and upload dataset card
  const readmeContent = generateDatasetCard({
    repoId,
    description,
    columns,
    rowCount,
  });
  await uploadFile(repoId, token, 'README.md', readmeContent);

  const datasetUrl = `https://huggingface.co/datasets/${repoId}`;

  return {
    url: datasetUrl,
    datasetId: repoId,
  };
}
