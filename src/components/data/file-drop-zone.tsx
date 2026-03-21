'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, Database, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface FileDropZoneProps {
  onUploadComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface UploadResult {
  table: {
    name: string;
    rowCount: number;
    columnCount: number;
    columns: Array<{
      name: string;
      type: string;
      nullCount: number;
      sampleValues: unknown[];
    }>;
  };
  preview: {
    rows: Record<string, unknown>[];
    totalRows: number;
    showing: number;
  };
  metadata: {
    originalFilename: string;
    fileSize: number;
    format: string;
    ingestTimeMs: number;
  };
  warnings: string[];
}

const ALLOWED_EXTENSIONS = [
  'csv', 'tsv', 'json', 'jsonl', 'ndjson',
  'parquet', 'xlsx', 'xls', 'db', 'sqlite',
];

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  csv: <FileText className="w-5 h-5" />,
  tsv: <FileText className="w-5 h-5" />,
  json: <FileText className="w-5 h-5" />,
  jsonl: <FileText className="w-5 h-5" />,
  xlsx: <FileSpreadsheet className="w-5 h-5" />,
  xls: <FileSpreadsheet className="w-5 h-5" />,
  parquet: <Database className="w-5 h-5" />,
  sqlite: <Database className="w-5 h-5" />,
};

export function FileDropZone({ onUploadComplete, onError, className = '' }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadQueue, setUploadQueue] = useState<Array<{ name: string; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }>>([]);
  const [lastResult, setLastResult] = useState<UploadResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type: .${ext}. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > 500 * 1024 * 1024) {
      return 'File too large. Maximum size is 500MB.';
    }
    if (file.size === 0) {
      return 'File is empty.';
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setLastError(validationError);
      onError?.(validationError);
      return;
    }

    setIsUploading(true);
    setLastError(null);
    setLastResult(null);
    setUploadProgress(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setLastResult(data);
      setUploadProgress('');
      onUploadComplete?.(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setLastError(errorMsg);
      setUploadProgress('');
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, onError]);

  const uploadMultipleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // If only one file, use the single upload path
    if (fileArray.length === 1) {
      uploadFile(fileArray[0]);
      return;
    }

    setLastError(null);
    setLastResult(null);
    setIsUploading(true);

    const queue = fileArray.map((f) => ({ name: f.name, status: 'pending' as const }));
    setUploadQueue(queue);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const validationError = validateFile(file);
      if (validationError) {
        setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: validationError } : item));
        onError?.(validationError);
        continue;
      }

      setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item));
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${fileArray.length})...`);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'done' } : item));
        setLastResult(data);
        onUploadComplete?.(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploadQueue((prev) => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: errorMsg } : item));
        onError?.(errorMsg);
      }
    }

    setUploadProgress('');
    setIsUploading(false);
  }, [uploadFile, onUploadComplete, onError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMultipleFiles(files);
    }
  }, [uploadMultipleFiles]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMultipleFiles(files);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
          multiple
          onChange={handleFileSelect}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600 dark:text-gray-400">{uploadProgress}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop files here, or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-1">
                CSV, JSON, JSONL, Parquet, Excel, SQLite (max 500MB)
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {Object.entries(FORMAT_ICONS).map(([ext, icon]) => (
                <span
                  key={ext}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-400"
                >
                  {icon}
                  .{ext}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-file upload progress */}
      {uploadQueue.length > 1 && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Upload progress ({uploadQueue.filter((q) => q.status === 'done').length}/{uploadQueue.length})
          </p>
          <div className="space-y-1">
            {uploadQueue.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {item.status === 'pending' && <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />}
                {item.status === 'uploading' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
                {item.status === 'done' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                {item.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                <span className={item.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                  {item.name}{item.error ? ` - ${item.error}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {lastError && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{lastError}</p>
        </div>
      )}

      {/* Success */}
      {lastResult && (
        <div className="mt-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Uploaded successfully
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>Table: <strong>{lastResult.table.name}</strong></span>
            <span>Rows: <strong>{lastResult.table.rowCount.toLocaleString()}</strong></span>
            <span>Columns: <strong>{lastResult.table.columnCount}</strong></span>
            <span>Size: <strong>{formatFileSize(lastResult.metadata.fileSize)}</strong></span>
            <span>Format: <strong>{lastResult.metadata.format.toUpperCase()}</strong></span>
            <span>Time: <strong>{lastResult.metadata.ingestTimeMs}ms</strong></span>
          </div>
          {lastResult.warnings.length > 0 && (
            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
              {lastResult.warnings.map((w, i) => (
                <p key={i}>Warning: {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
