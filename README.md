# DataForge

**From raw database to ML-ready dataset in minutes, not days.**

DataForge is an open-source, AI-powered data preparation and exploration platform. Upload files or connect databases, profile data quality, build transform pipelines, split datasets for ML training, and export to any format — all through natural language chat or visual UI.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Tests](https://img.shields.io/badge/Tests-394%20passing-green)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Data Ingestion
- **File Upload** — Drag-drop CSV, JSON, JSONL, Parquet, Excel, SQLite files (up to 500MB)
- **Database Connectors** — PostgreSQL, MySQL, MongoDB, BigQuery, Supabase, SQLite
- **Auto-Detection** — Delimiter, encoding, header row, and column types inferred automatically
- **Multiple Files** — Upload multiple files as separate tables in one drop

### Data Profiling
- **13 Column Metrics** — Type, nulls, unique count, min/max, mean/median/std, percentiles, histograms
- **Quality Alerts** — High nulls, outliers (IQR), duplicates, candidate primary keys
- **PII Detection** — Auto-detect emails, phones, SSNs, credit cards, IP addresses
- **Correlation Matrix** — Interactive heatmap of Pearson correlations
- **Sampling** — Automatic sampling with confidence intervals for datasets >100K rows

### Data Transformation
- **28 Transform Types** — Filter, dedup, fill nulls, normalize, one-hot encode, join, pivot, group aggregate, and more
- **Visual Pipeline Builder** — Step-by-step pipeline with row/column count deltas
- **Preview Mode** — See the result before applying any transform
- **Pipeline Templates** — Save and re-run pipelines on new data
- **AI Suggestions** — Chat-driven transform recommendations based on profiling

### Dataset Splitting
- **5 Strategies** — Random, stratified, temporal, group, K-fold cross validation
- **Data Leakage Prevention** — Group split keeps same entities together
- **Reproducible** — Seeded randomness for deterministic splits

### Export
- **8 Formats** — CSV, JSON, JSONL, Parquet, Arrow IPC, SQLite, HuggingFace Hub, S3
- **HuggingFace Push** — One-click push with auto-generated dataset card
- **W&B Integration** — Log datasets as Weights & Biases artifacts
- **Metadata** — Optional export of schema, profile, transform history, split info

### Dashboards & BI
- **13 Chart Types** — KPI, line, bar, area, stacked bar, horizontal bar, donut, scatter, funnel, heatmap, gauge, treemap, geo map
- **Auto-Visualization** — Automatic chart type selection based on data shape
- **Dashboard Builder** — Drag-and-drop grid layout with global filters
- **Saved Queries** — Query library with categories, search, parameters, and usage tracking
- **Sharing** — Public links, password-protected, team-only, email allowlist, iframe embeds
- **Scheduled Reports** — Cron-based email/Slack/webhook delivery with threshold alerts

### AI Chat
- **Natural Language Queries** — Ask questions in plain English, get SQL + charts
- **14 Chat Tools** — Profile, transform, split, export, connect — all from chat
- **Semantic Layer** — Table descriptions, column metadata, business term synonyms
- **Follow-up Queries** — Conversation context for iterative exploration
- **Query Correction** — "No, I meant active users" refines the previous query

### Team & Auth
- **RBAC** — Owner, Admin, Editor, Viewer with 12 permission actions
- **Team Management** — Create teams, invite by email, role assignment
- **SSO** — Google and GitHub OAuth
- **Table Permissions** — Per-table visibility and column hiding by role

### Mobile
- **PWA** — Installable, offline-capable, push notifications
- **Responsive** — Desktop sidebar, mobile bottom nav, tablet adaptive
- **Capacitor** — iOS and Android app packaging
- **Voice Input** — Speech-to-text for hands-free queries
- **Mobile Components** — KPI carousel, bottom sheet, swipe actions, pull-to-refresh

---

## Quick Start

```bash
# Clone
git clone https://github.com/Kartikgarg74/generative-sql-viz.git
cd generative-sql-viz

# Install
npm install
npm rebuild better-sqlite3

# Initialize database
npm run db:init

# Start (uses Turbopack for fast compilation)
npm run dev

# Open http://localhost:3000
```

## Docker

```bash
docker compose up -d
# Open http://localhost:3000
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Next.js App Router API routes |
| Database | SQLite (local) / PostgreSQL via Neon (cloud) |
| Charts | Recharts + custom SVG widgets |
| State | Zustand |
| Drag & Drop | @dnd-kit |
| Auth | JWT sessions with HMAC-SHA256 |
| Mobile | PWA + Capacitor (iOS/Android) |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| CI/CD | GitHub Actions (lint, test, build, security, docker) |
| Deployment | Docker / Vercel |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # Authenticated app pages
│   │   ├── upload/         # File upload & profiling
│   │   ├── connections/    # Database connections
│   │   ├── dashboards/     # Dashboard list & builder
│   │   ├── queries/        # Saved query library
│   │   ├── team/           # Team management
│   │   ├── settings/       # App settings
│   │   └── onboarding/     # First-time setup wizard
│   ├── (auth)/             # Login & signup
│   ├── public/             # Public shared dashboards
│   ├── embed/              # Embeddable widgets
│   ├── chat/               # AI chat interface
│   └── api/                # 32 API endpoints
├── lib/                    # Backend modules
│   ├── connectors/         # 6 database connectors
│   ├── ingestion/          # File parsing & type inference
│   ├── profiling/          # Data profiling engine
│   ├── transforms/         # 28 transform types
│   ├── splitting/          # 5 split strategies
│   ├── export/             # 8 export formats
│   ├── dashboard/          # Dashboard CRUD & auto-viz
│   ├── auth/               # JWT, RBAC, team management
│   ├── security/           # CSRF, SSRF, encryption, audit
│   ├── cache/              # LRU + Redis query cache
│   ├── semantic/           # NL-to-SQL + schema context
│   ├── scheduling/         # Cron runner + delivery
│   ├── sharing/            # Public links + embeds
│   ├── slack/              # Slack bot + OAuth
│   ├── mobile/             # Capacitor + push + biometric
│   └── pwa/                # Service worker + install prompt
├── components/             # 79 React components
│   ├── data/               # Upload, profile, transform UI
│   ├── dashboard/          # 13 chart widgets + grid
│   ├── auth/               # Login, signup, team switcher
│   ├── mobile/             # Bottom nav, bottom sheet, KPI carousel
│   ├── layout/             # Sidebar, app shell, responsive layout
│   ├── sharing/            # Share dialog
│   └── scheduling/         # Schedule form & list
└── hooks/                  # usePlatform, useHaptics, useSafeArea
```

---

## Security

| Measure | Implementation |
|---|---|
| SQL Injection | Read-only enforcement, keyword blocklist, parameterized queries |
| CSRF | Double-submit cookie pattern on all 16 POST routes |
| SSRF | Private IP blocking, DNS rebinding protection, metadata endpoint blocking |
| Encryption | AES-256-GCM for database credentials (PBKDF2 key derivation) |
| XSS | DOMPurify sanitization, Content Security Policy headers |
| Rate Limiting | Per-route limits on 14 endpoints (5-60 req/min) |
| Audit Logging | All API actions logged with IP, user agent, timestamp |
| Body Size | 10MB limit on all JSON endpoints, 500MB on file upload |
| Python Sandbox | Code validation, blocked imports, restricted builtins, 4s timeout |
| PII Detection | Auto-detect 7 PII types with warnings before export |
| Auth | HMAC-SHA256 JWT, HTTP-only cookies, RBAC with 4 roles |
| Table Permissions | Per-table visibility and column hiding enforced at query time |

---

## API Endpoints

```
POST /api/auth          — Register, login, logout, session check
POST /api/team          — Team CRUD, invite, role management
POST /api/connector     — Database connection management
POST /api/upload        — File upload with auto-profiling
POST /api/profile       — Data profiling engine
POST /api/query         — Read-only SQL execution (cached)
POST /api/transform     — Transform pipeline execution
POST /api/split         — Dataset splitting
POST /api/export        — Multi-format export
POST /api/export/huggingface — Push to HuggingFace Hub
POST /api/export/wandb  — Push to Weights & Biases
POST /api/dashboard     — Dashboard CRUD
POST /api/queries       — Saved query library
POST /api/share         — Public link management
POST /api/schedule      — Scheduled reports & alerts
POST /api/chat          — AI chat with tool execution
POST /api/threads       — Chat thread persistence
POST /api/permissions   — Table permission management
POST /api/semantic      — Semantic layer configuration
POST /api/slack/events  — Slack bot events
POST /api/slack/commands — Slack slash commands
GET  /api/slack/oauth   — Slack OAuth flow
GET  /api/auth/google   — Google SSO
GET  /api/auth/github   — GitHub SSO
GET  /api/csrf          — CSRF token
GET  /api/health        — Health check + metrics
GET  /api/schema        — Database schema discovery
```

---

## Testing

```bash
# All tests (394 passing)
npm test

# Unit tests only (28 test files)
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e
```

**Test coverage includes:** SQL injection prevention, CSV injection, SSRF IP validation, CSRF tokens, AES encryption round-trip, RBAC permissions, LRU cache, PII detection, all 29 transform types, auto-visualization, file parsing, type inference, semantic layer, connector management, API middleware.

---

## Environment Variables

```bash
# Required
NEXT_PUBLIC_TAMBO_API_KEY=your-tambo-key

# Database (optional — defaults to local SQLite)
DB_PROVIDER=sqlite|postgres
DATABASE_URL=postgresql://...

# Security
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-32-char-encryption-key
API_AUTH_REQUIRED=false|true
API_AUTH_KEY=your-api-key

# OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
APP_URL=http://localhost:3000

# Slack (optional)
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...

# Redis (optional — for distributed caching)
REDIS_URL=redis://localhost:6379

# Python execution (optional)
ENABLE_PYTHON_EXECUTION=true
PYTHON_EXECUTABLE=python3
```

---

## Documentation

- [PRD: AI Data Prep (Option A)](docs/PRD-option-a-ai-data-prep.md)
- [PRD: Team BI (Option B)](docs/PRD-option-b-team-bi.md)
- [PRD: Mobile Strategy](docs/PRD-mobile-strategy.md)
- [Master TODO](docs/MASTER-TODO.md)
- [YC Application Draft](docs/yc-application.md)
- [Architecture Notes](docs/tambo-replacement-architecture.md)
- [Observability](docs/observability.md)
- [App Store Listing](docs/app-store-listing.md)

---

## License

MIT

---

Built with ❤️ by [Kartik Garg](https://github.com/Kartikgarg74)
