# MASTER TODO — DataForge Development Checklist

> **Generated:** 2026-03-19
> **Source PRDs:** Option A (AI Data Prep), Option B (Team BI), Mobile Strategy
> **Author:** Kartik Garg

---

## Summary Table

| Phase | Description | Task Count | Est. Total Days |
|-------|-------------|------------|-----------------|
| **Phase 0** | Cleanup & Security Hardening | 28 | 18 |
| **Phase 1A** | Foundation (Connectors, Upload, Export) | 52 | 38 |
| **Phase 1B** | Data Prep Core (Profiling, Transforms, AI) | 55 | 45 |
| **Phase 1C** | ML-Ready Features (Splitting, Advanced Export, Versioning) | 35 | 30 |
| **Phase 2A** | Auth & Core Team | 42 | 35 |
| **Phase 2B** | Dashboards & Visualizations | 48 | 40 |
| **Phase 2C** | Sharing & Scheduling | 40 | 35 |
| **Mobile M1** | PWA Foundation | 24 | 14 |
| **Mobile M2** | Capacitor Wrapper | 22 | 16 |
| **Mobile M3** | App Store Submission | 12 | 8 |
| **Mobile M4** | Native Enhancements | 14 | 25 |
| **TOTAL** | | **372** | **304** |

---

## Phase 0: Cleanup & Security Hardening

> Pre-requisite work before any new feature development. Fix the foundation.

### Dead Code Removal

- [ ] Remove Brave Search API stubs and references — Easy — 0.5d
- [ ] Remove GitHub API stubs and references — Easy — 0.5d
- [ ] Audit and remove any other unused MCP server configurations — Easy — 0.5d
- [ ] Remove commented-out canvas tools (update/delete) or fix schema validation — Easy — 0.5d
- [ ] Clean up unused dependencies in package.json — Easy — 0.5d

### Security Gaps — Immediate Fixes

- [ ] Add Content-Security-Policy (CSP) headers to Next.js middleware — Medium — 1d
  - Restrict `script-src`, `style-src`, `connect-src`, `frame-ancestors`
  - Block inline scripts except nonce-based
- [ ] Add CSRF protection for all state-changing API routes — Medium — 1.5d
  - Implement double-submit cookie or SameSite cookie pattern
  - Add CSRF token to all POST/PUT/DELETE requests
- [ ] Add SSRF protection for database connectors — Hard — 2d
  - Block connections to private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
  - Block connections to localhost, 0.0.0.0, and IPv6 loopback
  - DNS rebinding protection (resolve hostname before connecting, re-verify)
  - Allowlist/denylist configuration for connector targets
- [ ] Upgrade Python sandbox to Pyodide/WASM — Hard — 3d
  - Replace current Node.js child_process sandbox with Pyodide WASM runtime
  - Remove network access from sandbox entirely
  - Add memory limit (256MB) and CPU time limit (30s)
  - Add filesystem isolation (no host filesystem access)
- [ ] Add encryption at rest for uploaded data files — Medium — 1d
  - AES-256 encryption for files stored on disk
  - Key management (environment variable or secret manager)
  - Encrypt SQLite working databases containing user data
- [ ] Implement audit logging foundation — Medium — 1.5d
  - Create audit_log table in app database
  - Log all API calls: who, what, when, IP address
  - Log all SQL query executions with query text and row counts
  - Immutable log entries (append-only, no delete API)
- [ ] Harden JWT/session security — Medium — 1d
  - Set short JWT TTL (15 minutes) with refresh tokens (7 days)
  - HTTP-only, Secure, SameSite=Strict cookies
  - Token rotation on refresh
  - Invalidation on password change
- [ ] Add MongoDB injection prevention — Medium — 1d
  - Sanitize all user inputs before constructing MongoDB queries
  - Use parameterized queries, never string concatenation
  - Block `$where`, `$expr`, and other operator injection vectors
  - Input validation with strict schemas (Zod) on all API inputs
- [ ] Add CSV injection prevention in exports — Easy — 0.5d
  - Prefix cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote
  - Apply to all CSV and Excel exports
  - Add `Tab` and `DDE` payload detection

### CI/CD Improvements

- [ ] Set up GitHub Actions CI pipeline — Medium — 1d
  - Lint (ESLint), type check (tsc), unit tests on every PR
- [ ] Add pre-commit hooks (Husky + lint-staged) — Easy — 0.5d
- [ ] Add dependency vulnerability scanning (npm audit / Snyk) — Easy — 0.5d
- [ ] Add SAST scanning (CodeQL or Semgrep) — Medium — 1d
- [ ] Set up staging environment with preview deploys — Medium — 1d

---

## Phase 1A: Foundation (Weeks 1-3)

> File upload, database connectors, basic export. The core data input/output layer.

### Backend — Connector Interface & Manager

- [ ] Define `DatabaseConnector` TypeScript interface — Easy — 0.5d
  - `connect()`, `disconnect()`, `executeQuery()`, `getSchema()`, `getTables()`, `getColumns()`, `getRowCount()`, `testConnection()`
- [ ] Implement `ConnectionManager` class — Medium — 1d
  - Map of connectors by ID, add/remove/list/test operations
  - Depends on: connector interface
- [ ] Refactor existing SQLite connector to implement interface — Medium — 1d
  - Depends on: connector interface
- [ ] Refactor existing Postgres/Neon connector to implement interface — Medium — 1d
  - Depends on: connector interface
- [ ] Implement MySQL connector (`mysql2`) — Medium — 2d
  - Connection pooling, SSL support, schema discovery
  - Depends on: connector interface
- [ ] Implement MongoDB connector (`mongodb`) — Hard — 3d
  - Schema inference from document sampling
  - Present collections as "tables" with inferred columns
  - Map MongoDB aggregation to SQL-like query interface
  - Depends on: connector interface
- [ ] Create `POST /api/connector` endpoint — Medium — 1d
  - Actions: add, remove, test, list
  - Depends on: ConnectionManager
- [ ] AES-256 encrypt connection credentials before storage — Medium — 1d
  - Depends on: connector endpoint

### Backend — File Upload & Ingestion

- [ ] Implement file format detection (CSV, TSV, JSON, JSONL, Parquet, SQLite, Excel) — Medium — 1.5d
- [ ] Implement CSV/TSV parser with auto-detection (delimiter, encoding, headers) — Medium — 1.5d
  - Use `papaparse` for parsing
