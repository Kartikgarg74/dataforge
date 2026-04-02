import { z } from "zod";
import Database from "better-sqlite3";
import path from "path";
import type { NativeChatRequest, NativeChatStreamEvent } from "@/lib/chat/types";
import { executeToolCall } from "@/lib/chat/tool-executor";
import type { ChatToolName } from "@/lib/chat/tool-registry";
import { enforceApiProtection } from "@/lib/security/api-guard";
import { apiMiddleware } from "@/lib/security/api-middleware";
import { beginRequest, completeRequest, failRequest } from "@/lib/observability/request-monitor";

const CHAT_DB_PATH = path.join(process.cwd(), "data", "working.db");

const nativeMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

/**
 * In-memory conversation history store with TTL eviction.
 * Maps threadId -> last 5 messages (user questions and assistant SQL responses).
 * Enables follow-up queries like "break that down by country".
 *
 * Bounded: max 500 threads, 1-hour TTL per thread, evicts oldest on overflow.
 */
const MAX_THREADS = 500;
const THREAD_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_HISTORY = 5;

interface ThreadEntry {
  messages: Array<{ role: string; content: string }>;
  lastAccessedAt: number;
}

const conversationStore = new Map<string, ThreadEntry>();

function pruneStaleThreads(): void {
  const now = Date.now();
  for (const [threadId, entry] of conversationStore.entries()) {
    if (now - entry.lastAccessedAt > THREAD_TTL_MS) {
      conversationStore.delete(threadId);
    }
  }
  // If still over limit, evict oldest
  if (conversationStore.size > MAX_THREADS) {
    const sorted = [...conversationStore.entries()].sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);
    const toEvict = sorted.slice(0, conversationStore.size - MAX_THREADS);
    for (const [threadId] of toEvict) {
      conversationStore.delete(threadId);
    }
  }
}

function getConversationHistory(threadId: string): Array<{ role: string; content: string }> {
  const entry = conversationStore.get(threadId);
  if (entry) {
    entry.lastAccessedAt = Date.now();
    return entry.messages;
  }
  return [];
}

function appendToConversation(threadId: string, role: string, content: string): void {
  let entry = conversationStore.get(threadId);
  if (!entry) {
    // Prune before adding new thread
    if (conversationStore.size >= MAX_THREADS) {
      pruneStaleThreads();
    }
    entry = { messages: [], lastAccessedAt: Date.now() };
    conversationStore.set(threadId, entry);
  }
  entry.messages.push({ role, content });
  entry.lastAccessedAt = Date.now();
  // Keep only the last MAX_HISTORY messages
  if (entry.messages.length > MAX_HISTORY) {
    entry.messages.splice(0, entry.messages.length - MAX_HISTORY);
  }
}

// --- DB persistence layer for chat threads ---

