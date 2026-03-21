export const MCP_STORAGE_KEY = "mcp-servers";
export const MCP_UPDATED_EVENT = "mcp-servers-updated";

export type McpTransport = "http" | "sse";

export interface McpServerConfig {
  url: string;
  transport?: McpTransport;
  name?: string;
}

export type McpServerInput = string | McpServerConfig;

export interface NativeMcpContext {
  servers: McpServerConfig[];
}