- [ ] Implement JSON/JSONL parser with nested object flattening — Medium — 1d
- [ ] Implement column type inference engine — Medium — 2d
  - Int, float, string, date, boolean, JSON detection
  - >90% accuracy target
- [ ] Create `POST /api/upload` endpoint — Medium — 2d
  - Multipart form data handling with `multer`
  - File size validation (500MB local, 100MB cloud)
  - Return schema + profile summary
  - Depends on: file parser, type inference
- [ ] Implement Parquet file reading (`parquetjs-lite`) — Medium — 1.5d
- [ ] Implement Excel file reading (`xlsx`) — Medium — 1.5d
  - Parse multiple sheets as separate tables
- [ ] Implement SQLite file mounting (read-only) — Easy — 0.5d
- [ ] Implement ingestion into working SQLite database — Medium — 1.5d
  - Create table from inferred schema, bulk insert rows
  - Depends on: type inference, file parser
- [ ] Handle duplicate uploads with versioned table names (e.g., `sales_v1`, `sales_v2`) — Easy — 0.5d
- [ ] Filename sanitization + temp directory isolation for uploads — Easy — 0.5d
- [ ] Parameterized queries for all data insertion (SQL injection prevention) — Medium — 0.5d

### Backend — Export Engine

- [ ] Create `POST /api/export` endpoint — Medium — 1.5d
- [ ] Implement CSV export with streaming for large datasets — Medium — 1.5d
  - Support up to 1M rows, >50MB via streaming
  - CSV injection prevention applied
- [ ] Implement JSON export — Easy — 0.5d
- [ ] Implement JSONL export — Easy — 0.5d
- [ ] Implement Parquet export with type preservation — Hard — 3d
  - Compression options: none, gzip, snappy, zstd
- [ ] Implement column subset selection for exports — Easy — 0.5d
- [ ] Implement row limit and sampling options for exports — Easy — 0.5d
- [ ] Large export handling: streaming to temp file + expiring download URL — Medium — 1.5d

### Frontend — File Upload UI

- [ ] Build `FileDropZone` component — Medium — 1.5d
  - Drag-drop area with format icons, progress bar, file type validation
- [ ] Build file upload preview (first 100 rows + inferred types) — Medium — 1.5d
  - Depends on: upload API endpoint
- [ ] Build `ConnectorForm` component — Medium — 1.5d
  - Database connection form: host, port, db, user, password, SSL toggle
  - Test connection button with inline status
- [ ] Build `ConnectorList` component — Medium — 1d
  - Saved connections with status indicators (connected/disconnected/error)
  - Depends on: connector endpoint
- [ ] Build `DataPreviewTable` component — Medium — 1.5d
  - Sortable, filterable table with type badges per column
- [ ] Build `ExportDialog` component — Medium — 1.5d
  - Format selector, compression options, column picker, download button
  - Accessible from chat and UI toolbar

### Frontend — Schema & Navigation

- [ ] Add Schema tab to right panel showing all tables/columns — Medium — 1d
- [ ] Show row count, column count, inferred types after upload — Easy — 0.5d
- [ ] Error handling UI for malformed files and oversized uploads — Easy — 0.5d

### Testing — Phase 1A

- [ ] Unit tests for each connector (Postgres, MySQL, MongoDB, SQLite) — Medium — 2d
- [ ] Unit tests for file parsers (CSV, JSON, Parquet, Excel) — Medium — 1.5d
- [ ] Unit tests for type inference engine — Medium — 1d
- [ ] Unit tests for export formats (CSV, JSON, Parquet) — Medium — 1d
- [ ] Integration test: upload CSV -> query -> export flow — Medium — 1d
- [ ] Integration test: connect external DB -> schema discovery -> query — Medium — 1d

### Infrastructure — Phase 1A

- [ ] Add new npm dependencies: `mysql2`, `mongodb`, `papaparse`, `parquetjs-lite`, `xlsx`, `simple-statistics`, `multer`, `apache-arrow` — Easy — 0.5d
- [ ] Create `src/lib/connectors/` directory structure — Easy — 0.25d
- [ ] Create `src/lib/ingestion/` directory structure — Easy — 0.25d
- [ ] Create `src/lib/export/` directory structure — Easy — 0.25d

### Docs — Phase 1A

- [ ] Document connector setup for each supported database — Easy — 0.5d
- [ ] Document supported file formats and limitations — Easy — 0.5d

---

## Phase 1B: Data Prep Core (Weeks 4-7)

> Profiling engine, transform pipeline, AI tool integration. The heart of Option A.

### Backend — Data Profiling Engine

- [ ] Implement column statistics calculator — Hard — 2d
  - Type, null count/%, unique count/%, most frequent values (top 10)
  - Depends on: working database with ingested data
- [ ] Implement numeric column stats — Medium — 1.5d
  - Min, max, mean, median, std, percentiles (P25, P50, P75, P95, P99)
- [ ] Implement string column stats — Medium — 1d
  - Min/max/avg length, pattern detection (email, phone, URL, UUID)
- [ ] Implement date column stats — Medium — 1d
  - Earliest, latest, gap analysis
- [ ] Implement histogram generation (20-bucket distribution) — Medium — 1.5d
- [ ] Implement IQR-based outlier detection — Medium — 1d
- [ ] Implement Pearson correlation matrix for numeric columns — Medium — 1.5d
- [ ] Implement data quality alerts engine — Medium — 1.5d
  - High null %, outliers > 3 sigma, duplicate rows, candidate primary keys
- [ ] Implement sampling with confidence intervals for datasets > 100k rows — Medium — 1.5d
- [ ] Create `POST /api/profile` endpoint — Medium — 1d
  - Table name, optional column subset, optional sample size
  - Depends on: profiling engine
- [ ] Implement profile caching (only regenerate when data changes) — Medium — 1d

### Backend — Transform Pipeline

- [ ] Define `TransformStep` and `TransformPipeline` data models — Easy — 0.5d
- [ ] Implement transform pipeline executor — Hard — 2d
  - Sequential step execution with row/column count tracking per step
