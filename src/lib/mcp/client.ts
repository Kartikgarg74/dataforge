"use client";

import * as React from "react";
import {
  MCP_STORAGE_KEY,
  MCP_UPDATED_EVENT,
  type McpServerConfig,
  type McpServerInput,
  type McpTransport,
} from "@/lib/mcp/types";

function isTransport(value: unknown): value is McpTransport {
  return value === "http" || value === "sse";
}

function normalizeServer(input: McpServerInput): McpServerConfig | null {
  if (typeof input === "string") {
    const url = input.trim();
    return url ? { url, transport: "http" } : null;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!url) return null;

  return {
    url,
    transport: isTransport(input.transport) ? input.transport : "http",
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined,
  };
}

export function normalizeMcpServers(input: unknown): McpServerConfig[] {
  if (!Array.isArray(input)) return [];

  const uniqueUrls = new Set<string>();
  const normalized: McpServerConfig[] = [];

  for (const entry of input) {
    const next = normalizeServer(entry as McpServerInput);
    if (!next) continue;
    if (uniqueUrls.has(next.url)) continue;
    uniqueUrls.add(next.url);
    normalized.push(next);
  }

  return normalized;
}

export function getMcpServersSnapshot(): McpServerConfig[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(MCP_STORAGE_KEY);
  if (!raw) return [];

  try {
    return normalizeMcpServers(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function useMcpServers(): McpServerConfig[] {
  const [servers, setServers] = React.useState<McpServerConfig[]>(() =>
    getMcpServersSnapshot(),
  );

  React.useEffect(() => {
    const update = () => {
      setServers(getMcpServersSnapshot());
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === MCP_STORAGE_KEY) {
        update();
      }
    };

    window.addEventListener(MCP_UPDATED_EVENT, update as EventListener);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(MCP_UPDATED_EVENT, update as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return servers;
}
