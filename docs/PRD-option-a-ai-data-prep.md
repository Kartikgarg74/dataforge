# PRD: Option A — AI Data Prep for ML Engineers

> **Product Name:** DataForge (working title)
> **Tagline:** "From raw database to ML-ready dataset in minutes, not days."
> **Version:** 1.0
> **Date:** 2026-03-19
> **Author:** Kartik Garg

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Users](#2-target-users)
3. [Product Vision](#3-product-vision)
4. [System Architecture](#4-system-architecture)
5. [Feature Breakdown](#5-feature-breakdown)
6. [User Flows](#6-user-flows)
7. [Data Pipeline Architecture](#7-data-pipeline-architecture)
8. [API Design](#8-api-design)
9. [UI/UX Specifications](#9-uiux-specifications)
10. [Technical Requirements](#10-technical-requirements)
11. [Database Schema](#11-database-schema)
12. [Security & Privacy](#12-security--privacy)
13. [Performance Requirements](#13-performance-requirements)
14. [Success Metrics](#14-success-metrics)
15. [Milestones & Phasing](#15-milestones--phasing)
16. [Open Questions & Risks](#16-open-questions--risks)

---

## 1. Problem Statement

ML engineers spend **60-80% of their time** on data preparation — not model building. The current workflow is fragmented:

1. Connect to a database using a CLI or GUI client (DBeaver, pgAdmin)
2. Write exploratory SQL to understand the data
3. Export to CSV
4. Open in Jupyter/Pandas for cleaning
5. Write Python scripts for transformations
6. Profile data quality manually
7. Split into train/test/validation sets
8. Export to a format the training pipeline accepts
9. Repeat steps 2-8 every time the source data changes

**There is no single tool that handles the full path from "raw database" → "clean, profiled, split, exported ML-ready dataset."**

### What Exists Today (and why it's not enough)

| Tool | Gap |
|------|-----|
| **Jupyter + Pandas** | Manual, no DB integration, no profiling UI, notebook hell |
| **Metabase / Hex** | Built for BI analysts, not ML. No export to Parquet/HF, no splitting |
| **Great Expectations** | Validation only — doesn't help you clean or transform |
| **dbt** | SQL transforms only, no profiling, no export, steep learning curve |
| **Cleanlab** | Focused on label quality, not general data prep |
| **AWS Glue / Dataprep** | Enterprise, expensive, overkill for most teams |

---

## 2. Target Users

### Primary: ML Engineers & Data Scientists

- **Profile:** 1-10 years experience, Python-fluent, SQL-comfortable
- **Team size:** Solo to 5-person ML teams
- **Pain:** Spend more time on data than models
- **Current tools:** Jupyter, Pandas, SQLAlchemy, DBeaver
- **Willingness to pay:** $29-99/mo for a tool that saves 10+ hours/week

### Secondary: Analytics Engineers

- **Profile:** SQL-first, some Python, work at data-forward startups
- **Pain:** Need to hand off clean datasets to ML team
- **Current tools:** dbt, Metabase, Looker

### Anti-Personas (NOT building for)

- Enterprise BI teams (they have Tableau/Power BI)
- No-code business users (they need Metabase)
- Data engineers building production pipelines (they need Airflow/Dagster)

---

## 3. Product Vision

### High-Level Architecture

```mermaid
graph TB
    subgraph Input["📥 Data Input Layer"]
        A1[File Upload<br/>CSV, JSON, Parquet, SQLite]
        A2[Database Connectors<br/>Postgres, MySQL, MongoDB, BigQuery]
        A3[API Connectors<br/>Airtable, Notion, REST APIs]
    end

    subgraph Core["⚙️ Core Engine"]
        B1[Schema Discovery<br/>& Auto-Profiling]
        B2[AI Chat Interface<br/>Natural Language → SQL/Python]
        B3[Data Transformation<br/>Pipeline Builder]
        B4[Data Quality<br/>Profiling Engine]
    end

    subgraph Output["📤 Output Layer"]
        C1[Export Formats<br/>CSV, Parquet, JSON, JSONL]
        C2[ML Platform Integration<br/>HuggingFace, W&B, S3]
        C3[Dataset Versioning<br/>& Snapshots]
        C4[Train/Test/Val<br/>Split Engine]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    B1 --> B2
    B1 --> B4
    B2 --> B3
    B4 --> B3
    B3 --> C1
    B3 --> C2
    B3 --> C4
    C4 --> C1
    C4 --> C2
    C4 --> C3
```

### Core Value Proposition

**"Connect. Explore. Clean. Export."** — Four steps to go from raw data to ML-ready dataset.

---

## 4. System Architecture

### Full Technical Architecture

```mermaid
graph TB
    subgraph Client["Browser Client"]
        UI[Next.js 15 + React 19]
        ZS[Zustand Stores]
        DND[DnD Kit Canvas]
    end

    subgraph API["API Layer - Next.js App Router"]
        Chat["/api/chat<br/>AI Orchestration"]
        Query["/api/query<br/>SQL Execution"]
        Schema["/api/schema<br/>Discovery"]
        Upload["/api/upload<br/>File Ingestion"]
        Profile["/api/profile<br/>Data Profiling"]
        Transform["/api/transform<br/>Pipeline Execution"]
        Export["/api/export<br/>Dataset Export"]
        Split["/api/split<br/>Train/Test Split"]
        Connector["/api/connector<br/>DB Management"]
    end

    subgraph Security["Security Layer"]
        Guard[API Guard<br/>Auth + Rate Limit]
        SQLSafe[SQL Safety<br/>Read-Only Enforcement]
        Sandbox[Python Sandbox<br/>Bounded Execution]
    end

    subgraph Data["Data Layer"]
        SQLite[SQLite<br/>Local/Uploaded DBs]
        Postgres[Postgres/Neon<br/>Cloud Databases]
        MySQL[MySQL<br/>External]
        Mongo[MongoDB<br/>External]
        BQ[BigQuery<br/>External]
        FileStore[File Store<br/>Uploaded Files]
    end

    subgraph Processing["Processing Engine"]
        Profiler[Data Profiler<br/>Statistics Engine]
        PyRunner[Python Runner<br/>Transform Execution]
        Splitter[Dataset Splitter<br/>Stratified/Random]
        Exporter[Export Engine<br/>Format Conversion]
    end

    UI --> Chat
    UI --> Query
    UI --> Upload
    UI --> Profile
    UI --> Export

    Chat --> Guard
    Query --> Guard
    Upload --> Guard

    Guard --> SQLSafe
    SQLSafe --> SQLite
    SQLSafe --> Postgres
    SQLSafe --> MySQL

    Chat --> PyRunner
    Transform --> PyRunner
    Transform --> Sandbox

    Profile --> Profiler
    Split --> Splitter
    Export --> Exporter

    Profiler --> SQLite
    Profiler --> Postgres
```

### Component Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as API Layer
    participant AI as AI Engine
    participant DB as Database
    participant P as Profiler
    participant E as Exporter

    U->>UI: Upload CSV file
    UI->>API: POST /api/upload
    API->>DB: Ingest into SQLite table
    API->>P: Auto-profile columns
    P-->>API: Profile results
    API-->>UI: Schema + Profile summary

    U->>UI: "Show me nulls in age column"
    UI->>API: POST /api/chat
    API->>AI: Plan tool calls
    AI->>DB: SELECT age, COUNT(*) ... GROUP BY (age IS NULL)
    DB-->>AI: Results
    AI-->>UI: Stream response + chart component

    U->>UI: "Fill nulls with median, drop duplicates"
    UI->>API: POST /api/transform
    API->>DB: Execute transform pipeline
    DB-->>API: Transformed dataset
    API-->>UI: Preview + row count delta

    U->>UI: "Split 80/10/10 stratified by label"
    UI->>API: POST /api/split
    API->>DB: Stratified split logic
    API-->>UI: Split summary (rows per set)

    U->>UI: Export as Parquet
    UI->>API: POST /api/export
    API->>E: Convert + package
    E-->>U: Download file
```

---

## 5. Feature Breakdown

### F1: File Upload & Ingestion

**Priority:** P0 (Must Have)
**Effort:** Medium

| Requirement | Details |
|---|---|
| Supported formats | CSV, TSV, JSON, JSONL, Parquet, SQLite, Excel (.xlsx) |
| Max file size | 500MB (local), 100MB (cloud) |
| Auto-detection | Delimiter, encoding, header row, data types |
| Preview | Show first 100 rows before full ingestion |
| Storage | Ingest into SQLite table (local) or temp Postgres schema |
| Naming | User can name the table, or auto-generate from filename |
| Multiple files | Support uploading multiple files as separate tables |
| Drag & drop | Drag files onto the chat area or dedicated upload zone |

**Ingestion Pipeline:**

```mermaid
flowchart LR
    A[File Dropped] --> B{Detect Format}
    B -->|CSV/TSV| C[Parse with headers<br/>Detect delimiter]
    B -->|JSON/JSONL| D[Parse structure<br/>Flatten nested]
    B -->|Parquet| E[Read schema<br/>from metadata]
    B -->|SQLite| F[Mount as<br/>read-only DB]
    B -->|Excel| G[Parse sheets<br/>as separate tables]

    C --> H[Infer Column Types]
    D --> H
    E --> H
    F --> I[Schema Discovery]
    G --> H

    H --> J[Create Table<br/>in Working DB]
    I --> J

    J --> K[Auto-Profile]
    K --> L[Show Preview<br/>+ Profile Card]
```

**Acceptance Criteria:**
- [ ] User can drag-drop a CSV and see it as a queryable table within 5 seconds
- [ ] Type inference is correct for >90% of columns (int, float, string, date, boolean)
- [ ] User sees row count, column count, and inferred types immediately after upload
- [ ] Duplicate uploads create versioned tables (e.g., `sales_v1`, `sales_v2`)
- [ ] Error messages are clear when file is malformed or too large

---

### F2: Multi-Database Connectors

**Priority:** P0 (Must Have)
**Effort:** High

#### Connector Matrix

| Database | Protocol | Library | Status |
|---|---|---|---|
| PostgreSQL | TCP/SSL | `pg` / `@neondatabase/serverless` | ✅ Exists |
| MySQL | TCP/SSL | `mysql2` | 🔲 New |
| SQLite | File | `better-sqlite3` | ✅ Exists |
| MongoDB | TCP/SSL | `mongodb` | 🔲 New |
| BigQuery | REST API | `@google-cloud/bigquery` | 🔲 New |
| Supabase | REST/TCP | `@supabase/supabase-js` | 🔲 New |
| ClickHouse | HTTP/TCP | `@clickhouse/client` | 🔲 Phase 2 |
| DuckDB | File/WASM | `duckdb` | 🔲 Phase 2 |

#### Connector Architecture

```mermaid
classDiagram
    class DatabaseConnector {
        <<interface>>
        +connect(config: ConnectionConfig): Promise~Connection~
        +disconnect(): Promise~void~
        +executeQuery(sql: string): Promise~QueryResult~
        +getSchema(): Promise~SchemaInfo~
        +getTables(): Promise~TableInfo[]~
        +getColumns(table: string): Promise~ColumnInfo[]~
        +getRowCount(table: string): Promise~number~
        +testConnection(): Promise~boolean~
    }

    class PostgresConnector {
        -pool: Pool
        +connect()
        +executeQuery()
        +getSchema()
    }

    class MySQLConnector {
        -pool: Pool
        +connect()
        +executeQuery()
        +getSchema()
    }

    class MongoConnector {
        -client: MongoClient
        +connect()
        +executeQuery()
        +getSchema()
    }

    class BigQueryConnector {
        -client: BigQuery
        +connect()
        +executeQuery()
        +getSchema()
    }

    class SQLiteConnector {
        -db: Database
        +connect()
        +executeQuery()
        +getSchema()
    }

    class ConnectionManager {
        -connectors: Map~string, DatabaseConnector~
        +addConnection(id, config): void
        +removeConnection(id): void
        +getConnector(id): DatabaseConnector
        +listConnections(): ConnectionInfo[]
        +testAll(): HealthReport
    }

    DatabaseConnector <|-- PostgresConnector
    DatabaseConnector <|-- MySQLConnector
    DatabaseConnector <|-- MongoConnector
    DatabaseConnector <|-- BigQueryConnector
    DatabaseConnector <|-- SQLiteConnector
    ConnectionManager --> DatabaseConnector
```

**Acceptance Criteria:**
- [ ] User can add a Postgres/MySQL connection via UI form (host, port, db, user, password)
- [ ] Connection test button validates before saving
- [ ] Saved connections persist across sessions (encrypted at rest)
- [ ] Schema discovery works uniformly across all connector types
- [ ] MongoDB collections are presented as "tables" with inferred schema
- [ ] BigQuery datasets/tables are browsable

---

### F3: Data Profiling Engine

**Priority:** P0 (Must Have)
**Effort:** Medium-High

#### Profile Report Structure

For each column in a dataset, generate:

| Metric | Applies To | Description |
|---|---|---|
| **Type** | All | Inferred type (int, float, string, date, bool, json) |
| **Null count / %** | All | Number and percentage of null/missing values |
| **Unique count / %** | All | Cardinality |
| **Most frequent values** | All | Top 10 values with counts |
| **Min / Max** | Numeric, Date | Range |
| **Mean / Median / Std** | Numeric | Central tendency and spread |
| **Percentiles** | Numeric | P25, P50, P75, P95, P99 |
| **Histogram** | Numeric | 20-bucket distribution |
| **String length stats** | String | Min/max/avg length |
| **Pattern detection** | String | Email, phone, URL, UUID patterns |
| **Date range** | Date | Earliest, latest, gaps |
| **Outlier detection** | Numeric | IQR-based outlier count |
| **Correlation matrix** | Numeric pairs | Pearson correlation between all numeric columns |

#### Profile UI Components

```mermaid
graph TB
    subgraph ProfileDashboard["Data Profile Dashboard"]
        subgraph Summary["Dataset Summary Bar"]
            S1[Total Rows]
            S2[Total Columns]
            S3[Memory Size]
            S4[Duplicate Rows]
            S5[Overall Completeness %]
        end

        subgraph ColumnCards["Column Profile Cards"]
            C1["Column: age<br/>Type: int<br/>Nulls: 12 (3.2%)<br/>Range: 18-92<br/>📊 Histogram"]
            C2["Column: email<br/>Type: string<br/>Nulls: 0<br/>Unique: 98.7%<br/>Pattern: email"]
            C3["Column: created_at<br/>Type: date<br/>Nulls: 5 (1.3%)<br/>Range: 2020-01 to 2025-12<br/>📊 Timeline"]
        end

        subgraph Alerts["Data Quality Alerts"]
            A1["⚠️ 'phone' has 45% nulls"]
            A2["⚠️ 'age' has 3 outliers > 3σ"]
            A3["⚠️ 23 duplicate rows detected"]
            A4["✅ 'id' is unique — candidate primary key"]
        end

        subgraph Correlations["Correlation Matrix"]
            CM[Heatmap of numeric column correlations]
        end
    end
```

#### Profiling Pipeline

```mermaid
flowchart TB
    A[Table Selected] --> B[Sample if > 100k rows]
    B --> C{For Each Column}

    C --> D[Detect Type]
    D --> E[Null Analysis]
    E --> F[Uniqueness Check]
    F --> G{Type?}

    G -->|Numeric| H[Stats: mean, median, std, percentiles]
    G -->|String| I[Length stats, pattern detection]
    G -->|Date| J[Range, gap analysis]
    G -->|Boolean| K[True/False distribution]

    H --> L[Histogram Generation]
    I --> L
    J --> L
    K --> L

    L --> M[Outlier Detection]
    M --> N[Cross-Column Correlations]
    N --> O[Quality Alerts]
    O --> P[Profile Report JSON]
```

**Acceptance Criteria:**
- [ ] Profile generates in <5 seconds for datasets up to 100k rows
- [ ] For datasets >100k rows, profile uses sampling with confidence intervals
- [ ] Each column shows type, nulls, unique count, and distribution chart
- [ ] Quality alerts surface actionable issues (high nulls, outliers, duplicates)
- [ ] Correlation matrix renders as interactive heatmap
- [ ] User can click any column card to see full detail
- [ ] Profile is cached and only regenerated when data changes

---

### F4: AI-Powered Data Exploration

**Priority:** P0 (Must Have)
**Effort:** Medium (extends existing chat)

#### Chat Capabilities

The AI chat should understand and execute:

| Intent | Example Prompt | Action |
|---|---|---|
| **Explore** | "What does this dataset look like?" | Schema + profile summary |
| **Query** | "Show me all users from California" | SQL → results table |
| **Visualize** | "Plot age distribution" | SQL → histogram |
| **Profile** | "Are there any data quality issues?" | Run profiler → alerts |
| **Transform** | "Remove rows where age > 100" | Generate transform step |
| **Compare** | "Compare sales Q1 vs Q2" | SQL → side-by-side chart |
| **Explain** | "What does the orders table contain?" | Schema description + sample rows |
| **Suggest** | "What should I clean before training?" | Profile-based recommendations |

#### AI Tool Registry (Extended)

```mermaid
graph LR
    subgraph ExistingTools["Existing Tools"]
        T1[getDatabaseSchema]
        T2[executeSQL]
        T3[showNeonDemo]
    end

    subgraph NewTools["New Tools — Option A"]
        T4[profileDataset<br/>Run full profiling on a table]
        T5[profileColumn<br/>Deep-dive single column]
        T6[detectOutliers<br/>IQR/Z-score outlier scan]
        T7[suggestTransforms<br/>AI-recommended cleanup steps]
        T8[previewTransform<br/>Show before/after of a transform]
        T9[applyTransform<br/>Execute transform on dataset]
        T10[splitDataset<br/>Train/test/val split]
        T11[exportDataset<br/>Generate downloadable file]
        T12[compareColumns<br/>Cross-column analysis]
        T13[detectDuplicates<br/>Find and show duplicate rows]
        T14[inferJoinKeys<br/>Suggest join columns between tables]
    end

    T1 --- T4
    T2 --- T5
```

**Acceptance Criteria:**
- [ ] AI can answer "what's wrong with this data?" with actionable profiling results
- [ ] AI can chain tools: profile → suggest → preview → apply in one conversation
- [ ] All AI-generated SQL is validated through existing safety layer
- [ ] AI shows its reasoning before executing transforms (user can approve/reject)

---

### F5: Data Transformation Pipeline

**Priority:** P0 (Must Have)
**Effort:** High

#### Available Transformations

| Category | Operations |
|---|---|
| **Row Operations** | Filter rows, remove duplicates, sample, sort, limit |
| **Column Operations** | Rename, drop, reorder, cast type, add computed column |
| **Null Handling** | Fill with value/mean/median/mode, drop rows with nulls, interpolate |
| **String Operations** | Trim, lowercase, uppercase, regex replace, extract, split |
| **Numeric Operations** | Round, normalize (min-max/z-score), bin/bucket, clip outliers |
| **Date Operations** | Extract year/month/day, compute age, parse format, fill gaps |
| **Encoding** | One-hot encode, label encode, ordinal encode |
| **Aggregation** | Group by + aggregate, pivot, unpivot |
| **Join** | Inner/left/right/outer join between tables |
| **Custom** | Python transform (existing), SQL transform |

#### Transform Pipeline Architecture

```mermaid
flowchart TB
    subgraph Pipeline["Transform Pipeline"]
        direction TB
        S[Source Table<br/>raw_users: 50,000 rows]

        T1["Step 1: Drop Duplicates<br/>-1,234 rows → 48,766 rows"]
        T2["Step 2: Fill Nulls in 'age'<br/>median = 34 → 0 nulls remaining"]
        T3["Step 3: Remove Outliers in 'income'<br/>clip > $500k → 48,412 rows"]
        T4["Step 4: One-Hot Encode 'state'<br/>+50 columns → 62 total columns"]
        T5["Step 5: Normalize 'age', 'income'<br/>min-max scaling → [0, 1]"]
        T6["Step 6: Drop 'email', 'phone'<br/>PII removal → 60 columns"]

        R[Result Table<br/>clean_users: 48,412 rows × 60 cols]

        S --> T1 --> T2 --> T3 --> T4 --> T5 --> T6 --> R
    end

    subgraph Controls["Pipeline Controls"]
        C1[↩️ Undo Any Step]
        C2[🔀 Reorder Steps]
        C3[👁️ Preview at Any Step]
        C4[💾 Save Pipeline as Template]
        C5[▶️ Re-run on New Data]
    end

    Pipeline --- Controls
```

#### Transform Step Data Model

```typescript
interface TransformStep {
  id: string;
  type: TransformType;
  params: Record<string, unknown>;
  description: string;          // Human-readable
  sql?: string;                 // Generated SQL (if SQL-based)
  python?: string;              // Generated Python (if Python-based)
  inputRowCount: number;
  outputRowCount: number;
  inputColumnCount: number;
  outputColumnCount: number;
  executionTimeMs: number;
  createdAt: string;
  createdBy: 'user' | 'ai';    // Who created this step
}

interface TransformPipeline {
  id: string;
  name: string;
  sourceTable: string;
  steps: TransformStep[];
  resultTable: string;          // Materialized result
  status: 'draft' | 'executed' | 'failed';
  createdAt: string;
  updatedAt: string;
}
```

**Acceptance Criteria:**
- [ ] User can build a multi-step pipeline visually or via chat
- [ ] Each step shows row/column count delta (before vs after)
- [ ] User can preview any step without executing the full pipeline
- [ ] Pipeline can be saved and re-run on new data
- [ ] Undo/redo works for any step
- [ ] AI can suggest a full pipeline based on profiling results

---

### F6: Dataset Splitting

**Priority:** P1 (Should Have)
**Effort:** Medium

#### Split Strategies

```mermaid
graph TB
    subgraph Strategies["Split Strategies"]
        A["Random Split<br/>Simple random assignment"]
        B["Stratified Split<br/>Preserve label distribution"]
        C["Time-Based Split<br/>Train on past, test on future"]
        D["Group Split<br/>Keep groups together<br/>(e.g., all rows for same user)"]
        E["K-Fold Cross Validation<br/>Generate k fold assignments"]
    end

    subgraph Config["Split Configuration"]
        F["Ratios: train/val/test<br/>Default: 80/10/10"]
        G["Random Seed<br/>For reproducibility"]
        H["Stratify Column<br/>For balanced splits"]
        I["Group Column<br/>For data leakage prevention"]
        J["Time Column<br/>For temporal ordering"]
    end

    subgraph Output["Split Output"]
        K["train.parquet — 40,000 rows"]
        L["val.parquet — 5,000 rows"]
        M["test.parquet — 5,000 rows"]
        N["split_metadata.json"]
    end

    Strategies --> Config --> Output
```

**Acceptance Criteria:**
- [ ] User can split via chat: "Split 80/10/10 stratified by label column"
- [ ] Split preserves exact ratios (±1% tolerance)
- [ ] Stratified split maintains class distribution across all splits
- [ ] Group split prevents data leakage (same user never in both train and test)
- [ ] Split metadata (seed, strategy, counts) is saved with export
- [ ] User can preview split distribution before exporting

---

### F7: Export Engine

**Priority:** P0 (Must Have)
**Effort:** Medium

#### Export Formats

| Format | Use Case | Library |
|---|---|---|
| **CSV** | Universal, Excel-compatible | Built-in |
| **Parquet** | Columnar, efficient for ML pipelines | `parquetjs` or `@duckdb/duckdb-wasm` |
| **JSON** | API-friendly, nested data | Built-in |
| **JSONL** | Streaming, LLM fine-tuning format | Built-in |
| **Arrow IPC** | Zero-copy interchange | `apache-arrow` |
| **HuggingFace Dataset** | Direct push to HF Hub | HF API |
| **SQLite** | Self-contained database file | `better-sqlite3` |

#### Export Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as Export API
    participant Conv as Format Converter
    participant Store as File Store

    U->>UI: Click "Export" or say "Export as Parquet"
    UI->>API: POST /api/export {table, format, splits?, options}

    API->>API: Validate table exists
    API->>API: Check row count & estimate file size

    alt Small Dataset (< 50MB output)
        API->>Conv: Convert in-memory
        Conv-->>API: File buffer
        API-->>UI: Direct download response
    else Large Dataset (> 50MB output)
        API->>Conv: Stream conversion
        Conv->>Store: Write chunks to temp file
        Store-->>API: File path
        API-->>UI: Download URL (expires in 1 hour)
    end

    UI-->>U: File downloaded

    opt Push to HuggingFace
        U->>UI: "Push to HuggingFace as my-dataset"
        UI->>API: POST /api/export/huggingface
        API->>Conv: Convert to Parquet + metadata
        API->>API: Push via HF API
        API-->>UI: Dataset URL on HuggingFace
    end
```

#### Export Options

```typescript
interface ExportOptions {
  format: 'csv' | 'parquet' | 'json' | 'jsonl' | 'arrow' | 'sqlite';
  table: string;
  columns?: string[];           // Subset of columns (default: all)
  splits?: {                    // If dataset was split
    includeTrain: boolean;
    includeVal: boolean;
    includeTest: boolean;
    separateFiles: boolean;     // One file per split or single file with split column
  };
  compression?: 'none' | 'gzip' | 'snappy' | 'zstd';  // For Parquet
  includeMetadata?: boolean;    // Include profiling + transform history
  maxRows?: number;             // Limit output rows
  sampling?: {                  // Random sample instead of full export
    enabled: boolean;
    size: number;
    seed: number;
  };
}
```

**Acceptance Criteria:**
- [ ] CSV export works for any table up to 1M rows
- [ ] Parquet export preserves column types correctly
- [ ] Export includes optional metadata file (schema, profile, transform history)
- [ ] Large exports (>50MB) don't crash the browser — use streaming
- [ ] HuggingFace push creates a valid dataset with card and splits
- [ ] Export button is accessible from both chat and UI toolbar

---

### F8: Dataset Versioning & Snapshots

**Priority:** P2 (Nice to Have)
**Effort:** Medium

```mermaid
graph LR
    subgraph Versions["Dataset Version History"]
        V1["v1: Raw Upload<br/>50,000 rows × 12 cols<br/>2026-03-19 10:00"]
        V2["v2: After Dedup<br/>48,766 rows × 12 cols<br/>2026-03-19 10:15"]
        V3["v3: After Cleaning<br/>48,412 rows × 60 cols<br/>2026-03-19 10:30"]
        V4["v4: After Split<br/>Train: 38,730 / Val: 4,841 / Test: 4,841<br/>2026-03-19 10:45"]
    end

    V1 -->|"Drop Dupes"| V2
    V2 -->|"Fill Nulls + Encode"| V3
    V3 -->|"80/10/10 Stratified"| V4

    V2 -.->|"Branch: experiment-A"| V2A["v2a: Alternative cleaning<br/>47,000 rows"]
```

**Acceptance Criteria:**
- [ ] Each transform pipeline execution creates a new version
- [ ] User can compare any two versions (row count, column diff, sample diff)
- [ ] User can revert to any previous version
- [ ] Versions are stored efficiently (pipeline steps, not full copies)
- [ ] Version metadata includes: who, when, what changed, why (from chat context)

---

## 6. User Flows

### Flow 1: Upload → Explore → Clean → Export (Primary)

```mermaid
flowchart TB
    Start([User Opens App]) --> Upload[Drag-Drop CSV File]
    Upload --> Preview[See Preview: 100 rows + auto-profile]
    Preview --> Explore{"Explore via Chat"}

    Explore -->|"What's in this data?"| SchemaView[Schema + Profile Dashboard]
    Explore -->|"Show me distributions"| Charts[Auto-generated Histograms]
    Explore -->|"Any quality issues?"| Alerts[Quality Alerts Panel]

    SchemaView --> Transform
    Charts --> Transform
    Alerts --> Transform

    Transform{"Clean via Chat or UI"}
    Transform -->|"Remove nulls in age"| Step1[Transform Step Added]
    Transform -->|"One-hot encode state"| Step2[Transform Step Added]
    Transform -->|"Drop PII columns"| Step3[Transform Step Added]

    Step1 --> Pipeline[View Pipeline Summary]
    Step2 --> Pipeline
    Step3 --> Pipeline

    Pipeline --> Split["Split 80/10/10 Stratified"]
    Split --> ExportDecision{Export Where?}

    ExportDecision -->|Local| Download[Download Parquet/CSV]
    ExportDecision -->|HuggingFace| HFPush[Push to HF Hub]
    ExportDecision -->|S3| S3Push[Upload to S3 Bucket]

    Download --> Done([Dataset Ready for Training])
    HFPush --> Done
    S3Push --> Done
```

### Flow 2: Connect External DB → Subset → Export

```mermaid
flowchart TB
    Start([User Opens App]) --> Connect[Add Postgres Connection]
    Connect --> Test[Test Connection ✅]
    Test --> Browse[Browse Tables & Schema]
    Browse --> Chat{"Ask Questions via Chat"}

    Chat -->|"Show me the users table"| View[Table Preview + Profile]
    Chat -->|"I only need users from 2024 with purchases > 5"| Filter[AI Generates SQL Filter]

    Filter --> Preview[Preview Filtered Result: 12,340 rows]
    Preview --> Approve{Looks Good?}

    Approve -->|Yes| Materialize[Save as Working Table]
    Approve -->|No| Refine[Refine Filter via Chat]
    Refine --> Filter

    Materialize --> Transform[Apply Transforms]
    Transform --> Export[Export to Parquet]
    Export --> Done([Dataset Ready])
```

---

## 7. Data Pipeline Architecture

### Processing Model

```mermaid
graph TB
    subgraph Ingestion["Ingestion Layer"]
        I1[File Parser<br/>CSV, JSON, Parquet, Excel]
        I2[DB Connector<br/>Postgres, MySQL, MongoDB]
        I3[API Fetcher<br/>REST, Airtable, Notion]
    end

    subgraph Working["Working Database"]
        W1["SQLite (Local Mode)<br/>File: ~/.dataforge/working.db"]
        W2["Postgres (Cloud Mode)<br/>Schema: working_*"]
    end

    subgraph Transforms["Transform Engine"]
        T1[SQL Transforms<br/>WHERE, GROUP BY, JOIN]
        T2[Python Transforms<br/>Pandas-like operations]
        T3[Built-in Transforms<br/>Dedup, fill, encode, normalize]
    end

    subgraph Profiling["Profiling Engine"]
        P1[Column Stats<br/>Computed via SQL aggregates]
        P2[Distribution Analysis<br/>Histograms via bucketing]
        P3[Correlation<br/>Pairwise Pearson]
        P4[Quality Rules<br/>Null %, uniqueness, patterns]
    end

    subgraph Export["Export Engine"]
        E1[Format Converter]
        E2[Compression]
        E3[Split Packager]
    end

    I1 --> W1
    I2 --> W1
    I3 --> W1
    I1 --> W2
    I2 --> W2

    W1 --> T1
    W1 --> T2
    W1 --> T3
    W2 --> T1
    W2 --> T2

    T1 --> W1
    T2 --> W1
    T3 --> W1

    W1 --> P1
    W1 --> P2
    P1 --> P3
    P2 --> P4

    W1 --> E1
    E1 --> E2
    E2 --> E3
```

---

## 8. API Design

### New Endpoints

#### `POST /api/upload`

```typescript
// Request: multipart/form-data
{
  file: File,
  tableName?: string,          // Optional custom name
  options?: {
    delimiter?: string,        // CSV delimiter override
    hasHeader?: boolean,       // Default: true
    encoding?: string,         // Default: utf-8
    sheetName?: string,        // For Excel files
  }
}

// Response
{
  success: true,
  table: {
    name: string,
    rowCount: number,
    columns: Array<{
      name: string,
      type: string,
      nullCount: number,
      sampleValues: unknown[]
    }>
  },
  profile: ProfileSummary      // Auto-generated profile
}
```

#### `POST /api/profile`

```typescript
// Request
{
  table: string,
  columns?: string[],          // Specific columns (default: all)
  sampleSize?: number,         // For large tables (default: 100000)
}

// Response
{
  table: string,
  rowCount: number,
  duplicateCount: number,
  columns: Array<ColumnProfile>,
  correlations?: CorrelationMatrix,
  alerts: QualityAlert[],
  profiledAt: string,
  sampledFrom?: number         // If sampling was used
}
```

#### `POST /api/transform`

```typescript
// Request
{
  pipelineId?: string,         // Existing pipeline to extend
  sourceTable: string,
  steps: TransformStep[],
  preview?: boolean,           // If true, return preview without saving
  previewRows?: number         // Default: 100
}

// Response
{
  pipelineId: string,
  resultTable: string,
  steps: Array<{
    ...TransformStep,
    inputRowCount: number,
    outputRowCount: number,
    executionTimeMs: number
  }>,
  preview?: {
    rows: Record<string, unknown>[],
    columns: string[]
  }
}
```

#### `POST /api/split`

```typescript
// Request
{
  table: string,
  strategy: 'random' | 'stratified' | 'temporal' | 'group' | 'kfold',
  ratios: { train: number, val: number, test: number },
  stratifyColumn?: string,
  groupColumn?: string,
  timeColumn?: string,
  seed?: number,               // Default: 42
  kFolds?: number              // For kfold strategy
}

// Response
{
  splits: {
    train: { rowCount: number, table: string },
    val: { rowCount: number, table: string },
    test: { rowCount: number, table: string }
  },
  metadata: {
    strategy: string,
    seed: number,
    distribution?: Record<string, Record<string, number>>  // For stratified
  }
}
```

#### `POST /api/export`

```typescript
// Request
{
  table: string,
  format: 'csv' | 'parquet' | 'json' | 'jsonl' | 'arrow' | 'sqlite',
  columns?: string[],
  compression?: 'none' | 'gzip' | 'snappy' | 'zstd',
  includeMetadata?: boolean,
  splits?: string[],           // ['train', 'val', 'test']
  maxRows?: number
}

// Response: File download stream
// Headers:
//   Content-Type: application/octet-stream
//   Content-Disposition: attachment; filename="dataset.parquet"
//   X-Row-Count: 48412
//   X-Export-Format: parquet
```

#### `POST /api/connector`

```typescript
// Request
{
  action: 'add' | 'remove' | 'test' | 'list',
  connector?: {
    type: 'postgres' | 'mysql' | 'mongodb' | 'bigquery' | 'supabase',
    name: string,
    config: ConnectionConfig
  },
  connectorId?: string         // For remove/test
}

// Response
{
  connectors: Array<{
    id: string,
    name: string,
    type: string,
    status: 'connected' | 'disconnected' | 'error',
    tables: number,
    lastUsed: string
  }>
}
```

---

## 9. UI/UX Specifications

### Layout Architecture

```mermaid
graph TB
    subgraph AppLayout["Application Layout"]
        subgraph TopBar["Top Bar"]
            Logo[Logo + Name]
            ConnStatus[Connection Status]
            ExportBtn[Export Button]
            Settings[Settings]
        end

        subgraph MainArea["Main Content Area (Split View)"]
            subgraph LeftPanel["Left Panel (40%)"]
                ChatInput[Chat Input + File Drop Zone]
                ChatThread[Chat Thread<br/>Messages, Results, Charts]
            end

            subgraph RightPanel["Right Panel (60%)"]
                Tabs["Tab Bar: Schema | Profile | Pipeline | Canvas"]
                TabContent["Active Tab Content"]
            end
        end

        subgraph BottomBar["Status Bar"]
            DB[Active Database]
            Rows[Row Count]
            Memory[Memory Usage]
        end
    end
```

### Key UI Components to Build

| Component | Description | Priority |
|---|---|---|
| `FileDropZone` | Drag-drop area with format icons and progress bar | P0 |
| `ProfileDashboard` | Grid of column profile cards with alerts | P0 |
| `ColumnProfileCard` | Individual column stats + mini chart | P0 |
| `CorrelationHeatmap` | Interactive correlation matrix | P1 |
| `TransformPipelineView` | Visual step-by-step pipeline with row counts | P0 |
| `TransformStepEditor` | Form for configuring a transform step | P0 |
| `SplitConfigurator` | Split strategy selector with preview | P1 |
| `ExportDialog` | Format selector, options, download button | P0 |
| `ConnectorForm` | Database connection form with test button | P0 |
| `ConnectorList` | Saved connections with status indicators | P0 |
| `DataPreviewTable` | Sortable, filterable data table with type badges | P0 |
| `QualityAlertBanner` | Dismissible alerts for data quality issues | P1 |

---

## 10. Technical Requirements

### Dependencies to Add

```json
{
  "dependencies": {
    "mysql2": "^3.x",
    "mongodb": "^6.x",
    "@google-cloud/bigquery": "^7.x",
    "@supabase/supabase-js": "^2.x",
    "papaparse": "^5.x",
    "parquetjs-lite": "^1.x",
    "apache-arrow": "^17.x",
    "xlsx": "^0.18.x",
    "simple-statistics": "^7.x",
    "multer": "^1.x"
  }
}
```

### File Structure (New)

```
src/
├── app/api/
│   ├── upload/route.ts          # File upload endpoint
│   ├── profile/route.ts         # Data profiling endpoint
│   ├── transform/route.ts       # Transform pipeline endpoint
│   ├── split/route.ts           # Dataset split endpoint
│   ├── export/route.ts          # Export/download endpoint
│   └── connector/route.ts       # DB connector management
├── lib/
│   ├── connectors/
│   │   ├── interface.ts         # DatabaseConnector interface
│   │   ├── manager.ts           # ConnectionManager
│   │   ├── postgres.ts          # PostgresConnector
│   │   ├── mysql.ts             # MySQLConnector
│   │   ├── mongodb.ts           # MongoConnector
│   │   ├── bigquery.ts          # BigQueryConnector
│   │   └── sqlite.ts            # SQLiteConnector (refactored)
│   ├── profiling/
│   │   ├── profiler.ts          # Main profiling engine
│   │   ├── column-stats.ts      # Per-column statistics
│   │   ├── correlations.ts      # Correlation matrix
│   │   ├── quality-rules.ts     # Data quality checks
│   │   └── types.ts             # Profile types
│   ├── transforms/
│   │   ├── pipeline.ts          # Pipeline executor
│   │   ├── steps/
│   │   │   ├── filter.ts
│   │   │   ├── dedup.ts
│   │   │   ├── fill-nulls.ts
│   │   │   ├── encode.ts
│   │   │   ├── normalize.ts
│   │   │   ├── rename.ts
│   │   │   ├── cast.ts
│   │   │   ├── drop.ts
│   │   │   ├── computed.ts
│   │   │   └── join.ts
│   │   └── types.ts
│   ├── splitting/
│   │   ├── splitter.ts          # Split logic
│   │   ├── strategies.ts        # Split strategies
│   │   └── types.ts
│   ├── export/
│   │   ├── exporter.ts          # Export engine
│   │   ├── formats/
│   │   │   ├── csv.ts
│   │   │   ├── parquet.ts
│   │   │   ├── json.ts
│   │   │   ├── arrow.ts
│   │   │   └── huggingface.ts
│   │   └── types.ts
│   └── ingestion/
│       ├── file-parser.ts       # File format detection + parsing
│       ├── type-inference.ts    # Column type inference
│       └── types.ts
├── components/
│   ├── data/
│   │   ├── file-drop-zone.tsx
│   │   ├── data-preview-table.tsx
│   │   ├── profile-dashboard.tsx
│   │   ├── column-profile-card.tsx
│   │   ├── correlation-heatmap.tsx
│   │   ├── quality-alert-banner.tsx
│   │   ├── transform-pipeline-view.tsx
│   │   ├── transform-step-editor.tsx
│   │   ├── split-configurator.tsx
│   │   ├── export-dialog.tsx
│   │   ├── connector-form.tsx
│   │   └── connector-list.tsx
│   └── ...
```

---

## 11. Database Schema

### Application Metadata Tables

```sql
-- Track uploaded datasets
CREATE TABLE datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,        -- 'upload', 'connector', 'transform'
    source_id TEXT,                   -- connector_id or parent dataset_id
    table_name TEXT NOT NULL,         -- actual table name in working DB
    row_count INTEGER,
    column_count INTEGER,
    file_size_bytes INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Track database connections
CREATE TABLE connectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,               -- 'postgres', 'mysql', 'mongodb', etc.
    config_encrypted TEXT NOT NULL,   -- Encrypted connection config
    status TEXT DEFAULT 'disconnected',
    last_tested_at TEXT,
    created_at TEXT NOT NULL
);

-- Track transform pipelines
CREATE TABLE pipelines (
    id TEXT PRIMARY KEY,
    name TEXT,
    source_dataset_id TEXT NOT NULL,
    result_dataset_id TEXT,
    steps_json TEXT NOT NULL,         -- JSON array of TransformStep
    status TEXT DEFAULT 'draft',      -- 'draft', 'executed', 'failed'
    created_at TEXT NOT NULL,
    executed_at TEXT,
    FOREIGN KEY (source_dataset_id) REFERENCES datasets(id)
);

-- Track data profiles (cached)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    profile_json TEXT NOT NULL,       -- Full profile report
    sampled_from INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

-- Track exports
CREATE TABLE exports (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    format TEXT NOT NULL,
    options_json TEXT,
    file_path TEXT,
    file_size_bytes INTEGER,
    row_count INTEGER,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);

-- Track dataset versions
CREATE TABLE dataset_versions (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    pipeline_id TEXT,
    row_count INTEGER,
    column_count INTEGER,
    snapshot_table TEXT,              -- Table name of this version's data
    created_at TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id),
    FOREIGN KEY (pipeline_id) REFERENCES pipelines(id)
);
```

---

## 12. Security & Privacy

### Threat Model

```mermaid
graph TB
    subgraph Threats["Threats"]
        T1["SQL Injection via<br/>uploaded file content"]
        T2["Path Traversal via<br/>file upload"]
        T3["Credential Exposure<br/>in connector configs"]
        T4["Data Exfiltration<br/>via Python transforms"]
        T5["DoS via large<br/>file uploads"]
        T6["XSS via data<br/>displayed in UI"]
    end

    subgraph Mitigations["Mitigations"]
        M1["Parameterized queries<br/>for all data insertion"]
        M2["Filename sanitization<br/>+ temp directory isolation"]
        M3["AES-256 encryption<br/>for stored credentials"]
        M4["Python sandbox<br/>(existing) + no network"]
        M5["File size limits<br/>+ streaming ingestion"]
        M6["DOMPurify (existing)<br/>+ Content-Security-Policy"]
    end

    T1 --> M1
    T2 --> M2
    T3 --> M3
    T4 --> M4
    T5 --> M5
    T6 --> M6
```

### Data Privacy Considerations

- **PII Detection:** Auto-detect columns that look like emails, phones, SSNs, names
- **PII Alerts:** Warn users before exporting datasets containing PII
- **PII Removal:** One-click "Remove PII columns" transform
- **Local-First:** Default to local SQLite — no data leaves the machine unless user explicitly exports
- **No Telemetry on Data:** Never log or transmit user data content

---

## 13. Performance Requirements

| Operation | Target | Max Dataset Size |
|---|---|---|
| File upload (CSV) | < 5s for 100MB file | 500MB |
| Type inference | < 2s for 1M rows | 1M rows |
| Full profile | < 5s for 100k rows | 1M rows (sampled) |
| Single transform step | < 3s for 100k rows | 1M rows |
| Full pipeline (10 steps) | < 30s for 100k rows | 1M rows |
| Dataset split | < 5s for 100k rows | 1M rows |
| CSV export | < 10s for 1M rows | 5M rows |
| Parquet export | < 15s for 1M rows | 5M rows |
| Chat response (first token) | < 1s | — |

---

## 14. Success Metrics

### North Star Metric
**Datasets exported per week** — this means users completed the full flow.

### Supporting Metrics

| Metric | Target (Month 1) | Target (Month 6) |
|---|---|---|
| GitHub stars | 100 | 1,000 |
| Weekly active users | 20 | 500 |
| Datasets uploaded/week | 50 | 2,000 |
| Datasets exported/week | 20 | 1,000 |
| Avg transforms per pipeline | 3 | 5 |
| HuggingFace pushes/week | 5 | 200 |
| Avg session duration | 10 min | 15 min |
| Return rate (week over week) | 30% | 50% |

---

## 15. Milestones & Phasing

### Phase 1A: Foundation (Weeks 1-3)

```mermaid
gantt
    title Phase 1A — Foundation
    dateFormat  YYYY-MM-DD
    section Infrastructure
        Clean dead code (Brave, GitHub stubs)    :a1, 2026-03-20, 2d
        Database connector interface             :a2, 2026-03-20, 3d
        MySQL connector                          :a3, after a2, 2d
        MongoDB connector                        :a4, after a3, 3d
        Connection manager + UI                  :a5, after a2, 4d
    section File Upload
        File parser (CSV, JSON)                  :b1, 2026-03-22, 3d
        Type inference engine                    :b2, after b1, 2d
        Upload API endpoint                      :b3, after b2, 2d
        Drag-drop UI component                   :b4, 2026-03-22, 3d
        Parquet + Excel support                  :b5, after b3, 3d
    section Export
        CSV export endpoint                      :c1, 2026-03-29, 2d
        JSON/JSONL export                        :c2, after c1, 1d
        Parquet export                           :c3, after c2, 3d
        Export dialog UI                         :c4, 2026-03-29, 3d
```

### Phase 1B: Data Prep Core (Weeks 4-7)

```mermaid
gantt
    title Phase 1B — Data Prep Core
    dateFormat  YYYY-MM-DD
    section Profiling
        Column statistics engine                 :d1, 2026-04-10, 4d
        Histogram generation                     :d2, after d1, 2d
        Quality alerts engine                    :d3, after d2, 2d
        Profile dashboard UI                     :d4, 2026-04-10, 5d
        Correlation matrix                       :d5, after d3, 3d
    section Transforms
        Transform pipeline executor              :e1, 2026-04-17, 3d
        Filter + dedup steps                     :e2, after e1, 2d
        Fill nulls + cast type steps             :e3, after e2, 2d
        Encode + normalize steps                 :e4, after e3, 3d
        Pipeline UI (visual steps)               :e5, 2026-04-17, 5d
        Undo/redo + preview                      :e6, after e5, 3d
    section AI Integration
        New tool registry (profile, transform)   :f1, 2026-04-24, 3d
        AI suggest transforms                    :f2, after f1, 3d
        Chain tool execution                     :f3, after f2, 2d
```

### Phase 1C: ML-Ready Features (Weeks 8-10)

```mermaid
gantt
    title Phase 1C — ML-Ready Features
    dateFormat  YYYY-MM-DD
    section Splitting
        Random + stratified split                :g1, 2026-05-08, 3d
        Group + temporal split                   :g2, after g1, 3d
        Split configurator UI                    :g3, 2026-05-08, 4d
    section Advanced Export
        HuggingFace dataset push                 :h1, 2026-05-15, 4d
        Export with split metadata               :h2, after h1, 2d
        Arrow IPC format                         :h3, after h2, 2d
    section Polish
        Dataset versioning                       :i1, 2026-05-22, 4d
        PII detection + alerts                   :i2, 2026-05-22, 3d
        Docker compose setup                     :i3, 2026-05-25, 2d
        README + landing page                    :i4, 2026-05-25, 3d
```

---

## 16. Open Questions & Risks

### Open Questions

| # | Question | Impact | Decision Needed By |
|---|---|---|---|
| 1 | Should we use DuckDB instead of SQLite for the working database? DuckDB is columnar and faster for analytics. | Architecture | Phase 1A start |
| 2 | Should transforms execute as SQL or Python or both? SQL is faster but less flexible. | Transform engine design | Phase 1B start |
| 3 | Do we support real-time sync with source databases or only snapshot? | Connector design | Phase 1A |
| 4 | Should we build a VS Code extension for Jupyter-like inline experience? | Distribution strategy | Post-Phase 1 |
| 5 | How do we handle datasets that don't fit in memory? Streaming? DuckDB? | Performance | Phase 1B |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Performance degrades with large files (>100MB) | High | High | Use streaming + DuckDB for analytics |
| Too many connector types to maintain | Medium | Medium | Start with 3, add based on user demand |
| Python sandbox escape | Low | Critical | Keep existing sandbox, add wasm option |
| No differentiation from Pandas in Jupyter | Medium | High | Focus on UX: chat-driven, visual pipeline |
| Scope creep into full BI tool | High | High | Strict PRD adherence, say no to dashboards |

---

*End of PRD — Option A*