- [ ] Implement filter rows transform — Medium — 1d
- [ ] Implement remove duplicates transform — Medium — 0.5d
- [ ] Implement sample/sort/limit transforms — Easy — 0.5d
- [ ] Implement fill nulls transform (value, mean, median, mode) — Medium — 1d
- [ ] Implement drop rows with nulls transform — Easy — 0.5d
- [ ] Implement column rename/drop/reorder/cast type transforms — Medium — 1d
- [ ] Implement add computed column transform — Medium — 1d
- [ ] Implement string operations (trim, lowercase, uppercase, regex replace, extract, split) — Medium — 1.5d
- [ ] Implement numeric operations (round, normalize min-max/z-score, bin/bucket, clip outliers) — Medium — 1.5d
- [ ] Implement date operations (extract year/month/day, compute age, parse format) — Medium — 1d
- [ ] Implement one-hot encoding transform — Medium — 1d
- [ ] Implement label encoding and ordinal encoding transforms — Medium — 1d
- [ ] Implement group by + aggregate transform — Medium — 1d
- [ ] Implement join between tables (inner/left/right/outer) — Hard — 2d
- [ ] Implement SQL-based custom transform — Medium — 1d
- [ ] Implement Python-based custom transform (via sandbox) — Hard — 2d
  - Depends on: Pyodide/WASM sandbox from Phase 0
- [ ] Create `POST /api/transform` endpoint — Medium — 1.5d
  - Pipeline creation/extension, preview mode, full execution
  - Depends on: pipeline executor
- [ ] Implement pipeline undo/redo (revert any step) — Medium — 1.5d
- [ ] Implement pipeline save and re-run on new data — Medium — 1d

### Backend — AI Tool Registry Extension

- [ ] Register `profileDataset` tool — run full profiling on a table — Medium — 1d
- [ ] Register `profileColumn` tool — deep-dive single column profiling — Medium — 0.5d
- [ ] Register `detectOutliers` tool — IQR/Z-score outlier scan — Medium — 0.5d
- [ ] Register `suggestTransforms` tool — AI-recommended cleanup steps based on profile — Hard — 2d
- [ ] Register `previewTransform` tool — show before/after of a transform — Medium — 1d
- [ ] Register `applyTransform` tool — execute transform on dataset — Medium — 0.5d
- [ ] Register `detectDuplicates` tool — find and display duplicate rows — Medium — 0.5d
- [ ] Register `inferJoinKeys` tool — suggest join columns between tables — Medium — 1d
- [ ] Register `compareColumns` tool — cross-column analysis — Medium — 0.5d
- [ ] Enable AI tool chaining: profile -> suggest -> preview -> apply in one conversation — Hard — 2d
- [ ] Ensure AI shows reasoning before executing transforms (user approve/reject) — Medium — 1d

### Frontend — Profiling UI

- [ ] Build `ProfileDashboard` component — Hard — 2.5d
  - Dataset summary bar: total rows, columns, memory size, duplicate rows, completeness %
  - Grid of column profile cards
  - Quality alerts section
  - Depends on: profile API endpoint
- [ ] Build `ColumnProfileCard` component — Medium — 1.5d
  - Type, nulls, unique count, distribution mini-chart
  - Clickable for full detail view
- [ ] Build `CorrelationHeatmap` component — Medium — 1.5d
  - Interactive heatmap of numeric column correlations
- [ ] Build `QualityAlertBanner` component — Easy — 0.5d
  - Dismissible alerts for data quality issues

### Frontend — Transform Pipeline UI

- [ ] Build `TransformPipelineView` component — Hard — 2.5d
  - Visual step-by-step pipeline with row/column count deltas
  - Undo/reorder controls
  - Depends on: transform API endpoint
- [ ] Build `TransformStepEditor` component — Medium — 2d
  - Form for configuring each transform step type
  - Preview at any step without full execution

### Testing — Phase 1B

- [ ] Unit tests for all profiling calculations (stats, histograms, correlations) — Medium — 2d
- [ ] Unit tests for each transform step type — Medium — 2d
- [ ] Unit tests for pipeline executor (multi-step, undo/redo) — Medium — 1.5d
- [ ] Unit tests for AI tool registry (each tool returns valid output) — Medium — 1d
- [ ] Integration test: upload -> profile -> transform -> preview flow — Medium — 1d
- [ ] Integration test: AI chat -> suggest transforms -> apply pipeline — Medium — 1d

### Infrastructure — Phase 1B

- [ ] Create `src/lib/profiling/` directory structure — Easy — 0.25d
- [ ] Create `src/lib/transforms/` directory structure with steps/ subdirectory — Easy — 0.25d
- [ ] Create `src/components/data/` directory for profiling/transform UI — Easy — 0.25d
- [ ] Create application metadata tables: datasets, connectors, pipelines, profiles — Medium — 1d

---

## Phase 1C: ML-Ready Features (Weeks 8-10)

> Dataset splitting, advanced exports, versioning. Complete the data prep story.

### Backend — Dataset Splitting

- [ ] Implement random split strategy — Medium — 1d
- [ ] Implement stratified split (preserve label distribution across splits) — Hard — 2d
- [ ] Implement time-based split (train on past, test on future) — Medium — 1.5d
- [ ] Implement group split (prevent data leakage — same group never in both train/test) — Hard — 2d
- [ ] Implement K-fold cross validation assignment — Medium — 1.5d
- [ ] Create `POST /api/split` endpoint — Medium — 1d
  - Strategy selection, ratios, stratify/group/time column, seed
  - Returns split summary with row counts and distribution
  - Depends on: working database with transformed data
- [ ] Save split metadata (seed, strategy, counts) with exports — Easy — 0.5d

### Backend — Advanced Export

- [ ] Implement HuggingFace dataset push — Hard — 3d
  - Convert to Parquet + generate dataset card
  - Push via HuggingFace API with auth token
  - Create valid dataset with card and splits
- [ ] Implement export with split metadata — Medium — 1d
  - Separate files per split or single file with split column
  - Include transform history and profiling metadata
- [ ] Implement Arrow IPC export format — Medium — 1.5d
  - Using `apache-arrow` library
- [ ] Implement SQLite export (self-contained database file) — Easy — 0.5d

### Backend — Dataset Versioning

- [ ] Implement version tracking (each pipeline execution creates a new version) — Medium — 2d
- [ ] Implement version comparison (row count, column diff, sample diff) — Medium — 1.5d
- [ ] Implement revert to any previous version — Medium — 1.5d
- [ ] Store versions efficiently (pipeline steps, not full data copies) — Medium — 1d
- [ ] Include version metadata: who, when, what changed, why (from chat context) — Easy — 0.5d
- [ ] Create database tables: dataset_versions, exports — Easy — 0.5d

### Backend — PII Detection

- [ ] Implement PII column detection (email, phone, SSN, name patterns) — Medium — 2d
- [ ] Implement PII alert system (warn before exporting datasets with PII) — Easy — 0.5d
- [ ] Implement one-click "Remove PII columns" transform — Easy — 0.5d

