# YC Application — DataForge

> **Batch:** S2026
> **Company:** DataForge
> **Tagline:** "From raw database to ML-ready dataset in minutes, not days."

---

## Company

**Company name:** DataForge

**Company URL:** https://dataforge.dev *(to be set up)*

**If you have a demo, what's the URL?** Self-hosted at localhost — demo video to be recorded

**Describe what your company does in 50 characters or less:**
AI data prep tool: upload, profile, clean, export.

---

## Founder

**Name:** Kartik Garg

**Role:** Solo Founder / Technical CEO

---

## Application Questions

### Describe what your company does in one sentence.

DataForge is an open-source, AI-powered data preparation tool that lets ML engineers and data teams go from raw database or CSV file to a clean, profiled, split, and exported ML-ready dataset in minutes — through natural language chat, visual pipelines, and one-click exports to HuggingFace, S3, or Parquet.

---

### What problem are you solving?

ML engineers spend **60-80% of their time on data preparation**, not model building. The current workflow is fragmented across 5+ tools:

1. Connect to DB using DBeaver/pgAdmin
2. Write exploratory SQL
3. Export to CSV
4. Open Jupyter, write Pandas cleaning scripts
5. Profile data quality manually
6. Split into train/test sets
7. Export to a format the training pipeline accepts
8. Repeat every time source data changes

**There is no single tool that handles the full path: raw data → profiled → cleaned → split → exported.**

Existing tools serve adjacent markets but miss this specific workflow:
- **Jupyter + Pandas** — manual, no DB integration, no profiling UI
- **Metabase / Hex** — built for BI analysts, no export to Parquet/HF, no splitting
- **dbt** — SQL transforms only, no profiling, steep learning curve
- **AWS Glue** — enterprise, expensive, overkill for most teams

---

### Who are your users?

**Primary:** ML Engineers & Data Scientists (1-10 years experience, Python-fluent, SQL-comfortable)
- Solo to 5-person ML teams at startups and mid-size companies
- Pain: "I spend more time cleaning data than training models"
- Current tools: Jupyter, Pandas, SQLAlchemy, DBeaver
- Willingness to pay: $29-99/mo for a tool that saves 10+ hours/week

**Secondary:** Analytics Engineers at data-forward startups who need to hand off clean datasets to ML teams.

**Anti-personas:** Enterprise BI teams (they have Tableau), no-code users (they need Metabase), data engineers building production ETL (they need Airflow).

---

### How does your product work?

**Four steps: Connect → Explore → Clean → Export**

1. **Connect:** Upload CSV/JSON/Parquet files via drag-drop, or connect to Postgres/MySQL/MongoDB/BigQuery/Supabase with encrypted credentials.

2. **Explore:** Ask questions in natural language ("show me nulls in the age column") or view auto-generated data profiles with quality alerts, histograms, correlations, and PII detection.

3. **Clean:** Build visual transform pipelines (28 transform types including filter, dedup, fill nulls, normalize, one-hot encode, join, pivot) — via chat or point-and-click. Preview each step before applying.

4. **Export:** One-click export to CSV, Parquet, JSON, Arrow, or push directly to HuggingFace Hub or S3. Split into train/test/validation sets with stratified, temporal, or group strategies.

**Key differentiators:**
- Chat-driven (not dashboard-driven like Metabase)
- ML-focused (train/test split, HuggingFace push — no other tool does this)
- Local-first (data never leaves your machine unless you export)
- Open source (self-host, no vendor lock-in)

---

### How is this different from what already exists?

| Tool | What they do | What we do differently |
|------|-------------|----------------------|
| **Jupyter + Pandas** | Manual notebook workflow | Visual UI + AI chat, no code required |
| **Metabase** | BI dashboards for analysts | ML-focused: splitting, encoding, HF push |
| **dbt** | SQL transforms in production | Interactive exploration + profiling + export |
| **Great Expectations** | Data validation only | Full pipeline: profile + transform + export |
| **Hex** | Collaborative notebooks | One-click data prep, not notebooks |
| **AWS Glue DataBrew** | Enterprise data prep | Open source, local-first, 10x simpler |

**The gap:** No tool goes from "I have a database" to "I have a clean Parquet file ready for model training" in one flow. DataForge fills that gap.