function getChatDb(): Database.Database {
  const db = new Database(CHAT_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS _chat_threads (
      id TEXT PRIMARY KEY,
      team_id TEXT,
      user_id TEXT,
      connector_id TEXT,
      title TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

function loadThreadFromDb(threadId: string): Array<{ role: string; content: string }> | null {
  try {
    const db = getChatDb();
    const row = db.prepare("SELECT messages FROM _chat_threads WHERE id = ?").get(threadId) as { messages: string } | undefined;
    db.close();
    if (row) {
      return JSON.parse(row.messages);
    }
    return null;
  } catch {
    return null;
  }
}

function persistThreadToDb(threadId: string, messages: Array<{ role: string; content: string }>, title?: string): void {
  try {
    const db = getChatDb();
    const existing = db.prepare("SELECT id FROM _chat_threads WHERE id = ?").get(threadId);
    if (existing) {
      db.prepare(
        "UPDATE _chat_threads SET messages = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(JSON.stringify(messages), threadId);
    } else {
      const threadTitle = title || `Thread ${threadId.slice(0, 8)}`;
      db.prepare(
        "INSERT INTO _chat_threads (id, title, messages, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
      ).run(threadId, threadTitle, JSON.stringify(messages));
    }
    db.close();
  } catch {
    // Silently fail DB persistence — memory store still works as cache
  }
}

function getConversationHistoryWithDb(threadId: string): Array<{ role: string; content: string }> {
  // Check memory cache first
  const entry = conversationStore.get(threadId);
  if (entry && entry.messages.length > 0) {
    entry.lastAccessedAt = Date.now();
    return entry.messages;
  }
  // Fall back to DB
  const fromDb = loadThreadFromDb(threadId);
  if (fromDb && fromDb.length > 0) {
    conversationStore.set(threadId, { messages: fromDb, lastAccessedAt: Date.now() });
    return fromDb;
  }
  return [];
}

const nativeRequestSchema = z.object({
  threadId: z.string().min(1),
  messages: z.array(nativeMessageSchema).min(1),
  mcp: z
    .object({
      servers: z.array(
        z.object({
          url: z.string().url(),
          transport: z.enum(["http", "sse"]).optional(),
          name: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

function sseEvent(event: string, payload: NativeChatStreamEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

interface PlannedToolCall {
  callId: string;
  name: ChatToolName;
  input: Record<string, unknown>;
}

function planToolCalls(input: NativeChatRequest): PlannedToolCall[] {
  const latestUserMessage = [...input.messages].reverse().find((m) => m.role === "user");
  const text = latestUserMessage?.content?.trim() || "";

  const plans: PlannedToolCall[] = [];

  if (/\b(schema|table|tables|columns)\b/i.test(text)) {
    plans.push({
      callId: crypto.randomUUID(),
      name: "getDatabaseSchema",
      input: {},
    });
  }

  const sqlMatch = text.match(/sql\s*:\s*([\s\S]+)/i);
  if (sqlMatch?.[1]) {
    plans.push({
      callId: crypto.randomUUID(),
      name: "executeSQL",
      input: { query: sqlMatch[1].trim() },
    });
  }

  if (/\bneon demo\b/i.test(text)) {
    plans.push({
      callId: crypto.randomUUID(),
      name: "showNeonDemo",
      input: {},
    });
  }

  // --- Data profiling ---
  if (/\b(profile|quality|stats|statistics|describe)\b/i.test(text)) {
    const tableMatch = text.match(/(?:profile|describe|stats\s+(?:for|of|on)?)\s+(\w+)/i);
    plans.push({
      callId: crypto.randomUUID(),
      name: "profileDataset",
      input: { table: tableMatch?.[1] || "default" },
    });
  }

  // --- Transform suggestions ---
  if (/\b(transform|clean|remove|fill|drop|rename|encode)\b/i.test(text)) {
    const tableMatch = text.match(/(?:transform|clean|remove|fill|drop|rename|encode)\s+(?:the\s+)?(\w+)/i);
    plans.push({
      callId: crypto.randomUUID(),
      name: "suggestTransforms",
      input: { table: tableMatch?.[1] || "default" },
    });
  }

  // --- Dataset splitting ---
  if (/\b(split|train|test|validation)\b/i.test(text)) {
    const tableMatch = text.match(/split\s+(\w+)/i);
    plans.push({
      callId: crypto.randomUUID(),
      name: "splitDataset",
      input: {
        table: tableMatch?.[1] || "default",
        strategy: "random",
        ratios: { train: 0.7, val: 0.15, test: 0.15 },
      },
    });
  }

  // --- Export / download ---
  if (/\b(export|download|save as)\b/i.test(text)) {
    const tableMatch = text.match(/(?:export|download|save)\s+(\w+)/i);
    const formatMatch = text.match(/\b(csv|json|jsonl|parquet|arrow|sqlite)\b/i);
    plans.push({
      callId: crypto.randomUUID(),
      name: "exportDataset",
      input: {
        table: tableMatch?.[1] || "default",
        format: formatMatch?.[1]?.toLowerCase() || "csv",
      },
    });
  }

  // --- Upload / ingest ---
  if (/\b(upload|ingest|import)\b/i.test(text)) {
    plans.push({
      callId: crypto.randomUUID(),
      name: "uploadFile",
      input: {},
    });
  }

  // --- Duplicate detection ---
  if (/\b(duplicate|dedup)\b/i.test(text)) {
    const tableMatch = text.match(/(?:duplicate|dedup)\w*\s+(?:in\s+)?(\w+)/i);
    plans.push({
      callId: crypto.randomUUID(),
      name: "detectDuplicates",
      input: { table: tableMatch?.[1] || "default" },
    });
  }

  // --- External database connection ---
  if (/\b(connect|database|postgres|mysql)\b/i.test(text)) {
    const typeMatch = text.match(/\b(postgres|mysql|sqlite)\b/i);
    plans.push({
      callId: crypto.randomUUID(),
      name: "connectDatabase",
      input: {
        type: typeMatch?.[1]?.toLowerCase() || "postgres",
        name: "chat-connection",
        config: {},
      },
    });
  }

  // --- List datasets / tables (only when not already matched by schema) ---
  if (/\b(datasets?|tables?|list)\b/i.test(text) && !plans.some((p) => p.name === "getDatabaseSchema")) {
    plans.push({
      callId: crypto.randomUUID(),
      name: "listDatasets",
      input: {},
    });
  }

  return plans;
}

function buildAssistantReply(input: NativeChatRequest, toolSummaries: string[]): string {
  const latestUserMessage = [...input.messages].reverse().find((m) => m.role === "user");
  const userText = latestUserMessage?.content?.trim() || "";

  if (!userText) {
    return "Native chat runtime is active. Send a message to start streaming responses.";
  }

  const summaryBlock = toolSummaries.length
    ? ["", "Tool execution summary:", ...toolSummaries.map((s) => `- ${s}`)].join("\n")
    : "";

  const mcpSummary =
    input.mcp && input.mcp.servers.length > 0
      ? `\nMCP context: ${input.mcp.servers.length} configured server(s) available to the native runtime adapter.`
      : "\nMCP context: no configured servers.";

  return [
    "Native streaming pipeline is active.",
    "",
    `You said: ${userText}`,
    mcpSummary,
    summaryBlock,
  ].join("\n").trim();
}

export async function POST(request: Request) {
  const { error: middlewareError } = await apiMiddleware(request, { auditAction: 'chat.message' });
  if (middlewareError) return middlewareError;

  const monitor = beginRequest("chat", request);

  const blocked = enforceApiProtection(request, {
    route: "chat",
    rateLimit: { windowMs: 60_000, max: 60 },
  });
  if (blocked) {
    completeRequest(monitor, blocked.status, { blocked: true });
    return blocked;
  }

  const body = await request.json().catch(() => null);
  const parsed = nativeRequestSchema.safeParse(body);

  if (!parsed.success) {
    completeRequest(monitor, 400, { reason: "invalid_payload" });
    return new Response(
      sseEvent("error", { type: "error", error: "Invalid chat payload" }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      }
    );
  }

  const input = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const messageId = crypto.randomUUID();

      // Store the user's message in conversation history
      const latestUserMsg = [...input.messages].reverse().find((m) => m.role === "user");
      if (latestUserMsg) {
        appendToConversation(input.threadId, "user", latestUserMsg.content);
      }

      // Inject conversation history into the input messages for tool planning context
      const history = getConversationHistoryWithDb(input.threadId);
      if (history.length > 1) {
        // Add previous messages as context (excluding the current one we just appended)
        const previousMessages = history.slice(0, -1);
        for (const msg of previousMessages) {
          if (!input.messages.some((m) => m.content === msg.content && m.role === msg.role)) {
            input.messages.unshift({
              role: msg.role as "user" | "assistant" | "system",
              content: msg.content,
            });
          }
        }
      }

      // Detect query correction intent
      const correctionPattern = /no,? i meant|not that|wrong|incorrect|actually/i;
      if (latestUserMsg && correctionPattern.test(latestUserMsg.content)) {
        // Find the previous assistant response and user query for context
        const prevHistory = history.slice(0, -1);
        const lastAssistantMsg = [...prevHistory].reverse().find((m) => m.role === "assistant");
        const lastUserQuery = [...prevHistory].reverse().find((m) => m.role === "user");

        if (lastAssistantMsg || lastUserQuery) {
          const correctionContext = [
            "The user wants to correct their previous query.",
            lastUserQuery ? `Previous user query: "${lastUserQuery.content}"` : "",
            lastAssistantMsg ? `Previous result: "${lastAssistantMsg.content.slice(0, 500)}"` : "",
            "Please interpret the user's correction and generate the corrected response.",
          ].filter(Boolean).join("\n");

          input.messages.unshift({
            role: "system",
            content: correctionContext,
          });
        }
      }

      controller.enqueue(
        encoder.encode(
          sseEvent("start", { type: "start", threadId: input.threadId, messageId })
        )
      );

      const toolPlans = planToolCalls(input);
      const toolSummaries: string[] = [];

      for (const plan of toolPlans) {
        controller.enqueue(
          encoder.encode(
            sseEvent("tool_start", {
              type: "tool_start",
              callId: plan.callId,
              name: plan.name,
              input: plan.input,
            })
          )
        );

        const result = await executeToolCall(plan.name, plan.callId, plan.input);
        if (result.ok) {
          toolSummaries.push(`${plan.name} completed successfully`);
          controller.enqueue(
            encoder.encode(
              sseEvent("tool_result", {
                type: "tool_result",
                callId: result.callId,
                name: result.name,
                output: result.output,
              })
            )
          );
        } else {
          toolSummaries.push(`${plan.name} failed: ${result.error || "unknown error"}`);
          controller.enqueue(
            encoder.encode(
              sseEvent("tool_error", {
                type: "tool_error",
                callId: result.callId,
                name: result.name,
                error: result.error || "Tool execution failed",
              })
            )
          );
        }
      }

      const fullReply = buildAssistantReply(input, toolSummaries);

      // Store the assistant reply in conversation history
      appendToConversation(input.threadId, "assistant", fullReply);

      // Persist to DB
      const updatedEntry = conversationStore.get(input.threadId);
      const updatedHistory = updatedEntry?.messages || [];
      persistThreadToDb(input.threadId, updatedHistory, latestUserMsg?.content?.slice(0, 80));

      const chunks = fullReply.match(/.{1,20}/g) || [];

      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(sseEvent("delta", { type: "delta", delta: chunk }))
        );
      }

      controller.enqueue(encoder.encode(sseEvent("end", { type: "end" })));
      controller.close();
    },
  });

  try {
    const response = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
    completeRequest(monitor, 200, { streaming: true });
    return response;
  } catch (error: unknown) {
    failRequest(monitor, error, 500);
    throw error;
  }
}