### Frontend — Splitting UI

- [ ] Build `SplitConfigurator` component — Medium — 2d
  - Strategy selector, ratio inputs, column pickers
  - Preview split distribution before executing
  - Depends on: split API endpoint
- [ ] Integrate splitting into chat: "Split 80/10/10 stratified by label column" — Medium — 1d

### Frontend — Versioning UI

- [ ] Build dataset version history view — Medium — 1.5d
  - Timeline of versions with metadata
  - Compare and revert controls
- [ ] Build version comparison view (side-by-side diff) — Medium — 1.5d

### Testing — Phase 1C

- [ ] Unit tests for each split strategy (random, stratified, temporal, group, k-fold) — Medium — 2d
- [ ] Unit tests for HuggingFace push (mock API) — Medium — 1d
- [ ] Unit tests for version tracking and comparison — Medium — 1d
- [ ] Integration test: full flow upload -> profile -> transform -> split -> export — Medium — 1d
- [ ] Integration test: version creation, comparison, revert — Medium — 1d

### Infrastructure — Phase 1C

- [ ] Create `src/lib/splitting/` directory structure — Easy — 0.25d
- [ ] Docker compose setup for self-hosted deployment — Medium — 2d
- [ ] Update landing page / README for open source launch — Medium — 1.5d

---

## Phase 2A: Auth & Core Team (Weeks 8-11)

> Authentication, team management, RBAC, semantic layer. Foundation for multi-tenant BI.

### Backend — Authentication

- [ ] Integrate auth provider (Clerk or NextAuth) — Hard — 3d
  - Decision: Clerk ($25/mo, faster) vs NextAuth (free, more work)
- [ ] Implement email + password sign up/login — Medium — 1.5d
  - Depends on: auth provider integration
- [ ] Implement Google SSO — Medium — 1d
  - Depends on: auth provider integration
- [ ] Implement GitHub SSO — Medium — 1d
  - Depends on: auth provider integration
- [ ] Implement JWT token issuance with short TTL (15 min) — Medium — 1d
- [ ] Implement refresh token rotation (7-day refresh tokens) — Medium — 1d
- [ ] Implement session persistence across browser restarts — Easy — 0.5d
- [ ] Implement token invalidation on password change — Easy — 0.5d

### Backend — Team Management

- [ ] Create `POST /api/team` endpoint — Medium — 1.5d
  - Actions: create, invite, update_role, remove, list
- [ ] Implement team creation flow — Medium — 1d
- [ ] Implement email invite system — Medium — 1.5d
  - Send invite emails, accept/decline flow
- [ ] Implement role-based access control (RBAC) middleware — Hard — 2d
  - Owner, Admin, Editor, Viewer roles
  - Permission matrix enforcement at API layer
  - Depends on: auth provider, team endpoint
- [ ] Implement `withTeamContext()` wrapper for all API endpoints — Medium — 1.5d
  - Every query MUST include team_id filter
  - Depends on: RBAC middleware
- [ ] Implement team-scoped data isolation — Medium — 1.5d
  - Automated tests for cross-tenant data leak prevention
  - Depends on: withTeamContext wrapper

### Backend — Semantic Layer

- [ ] Implement semantic layer data model — Medium — 1d
  - Table descriptions, column metadata, business names, synonyms
  - Relationships between tables (one-to-one, one-to-many, many-to-many)
- [ ] Implement pre-defined calculated metrics — Medium — 1d
  - SQL expressions with descriptions and units
- [ ] Implement synonym mapping (business term -> column) — Easy — 0.5d
- [ ] Enhance NL-to-SQL generation with semantic layer context — Hard — 3d
  - Load schema context + table descriptions + column metadata
  - Use synonyms for query resolution
  - Depends on: semantic layer data model

### Backend — App Database Schema

- [ ] Create teams table — Easy — 0.25d
- [ ] Create team_members table with role column — Easy — 0.25d
- [ ] Create connectors table with team_id FK — Easy — 0.25d
- [ ] Create table_permissions table — Easy — 0.25d
  - Visibility: visible/hidden/restricted per table per connector
  - Hidden columns list, allowed roles
- [ ] Create chat_threads table (persisted conversations) — Easy — 0.25d
- [ ] Create audit_log table — Easy — 0.25d
- [ ] Create query_cache table — Easy — 0.25d
- [ ] Run database migrations — Easy — 0.5d
- [ ] Add indexes for all foreign keys and common query patterns — Easy — 0.5d

### Frontend — Auth UI

- [ ] Build `AuthGate` component (login/signup flow with SSO buttons) — Medium — 2d
  - Depends on: auth provider integration
- [ ] Build login page at `/(auth)/login` — Medium — 1d
- [ ] Build signup page at `/(auth)/signup` — Medium — 1d
- [ ] Build `TeamSwitcher` component — Medium — 1d
  - Dropdown to switch between teams

### Frontend — App Shell

- [ ] Build `Sidebar` navigation component — Medium — 1.5d
  - Chat, Dashboards, Query Library, Connections, Team, Settings
  - Collapsible on smaller screens
- [ ] Build `AppShell` layout component — Medium — 1d
  - Sidebar + main content area + top bar
- [ ] Set up route structure for all pages — Medium — 1d
  - `/chat`, `/dashboards`, `/queries`, `/connections`, `/team`, `/settings`

### Frontend — Team Management UI

- [ ] Build team management page at `/team` — Medium — 1.5d
  - Member list with roles, invite button, role change, remove
  - Depends on: team API endpoint
- [ ] Build team invite modal — Easy — 0.5d

### Frontend — Semantic Layer UI

- [ ] Build `SemanticLayerEditor` component — Medium — 2d
  - Edit table descriptions, column metadata, relationships
  - Depends on: semantic layer backend
- [ ] Build `TableDescriptionForm` component — Medium — 1.5d
  - Per-table form with column descriptions, business names, visibility

### Testing — Phase 2A

- [ ] Unit tests for RBAC middleware (all role/permission combinations) — Medium — 1.5d
- [ ] Unit tests for team-scoped data isolation — Medium — 1d
- [ ] Unit tests for semantic layer NL-to-SQL enhancement — Medium — 1.5d
- [ ] Integration test: signup -> create team -> invite -> role change flow — Medium — 1d
- [ ] Security test: verify cross-tenant data isolation with multiple teams — Hard — 1.5d

### Docs — Phase 2A