---

### How far along are you?

**Working product with 39,000+ lines of production code:**

- ✅ 32 API endpoints, 23 pages, 79 React components
- ✅ 6 database connectors (SQLite, Postgres, MySQL, MongoDB, BigQuery, Supabase)
- ✅ File upload with auto-profiling (CSV, JSON, JSONL, Parquet, Excel)
- ✅ 28 data transform types with visual pipeline builder
- ✅ 5 dataset splitting strategies (random, stratified, temporal, group, k-fold)
- ✅ 8 export formats including HuggingFace and S3
- ✅ 13 chart/visualization types for dashboards
- ✅ Team management with RBAC (4 roles)
- ✅ NL-to-SQL with semantic layer
- ✅ Sharing, scheduling, Slack bot integration
- ✅ Mobile PWA with Capacitor config for iOS/Android
- ✅ Security: AES-256 encryption, CSRF, SSRF, CSP, audit logging, PII detection
- ✅ 300 passing tests, Docker deployment ready
- ✅ Build passes, server runs, all pages functional

**Not yet done:** User acquisition (0 users), payment integration, production hosting.

---

### What is your tech stack?

- **Frontend:** Next.js 15 + React 19 + Tailwind CSS
- **Backend:** Next.js App Router API routes
- **Database:** SQLite (local) / Postgres via Neon (cloud)
- **AI:** Native NL-to-SQL pipeline with semantic layer
- **Charts:** Recharts + custom SVG widgets
- **Mobile:** PWA + Capacitor (iOS/Android)
- **Security:** AES-256-GCM, CSRF, SSRF guard, Python sandbox
- **Deployment:** Docker + Vercel

---

### What's your business model?

**Open-core model** (proven by Metabase, PostHog, GitLab):

1. **Free / Open Source:** Self-hosted, unlimited data, single user. Gets adoption.
2. **Pro ($29/user/month):** Cloud-hosted, team features, SSO, scheduled reports, 10 DB connections.
3. **Enterprise ($99/user/month):** SAML SSO, audit logs, priority support, custom integrations, SLA.

**Why this works:**
- Open source drives adoption without marketing spend
- Individual ML engineers adopt free tier → bring to team → team upgrades to Pro
- Companies with compliance needs pay for Enterprise

**Comparable pricing:** Hex ($50/user/mo), Mode ($35/user/mo), Metabase Cloud ($85/mo per 10 users).

---

### How will you get users?

**Phase 1 (Month 1-3): Developer community**
- Open source launch on GitHub (target: 1,000 stars in 3 months)
- Post on HackerNews, Reddit r/MachineLearning, r/datascience
- Write comparison content: "DataForge vs Jupyter for data prep"
- YouTube demo videos showing the full workflow
- Discord community for support

**Phase 2 (Month 3-6): Content + SEO**
- Blog posts targeting "how to clean data for ML" searches
- Integration guides for popular ML frameworks (PyTorch, HF Transformers)
- Conference talks at local ML meetups

**Phase 3 (Month 6+): Cloud launch**
- Launch cloud version (no install required)
- Free tier gets users in the door
- Team features drive paid conversion

**Target metrics:**
- Month 1: 100 GitHub stars, 20 WAU
- Month 6: 1,000 stars, 500 WAU, 10 paying teams
- Month 12: 5,000 stars, 2,000 WAU, 50 paying teams

---

### What do you understand that others don't?

**The ML data prep workflow is fundamentally different from BI analytics, but everyone is building BI tools.**

Metabase, Looker, Tableau, Hex — they all optimize for "answer a business question." But ML engineers don't want dashboards. They want:
1. A clean dataset
2. With the right splits
3. In the right format
4. With documented lineage

Nobody is building for this specific workflow. The ML tooling market is exploding ($15B by 2028), but the data prep layer — the part where engineers spend 80% of their time — is still solved by duct-taping Jupyter notebooks together.

DataForge is the first tool that treats data prep as a **product**, not a side effect of analytics.

---

### How big is the market?

**Data Preparation Tools Market:** $9.2B in 2025, projected $15.4B by 2028 (CAGR 18.7%)

