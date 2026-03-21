# Tambo Replacement Architecture

## Purpose

Define the target architecture for removing `@tambo-ai/react` while preserving existing product behavior:

- chat conversation flow
- tool execution (SQL, Python, schema)
- generated component rendering
- canvas interactions
- MCP server configuration

This document is the implementation contract for Tasks 10 to 16.

## Current Baseline

Current runtime coupling points:

- Chat shell and providers in `src/app/chat/page.tsx`
- Registered generative components in `src/lib/tambo.ts`
- Message thread UI in `src/components/tambo/message-thread-full.tsx`
- Interactable updates in `src/components/ui/interactable-tabs.tsx`
- Interactable details in `src/components/ui/interactable-canvas-details.tsx`

## Target Architecture

### 1. Chat Orchestration Layer

Replace Tambo providers with an internal orchestration pipeline:

- `ChatProvider` (new)
- `useChatStore` (Zustand) for thread state
- `ChatGateway` API route for model interaction and streaming

Responsibilities:

- maintain thread messages and generation status
- execute approved tools via server-side dispatcher
- append generated component payloads to chat state
- expose deterministic state for UI rendering

### 2. Tool Execution Layer

Move from provider-managed tool calling to explicit server-controlled tool execution.

Add modules:

- `src/lib/chat/tool-registry.ts`
- `src/lib/chat/tool-executor.ts`

Requirements:

- each tool has zod input and output schema
- execution is server-only
- failures are normalized into structured tool error results

### 3. Component Registry Layer

Replace Tambo component registration with internal registry metadata.

Add module:

- `src/lib/chat/component-registry.ts`

Status:

- Implemented in Task 13.

Registry contract:

- `name`
- `description`
- `propsSchema`
- `render` component reference

The registry remains source-of-truth for dynamic component rendering.

### 4. Dynamic Component Renderer

Add module:

- `src/components/chat/component-renderer.tsx`

Status:

- Implemented in Task 13.

Responsibilities:

- resolve component name from registry
- validate props with zod before render
- render fallback error component when validation fails

### 5. Thread UI Layer

Introduce Tambo-free chat UI components:

- `src/components/chat/thread.tsx`
- `src/components/chat/message.tsx`
- `src/components/chat/input.tsx`
- `src/components/chat/suggestions.tsx`

Requirements:

- preserve current UX parity for message rendering and input handling
- keep existing canvas panel layout and responsive behavior

### 6. Interactable State Layer

Replace `useTamboInteractable` pattern with local app store.

Add module:

- `src/lib/interactable-store.ts`

Status:

- Implemented in Task 14.

Responsibilities:

- persist and synchronize selected tab/canvas details
- expose update actions consumed by tabs/details components
- decouple canvas state from AI provider internals

### 7. MCP Integration Layer

Keep current MCP config UI while decoupling provider wrappers.

Preserve:

- `src/components/tambo/mcp-config-modal.tsx` (or move to `src/components/mcp/`)

Add:

- `src/lib/mcp/client.ts`
- `src/lib/mcp/types.ts`

Status:

- Implemented in Task 15.

Responsibilities:

- maintain server definitions from local storage
- pass MCP resources/prompts into chat gateway context
- avoid direct dependency on Tambo MCP provider

## Data Flow (Target)

1. User submits message in chat input.
2. Message is stored in `useChatStore`.
3. Client calls `/api/chat` with thread and contextual state.
4. Server model adapter returns assistant content plus tool calls.
5. Tool executor runs allowed tools and appends tool results.
6. Assistant output includes component payload instructions.
7. Client renderer validates payloads and renders components.
8. Canvas store manages placement, drag/drop, and persistence.

## Provider Abstraction

Add provider-agnostic model interface so LLM backend can change without UI rewrites.

Proposed interface:

```ts
export interface ChatModelAdapter {
  generate(input: ChatGenerateInput): Promise<ChatGenerateResult>;
  stream?(input: ChatGenerateInput): AsyncIterable<ChatStreamEvent>;
}
```

Initial implementation can target one provider, but the interface must remain stable.

## Rollout Plan

### Phase A: Parallel Stack (No User-Visible Break)

- build new chat modules under `src/components/chat/` and `src/lib/chat/`
- keep Tambo path active in production route
- add a feature flag `NEXT_PUBLIC_CHAT_RUNTIME=tambo|native`

### Phase B: Feature Parity Validation

- validate SQL/Python/schema tool flows
- validate component rendering parity
- validate canvas interaction parity
- validate MCP prompt/resource insertion path

### Phase C: Runtime Switch

- switch default to `native`
- keep Tambo path behind fallback flag for one release window

### Phase D: Removal

- remove `@tambo-ai/react` and `@tambo-ai/react/mcp` usage
- delete obsolete Tambo thread/input/suggestions wrappers
- remove Tambo-specific provider wiring from chat page

Status:

- Implemented in Task 16.

## Risks and Controls

1. Streaming regressions
- control: integration tests for chunk ordering and cancel behavior

2. Tool result format drift
- control: strict zod schemas in tool registry and contract tests

3. Component payload mismatches
- control: registry schema validation and fallback renderer

4. MCP behavior regression
- control: adapter layer and explicit end-to-end tests for prompts/resources

## Acceptance Criteria for Task 9

- architecture documented in repo
- clear module boundaries defined
- migration phases and rollout guardrails defined
- direct mapping from current Tambo touchpoints to replacement modules defined

## Deliverables for Task 10+

- Task 10: implement `useChatStore` and `ChatProvider`
- Task 11: implement `/api/chat` streaming path
- Task 12: implement tool registry and executor
- Task 13: implement component registry and renderer
- Task 14: migrate interactable state to local store
- Task 15: move MCP path to adapter layer
- Task 16: remove Tambo runtime dependencies

## Operations Hardening Status

- Task 18 implemented: shared API auth and rate-limit guard added and applied to active API endpoints.