- [ ] Document auth setup for self-hosted deployments — Easy — 0.5d
- [ ] Document RBAC permission matrix — Easy — 0.5d

---

## Phase 2B: Dashboards & Visualizations (Weeks 12-15)

> Dashboard system, new chart types, saved queries, query caching.

### Backend — Dashboard CRUD

- [ ] Create dashboards table — Easy — 0.25d
- [ ] Create dashboard_widgets table — Easy — 0.25d
- [ ] Create `POST /api/dashboard` endpoint — Medium — 2d
  - Actions: create, add_widget, update_layout, add_filter, delete
  - Depends on: team context middleware (Phase 2A)
- [ ] Implement widget data fetching (execute widget queries on demand) — Medium — 1.5d
- [ ] Implement global filter application to all widgets — Medium — 1.5d
  - Date range, select, multi-select, text filters
- [ ] Implement dashboard auto-refresh (configurable interval) — Medium — 1d
- [ ] Implement "Pin from chat to dashboard" flow — Medium — 1d
  - Depends on: dashboard CRUD, chat interface

### Backend — Saved Queries

- [ ] Create saved_queries table — Easy — 0.25d
- [ ] Create query_favorites table — Easy — 0.25d
- [ ] Implement saved query CRUD API — Medium — 1.5d
  - Save, list (by category, search), run, favorite, delete
- [ ] Implement query parameterization — Medium — 2d
  - Define parameters: name, type, label, default value, options
  - Parameter substitution at query time
- [ ] Implement query usage tracking (count, last run) — Easy — 0.5d
- [ ] Surface most-used queries as suggestions in chat input — Easy — 0.5d

### Backend — Query Caching

- [ ] Implement in-memory LRU cache (100MB max) — Medium — 1.5d
  - Cache key: hash(sql + params + connectorId)
- [ ] Implement cache TTL policy — Medium — 1d
  - Aggregate queries: 5 min, dashboard widgets: configurable, detail queries: 1 min, schema: 30 min
- [ ] Implement stale-while-revalidate pattern — Medium — 1d
  - Return stale data + trigger background refresh
- [ ] Implement manual cache invalidation (per query, globally) — Easy — 0.5d
- [ ] Add X-Cache header (HIT/MISS) to responses — Easy — 0.25d
- [ ] Optional Redis cache for cloud deployment — Medium — 2d

### Backend — Visualization Auto-Selection

- [ ] Implement chart type auto-selection logic — Medium — 2d
  - 1 row, 1 col -> KPI card
  - 1 row, N cols -> KPI grid
  - Date + numeric -> line chart
  - Category + numeric (<=8) -> bar chart
  - Category + numeric (9-15) -> horizontal bar
  - Category + numeric (>15) -> data table
  - All numeric -> scatter plot
- [ ] Allow user override of auto-selected chart type — Easy — 0.5d

### Frontend — Dashboard UI

- [ ] Build `DashboardGrid` component (12-column responsive grid) — Hard — 3d
  - Using `react-grid-layout`
  - Drag and resize widgets
  - Responsive: 12-col desktop, 6-col tablet, single-col mobile
- [ ] Build `WidgetRenderer` component — Medium — 2d
  - Renders any widget type based on `widget_type` field
  - Handles loading states, error states, cached data indicator
- [ ] Build `GlobalFilterBar` component — Medium — 1.5d
  - Date range picker, select dropdowns, multi-select
  - Linked to specific widgets
- [ ] Build dashboard list page at `/dashboards` — Medium — 1d
- [ ] Build dashboard view page at `/dashboards/:id` — Medium — 1.5d
- [ ] Build dashboard edit mode at `/dashboards/:id/edit` — Medium — 2d
  - Drag/resize, add/remove widgets, edit widget config
- [ ] Build `DashboardToolbar` component — Easy — 0.5d
  - Refresh, share, schedule, edit mode toggle

### Frontend — New Chart Types

- [ ] Build `KPICard` component — Medium — 1.5d
  - Big number + label + trend arrow (green/red) + optional sparkline
  - Variants: standard, compact, detailed with goal progress
- [ ] Build `AreaChart` component — Easy — 0.5d
  - Filled line chart for cumulative trends
- [ ] Build `HorizontalBar` component — Easy — 0.5d
  - For ranked lists with many categories
- [ ] Build `StackedBar` component — Medium — 1d
  - Category breakdown over time
- [ ] Build `DonutChart` component — Easy — 0.5d
  - Proportions with center label, tap for labels on mobile
- [ ] Build enhanced `DataTable` component — Medium — 1.5d
  - Sortable, filterable, paginated
  - Multiple view modes on mobile (card/list/table)
- [ ] Build `MultiLine` chart component — Medium — 1d
  - Compare multiple metrics on same axes
- [ ] Build `WidgetConfigPanel` component — Medium — 1.5d
  - Chart type selector, axis configuration, color settings, legend toggle

### Frontend — Saved Queries UI

- [ ] Build query library page at `/queries` — Medium — 1.5d
  - Browse by category, search, sort by usage/date
- [ ] Build `QueryParameterForm` component — Medium — 1d
  - Dynamic inputs based on parameter definitions
- [ ] One-click save from chat to saved queries — Easy — 0.5d
- [ ] Add saved queries to dashboards directly — Easy — 0.5d

### Testing — Phase 2B

- [ ] Unit tests for dashboard CRUD API — Medium — 1d
- [ ] Unit tests for query caching (TTL, LRU eviction, invalidation) — Medium — 1d
- [ ] Unit tests for chart auto-selection logic — Medium — 1d
- [ ] Unit tests for query parameterization — Medium — 0.5d
- [ ] Visual regression tests for all chart types — Medium — 1.5d
- [ ] Integration test: create dashboard -> add widgets -> auto-refresh -> filter — Medium — 1d
- [ ] Performance test: dashboard with 10 widgets loads < 8s fresh, < 2s cached — Medium — 1d

### Infrastructure — Phase 2B

- [ ] Add dependencies: `react-grid-layout`, `@nivo/core`, `@nivo/heatmap` — Easy — 0.25d
- [ ] Create `src/components/dashboard/` directory with widget-types subdirectory — Easy — 0.25d
- [ ] Create `src/lib/cache/` directory — Easy — 0.25d
- [ ] Create `src/lib/dashboard/` directory — Easy — 0.25d

---

## Phase 2C: Sharing & Scheduling (Weeks 16-19)

> Public links, embeds, scheduled reports, Slack bot, audit logging.