**Bottom-up sizing:**
- ~4M data professionals worldwide (data scientists, ML engineers, analytics engineers)
- ~30% work at companies that would adopt a tool like this = 1.2M potential users
- At $29/user/month average = $417M addressable market

**Comparable companies:**
- Metabase: $52M raised, open-source BI
- Hex: $97M raised, collaborative notebooks
- dbt Labs: $414M raised, SQL transforms
- DataForge sits at the intersection of all three.

---

### What's your long-term vision?

**Year 1:** Best open-source data prep tool for ML. 5,000 GitHub stars, 50 paying teams.

**Year 2:** Cloud platform with team collaboration. Marketplace for transform templates. 500 paying teams.

**Year 3:** The default way ML teams prepare data. Integration with every ML framework. Feature store capabilities. 2,000 paying teams, $5M ARR.

**Year 5:** Full ML data platform — prep, versioning, feature store, monitoring. "The GitHub for ML data." $25M ARR.

---

### Why now?

Three trends converging:

1. **AI/ML adoption is exploding** — every company is hiring ML engineers, and they all need clean data. The ML market grew 40% in 2025.

2. **Open-source is winning** — Metabase, PostHog, Cal.com proved that open-source + cloud is the dominant GTM for developer tools.

3. **LLMs make NL-to-SQL viable** — For the first time, a tool can actually understand "show me users from California who bought more than 5 items" and generate correct SQL. This makes data prep accessible to non-SQL users.

---

### Why should YC fund you?

1. **The product is built.** 39,000 lines of production code, not a slide deck. You can run it right now.

2. **Clear market gap.** No tool goes from raw data → ML-ready dataset in one flow. Everyone is building BI tools.

3. **Proven business model.** Open-core worked for Metabase ($52M), PostHog ($80M), GitLab ($286M). Same playbook.

4. **Solo founder who ships.** The entire product was built in days, not months. I move fast and can iterate based on user feedback immediately.

5. **Timing is perfect.** ML adoption is accelerating, data prep is the bottleneck, and LLMs finally make natural language data exploration viable.

---

## One-Minute Pitch (for video)

"Hi, I'm Kartik. I'm building DataForge — an open-source tool that turns raw databases into ML-ready datasets in minutes.

ML engineers spend 80% of their time on data prep, not models. They juggle DBeaver, Jupyter, Pandas, and Excel just to get a clean training set. It's fragmented and slow.

DataForge fixes this. Upload a CSV or connect your database. Ask questions in plain English. Profile your data — we auto-detect nulls, outliers, and PII. Build cleaning pipelines visually. Split into train/test sets. Export to Parquet or push to HuggingFace — one click.

The product is built. 39,000 lines of code, 32 APIs, 28 transform types, 6 database connectors, 300 passing tests. It runs today.

Our model is open-core — free to self-host, paid cloud for teams. Same playbook as Metabase and PostHog.

The data prep market is $9 billion and growing 19% a year. Every ML team needs this. Nobody else is building it.

I'm looking for $500K to get the first 1,000 users and launch the cloud version. Thank you."

---

## Demo Script (2 minutes)

1. **[0:00-0:15]** Open DataForge landing page. "This is DataForge. Let me show you what it does."

2. **[0:15-0:30]** Drag-drop a CSV file onto the upload page. Watch it auto-detect types and profile. "I just uploaded a dataset. It auto-detected 12 columns, found 3 with nulls, and flagged 2 email columns as PII."

3. **[0:30-0:50]** Click the Profile tab. Show the column cards, quality alerts, correlation heatmap. "Every column is profiled — distributions, outliers, patterns. These alerts tell me exactly what to clean."

4. **[0:50-1:10]** Open chat, type "fill nulls in age with median, drop the email column, normalize salary." Show the transform pipeline appear. "I just told the AI what to clean. It built a 3-step pipeline. Each step shows the row count before and after."

5. **[1:10-1:25]** Click Export, select Parquet, download. "One click — I have a clean Parquet file. Or I can push directly to HuggingFace."

6. **[1:25-1:40]** Show the split configurator. "I can split 80/10/10 stratified by label. The class distribution is maintained across all sets."

7. **[1:40-2:00]** Show the dashboard with KPI cards. "And for my team, I can build dashboards, share public links, and schedule weekly email reports. All from the same tool."

---