### Backend — Sharing System

- [ ] Create shares table — Easy — 0.25d
- [ ] Create `POST /api/share` endpoint — Medium — 1.5d
  - Create share link, configure access type, set expiration
- [ ] Implement public link generation with unique slugs — Easy — 0.5d
- [ ] Implement password-protected shares — Medium — 1d
  - Password hashing, verification without requiring signup
- [ ] Implement team-only shares (require team login) — Easy — 0.5d
- [ ] Implement email allowlist shares — Easy — 0.5d
- [ ] Implement link revocation and expiration (time-limited, view-limited) — Medium — 1d
- [ ] Create `GET /api/public/:type/:id` endpoint — Medium — 1.5d
  - Render public dashboard/query result
  - View-only: no chat, no export, no SQL visible
- [ ] Implement embed endpoint for iframes — Medium — 1.5d
  - Minimal frame, auto-resize, parameter support

### Backend — Scheduling System

- [ ] Create schedules table and schedule_runs table — Easy — 0.5d
- [ ] Implement cron scheduler using BullMQ — Hard — 3d
  - Job queue, scheduled execution, retry with exponential backoff (3 retries)
  - Depends on: Redis (or in-memory for dev)
- [ ] Create `POST /api/schedule` endpoint — Medium — 1.5d
  - Create, update, pause/resume, delete schedules
- [ ] Implement chart-to-image renderer — Hard — 3d
  - Server-side chart rendering via Puppeteer or Satori + Sharp
  - Generate PNG images of charts for email/Slack
- [ ] Implement email report delivery (HTML email with chart images) — Medium — 2d
  - Using `nodemailer`
  - HTML template with KPI summary + embedded chart images + deep link
- [ ] Implement threshold alerts — Medium — 2d
  - Conditions: gt, lt, eq, change_pct
  - Evaluate on schedule, fire when threshold crossed
- [ ] Implement webhook delivery channel — Easy — 1d
  - JSON payload to configured URL
- [ ] Log all delivery results (success, failed, partial) — Easy — 0.5d

### Backend — Slack Bot

- [ ] Implement Slack OAuth flow — Medium — 1.5d
  - Depends on: auth system (Phase 2A)
- [ ] Implement Slack event handler for @mentions — Medium — 2d
  - Parse natural language, execute query, return result
  - Depends on: NL-to-SQL engine
- [ ] Implement Slack slash commands (`/dataforge dashboard <name>`) — Medium — 1.5d
- [ ] Implement chart image rendering for Slack messages — Medium — 1.5d
  - Depends on: chart-to-image renderer
- [ ] Implement follow-up context (5-message window per channel) — Medium — 1d
- [ ] Implement DM support for private queries — Easy — 0.5d

### Backend — Audit Logging (Enhanced)

- [ ] Log all query executions: who, what SQL, which tables, when, IP, row count — Medium — 1d
  - Depends on: audit_log table (Phase 2A)
- [ ] Log all dashboard operations (create, edit, share, delete) — Easy — 0.5d
- [ ] Log all team management operations (invite, role change, remove) — Easy — 0.5d
- [ ] Implement audit log API (read-only, team-scoped) — Easy — 0.5d
- [ ] Implement audit log retention policy (90 days default, configurable) — Easy — 0.5d

### Frontend — Sharing UI

- [ ] Build `ShareDialog` component — Medium — 1.5d
  - Access type selection (public, password, team, allowlist)
  - Expiration settings, copy link button
- [ ] Build `EmbedCodePanel` component — Easy — 0.5d
  - Generated iframe code with copy button
- [ ] Build `PublicDashboardView` component — Medium — 2d
  - Read-only dashboard renderer, no chat, no SQL, no edit controls
  - Depends on: public API endpoint
- [ ] Build public dashboard page at `/public/d/:slug` — Medium — 1d
- [ ] Build public query page at `/public/q/:slug` — Medium — 1d
- [ ] Build embedded widget page at `/embed/w/:id` — Medium — 1d
- [ ] Build embedded dashboard page at `/embed/d/:id` — Medium — 1d

### Frontend — Scheduling UI

- [ ] Build `ScheduleForm` component — Medium — 2d
  - Type (report/alert), source (dashboard/query), cron expression builder
  - Channel configuration (email recipients, Slack webhook, webhook URL)
  - Alert threshold configuration
- [ ] Build `ScheduleList` component — Medium — 1d
  - Active schedules with status, last run, next run
  - Pause/resume toggle
- [ ] Build Slack auth flow UI (`SlackAuthFlow` component) — Medium — 1d

### Frontend — Polish

- [ ] Build onboarding flow for first-time users — Medium — 2d
  - Step-by-step: create team -> add connection -> ask first question -> save to dashboard
- [ ] Build settings page at `/settings` — Medium — 1d
  - Notification preferences, billing (placeholder), audit log viewer

### Testing — Phase 2C

- [ ] Unit tests for sharing system (all access types, expiration, revocation) — Medium — 1d
- [ ] Unit tests for scheduling system (cron parsing, retry logic) — Medium — 1d
- [ ] Unit tests for Slack bot (message parsing, context tracking) — Medium — 1d
- [ ] Integration test: share dashboard -> access via public link -> verify view-only — Medium — 1d
- [ ] Integration test: create schedule -> cron fires -> email/Slack delivered — Medium — 1d
- [ ] Security test: public links don't expose SQL or raw data — Medium — 0.5d
- [ ] Performance test: email report generation < 30s for full dashboard — Medium — 0.5d

### Infrastructure — Phase 2C

- [ ] Add dependencies: `@clerk/nextjs`, `redis`, `bullmq`, `node-cron`, `nodemailer`, `@slack/web-api`, `@slack/bolt`, `puppeteer-core`, `satori`, `sharp` — Easy — 0.5d
- [ ] Docker compose update with Redis service — Easy — 0.5d
- [ ] Create `src/lib/scheduling/`, `src/lib/sharing/`, `src/lib/slack/` directories — Easy — 0.25d
- [ ] Landing page + documentation site — Medium — 2d

---

## Mobile M1: PWA Foundation (Weeks 1-2, parallel with Phase 1A)

> Responsive design, PWA setup, core mobile components.

### Frontend — PWA Setup

- [ ] Create PWA manifest (`public/manifest.json`) with app metadata — Easy — 0.5d
- [ ] Generate app icons for all required sizes (72 to 512px) — Easy — 0.5d
- [ ] Set up service worker with Workbox/next-pwa — Medium — 1.5d
  - Cache-first for app shell, stale-while-revalidate for dashboard data
  - Network-only for chat/query execution
- [ ] Implement PWA install prompt handler — Easy — 0.5d

### Frontend — Responsive Layout

- [ ] Implement breakpoint strategy with Tailwind — Medium — 1.5d
  - xs (0-639), sm (640-767), md (768-1023), lg (1024-1279), xl (1280+)
- [ ] Build `ResponsiveLayout` component — Medium — 1.5d
  - Desktop: sidebar + main, Tablet: collapsible sidebar + main, Phone: top bar + main + bottom nav
- [ ] Build `BottomNav` component (5 tabs: Chat, Dashboards, Queries, Alerts, More) — Medium — 1d
- [ ] Build `MobileHeader` component (title + action buttons) — Easy — 0.5d
- [ ] Implement mobile-specific CSS design tokens — Easy — 0.5d
  - Touch targets (44px min), spacing, typography, chart heights
- [ ] Add `mobile.css` with mobile-specific overrides — Easy — 0.5d

### Frontend — Mobile Components

- [ ] Build `MobileChart` wrapper component — Medium — 1.5d
  - Touch-friendly: tap for tooltip, pinch to zoom, pan to scroll
  - Fullscreen expand option
  - Compact height (220px vs 400px desktop)
- [ ] Build `KPICarousel` component — Medium — 1.5d
  - Horizontal scroll with snap-to-card, scroll indicators (dots)
  - Auto-scroll option
- [ ] Build `MobileDataTable` component — Medium — 1.5d
  - Card view (default on phone), list view, table view (landscape/tablet)
  - Fixed first column on horizontal scroll
  - Infinite scroll, search, sort
- [ ] Build `PullToRefresh` wrapper component — Medium — 1d
  - Configurable threshold, haptic feedback, success message
- [ ] Build `BottomSheet` component — Medium — 1.5d
  - Drag handle, three states (collapsed, half, full)
  - Replaces modals on mobile
- [ ] Build `OfflineBanner` component — Easy — 0.5d
  - "You're offline" indicator with stale data badge
- [ ] Build `SafeAreaView` wrapper component — Easy — 0.5d
  - Respect safe area insets on notched devices

### Frontend — Mobile Hooks

- [ ] Implement `usePlatform()` hook — Medium — 1d
  - Detect web/ios/android, isMobile, isTablet, isDesktop, isPWA, isOnline
- [ ] Implement `useOnlineStatus()` hook — Easy — 0.25d
- [ ] Implement `useViewport()` hook — Easy — 0.25d
- [ ] Implement `useSafeArea()` hook — Easy — 0.25d

### Testing — Mobile M1

- [ ] Visual tests for responsive layouts at all breakpoints — Medium — 1d
- [ ] Test PWA install flow on Chrome, Safari, Firefox — Medium — 0.5d
- [ ] Test offline mode (cached dashboards, offline banner, disabled features) — Medium — 0.5d

---

## Mobile M2: Capacitor Wrapper (Weeks 3-4)

> Native shell for iOS/Android, push notifications, biometrics, voice input.
> Depends on: Phase M1 complete, Phase 2A (auth) for biometrics/push.

### Infrastructure — Capacitor Setup

- [ ] Initialize Capacitor project (`capacitor.config.ts`) — Medium — 1d
- [ ] Configure iOS shell (WKWebView, safe area, status bar) — Medium — 1d
- [ ] Configure Android shell (WebView, HTTPS-only, status bar) — Medium — 1d
- [ ] Set up Capacitor build pipeline (Next.js build -> static export -> cap copy) — Medium — 1d
- [ ] Add Capacitor dependencies: `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, plugins — Easy — 0.5d

### Frontend — Native Features

- [ ] Implement push notification setup (APNs for iOS, FCM for Android) — Hard — 2.5d
  - Token registration, permission request, token storage on server
  - Depends on: auth system (Phase 2A), scheduling system (Phase 2C) for alerts
- [ ] Implement deep link handling (universal links) — Medium — 1.5d
  - Open specific dashboard/query from notification tap
- [ ] Implement biometric auth (Face ID / Touch ID / Fingerprint) — Medium — 1.5d
  - Quick re-authentication, fallback to password
  - Depends on: auth system (Phase 2A)
- [ ] Implement haptic feedback integration — Easy — 0.5d
  - Tap feedback, pull-to-refresh vibration
- [ ] Build `VoiceInput` component (speech-to-text) — Medium — 2d
  - Web Speech API on web, Capacitor Speech plugin on native
  - Transcription -> text in chat input -> user confirms -> send
- [ ] Implement OS share sheet integration — Easy — 1d
  - Share query results, chart images, dashboard links via native share sheet
- [ ] Implement keyboard avoidance helpers — Easy — 0.5d
  - Resize body on keyboard open, scroll to focused input
- [ ] Implement safe area handling for Capacitor — Easy — 0.5d
- [ ] Implement offline detection with Capacitor Network plugin — Easy — 0.5d

### Backend — Push Notification Server

- [ ] Implement push token storage (per user, per device) — Medium — 1d
- [ ] Implement notification service (send to APNs / FCM / Web Push) — Hard — 2d
- [ ] Implement notification queue (BullMQ) with batching (max 5/hour) — Medium — 1d
- [ ] Implement notification preferences API (per category: alerts, reports, team, exports) — Medium — 1d
- [ ] Implement quiet hours support — Easy — 0.5d
- [ ] Implement push token cleanup on app uninstall — Easy — 0.5d

### Testing — Mobile M2

- [ ] Test push notifications on iOS simulator and Android emulator — Medium — 1d
- [ ] Test deep link opening from notification — Medium — 0.5d
- [ ] Test biometric auth flow (success + fallback) — Medium — 0.5d
- [ ] Test voice input on both platforms — Medium — 0.5d

---

## Mobile M3: App Store Submission (Week 5)

> Depends on: Phase M2 complete, Phase 2B (dashboards) for meaningful app content.

### Design Assets

- [ ] Generate app icons for all required sizes (iOS + Android) — Easy — 0.5d
- [ ] Create splash screen images for all device sizes — Easy — 0.5d
- [ ] Create App Store screenshots (6 screens per platform) — Medium — 2d
  - Chat interface, dashboard, chart detail, voice input, push notification, offline mode

### App Store Preparation

- [ ] Write App Store listing (name, subtitle, description, keywords) — Easy — 0.5d
- [ ] Write Play Store listing (short/long description, feature graphic) — Easy — 0.5d
- [ ] Prepare privacy policy page — Easy — 0.5d
- [ ] Prepare terms of service page — Easy — 0.5d

### Build & Submit

- [ ] Create iOS TestFlight build — Medium — 1d
- [ ] Create Android internal test build — Medium — 1d
- [ ] Internal testing round (5 testers minimum) — Medium — 1d
- [ ] Submit to Apple App Store — Easy — 0.5d
  - Includes native features to avoid web-wrapper rejection: push, biometrics, haptics, voice, share sheet, offline
- [ ] Submit to Google Play Store — Easy — 0.5d

---

## Mobile M4: Native Enhancements (Ongoing)

> Post-launch native features. Depends on: M3 complete, Phase 2C (scheduling) for widget data.

### iOS Native Features

- [ ] Implement iOS home screen widgets (SwiftUI) — Hard — 5d
  - Small (2x2): single KPI
  - Medium (4x2): KPI + sparkline
  - Large (4x4): mini dashboard (3 KPIs + chart)
  - Widget configuration: select dashboard, select metrics, refresh interval
- [ ] Implement Apple Watch complication (KPI display) — Hard — 5d
- [ ] Implement Siri shortcut ("Ask DataForge...") — Medium — 2d

### Android Native Features

- [ ] Implement Android home screen widgets (Kotlin) — Hard — 5d
  - 1x1: single metric, 2x1: metric + trend, 4x2: mini dashboard
  - Widget configuration matching iOS

### Shared Native Features

- [ ] Implement background refresh for widgets — Medium — 2d
  - Periodic data fetch even when app is closed
- [ ] Implement camera OCR for spreadsheet scanning — Hard — 4d
  - Take photo of printed spreadsheet -> OCR -> parse -> upload as table
  - Phase 3 feature, uses native camera API
- [ ] Swipe gesture enhancements — Easy — 1d
  - Swipe left/right between dashboard widgets
  - Long press for data point details
  - Double tap KPI to expand

---

## Critical Path

> Tasks that block other tasks. These must be prioritized and completed on time.

```
Phase 0: Security Hardening
  |
  +-- CSP headers, CSRF, SSRF protection (blocks all API development)
  +-- Pyodide/WASM sandbox (blocks Python transforms in Phase 1B)
  |
  v
Phase 1A: Foundation
  |
  +-- DatabaseConnector interface (blocks ALL connectors: MySQL, MongoDB, BigQuery)
  |     +-- ConnectionManager (blocks connector API endpoint)
  |           +-- Connector API endpoint (blocks connector UI)
  |
  +-- File parser + type inference (blocks upload API)
  |     +-- Upload API (blocks upload UI, profiling, everything downstream)
  |
  +-- Export engine (blocks export UI, advanced exports in 1C)
  |
  v
Phase 1B: Data Prep Core
  |
  +-- Profiling engine (blocks profile API, profile UI, AI suggest transforms)
  +-- Transform pipeline executor (blocks transform API, transform UI)
  +-- AI tool registry extension (blocks AI-driven data prep)
  |
  v
Phase 1C: ML-Ready Features
  |
  +-- Split engine (blocks split API, split UI)
  +-- HuggingFace push (blocks advanced export)
  |
  v
Phase 2A: Auth & Team (can START parallel with 1C)
  |
  +-- Auth provider integration (blocks ALL of Phase 2A-2C)
  |     +-- RBAC middleware (blocks team-scoped endpoints)
  |           +-- withTeamContext wrapper (blocks dashboard, sharing, scheduling APIs)
  |
  +-- Semantic layer (blocks enhanced NL-to-SQL accuracy)
  +-- App database schema + migrations (blocks all team BI features)
  |
  v
Phase 2B: Dashboards & Viz
  |
  +-- Dashboard CRUD API (blocks dashboard UI, sharing, scheduling)
  +-- Query caching (blocks dashboard performance)
  +-- react-grid-layout DashboardGrid (blocks dashboard edit mode)
  +-- KPICard component (blocks dashboard display, mobile KPI carousel)
  |
  v
Phase 2C: Sharing & Scheduling
  |
  +-- BullMQ scheduler (blocks all scheduled reports and alerts)
  +-- Chart-to-image renderer (blocks email reports, Slack bot images)
  +-- Public link API (blocks public dashboard page, embed system)
  +-- Slack bot (independent, but blocks Slack delivery channel)
  |
  v
Mobile M1: PWA Foundation (can START parallel with Phase 1A)
  |
  +-- Service worker (blocks offline support)
  +-- ResponsiveLayout (blocks all mobile UI)
  +-- BottomNav (blocks mobile navigation)
  |
  v
Mobile M2: Capacitor Wrapper (depends on M1 + Phase 2A for auth)
  |
  +-- Capacitor project setup (blocks all native features)
  +-- Push notification setup (depends on Phase 2A auth + Phase 2C scheduling)
  +-- Biometric auth (depends on Phase 2A auth)
  |
  v
Mobile M3: App Store (depends on M2 + Phase 2B for dashboards)
  |
  +-- TestFlight/internal builds (blocks store submission)
  +-- App Store screenshots (blocks store listing)
  |
  v
Mobile M4: Native Enhancements (depends on M3 + Phase 2C for widget data)
  +-- Home screen widgets require native SwiftUI/Kotlin (no web shortcut)
  +-- Background refresh requires push token infrastructure
```

### Key Parallelization Opportunities

1. **Mobile M1 can run parallel with Phase 1A** — responsive components + PWA setup have no backend dependencies
2. **Phase 1C and Phase 2A can overlap** — auth/team work is independent of splitting/versioning
3. **Frontend and backend work within each phase** can be parallelized across developers
4. **Testing can begin as soon as each feature module is complete** — don't wait for full phase completion

### Highest-Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| NL-to-SQL accuracy for non-technical users | AI generates wrong SQL | Semantic layer + feedback loop + saved queries as fallback |
| Multi-tenancy data isolation | Cross-tenant data leak | withTeamContext on EVERY endpoint + automated security tests |
| Python sandbox escape | Arbitrary code execution | Pyodide/WASM with no network + memory/CPU limits |
| App Store rejection (web wrapper) | iOS app rejected by Apple | Include native features: push, biometrics, haptics, voice, widgets |
| Performance at scale (>100MB datasets) | Slow profiling/transforms | Streaming + sampling + DuckDB consideration |

---

*End of Master TODO*
