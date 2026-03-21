const fs = require("node:fs");
const path = require("node:path");
const autocannon = require("autocannon");

const baseUrl = process.env.LOAD_BASE_URL || "http://127.0.0.1:3000";
const duration = Number(process.env.LOAD_DURATION_SECONDS || 15);
const loadApiKey = process.env.LOAD_API_KEY || "";

const scenarios = [
  {
    id: "query_read",
    title: "POST /api/query",
    options: {
      url: `${baseUrl}/api/query`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "SELECT * FROM sales LIMIT 10" }),
      connections: 20,
      duration,
    },
  },
  {
    id: "schema_get",
    title: "GET /api/schema",
    options: {
      url: `${baseUrl}/api/schema`,
      method: "GET",
      connections: 20,
      duration,
    },
  },
  {
    id: "chat_stream",
    title: "POST /api/chat",
    options: {
      url: `${baseUrl}/api/chat`,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        threadId: "load-baseline",
        messages: [{ role: "user", content: "show schema" }],
      }),
      connections: 10,
      duration,
    },
  },
];

function runScenario(scenario) {
  return new Promise((resolve, reject) => {
    autocannon(scenario.options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function withCommonHeaders(options) {
  const headers = { ...(options.headers || {}) };
  if (loadApiKey) {
    headers["x-api-key"] = loadApiKey;
  }

  if (Object.keys(headers).length === 0) {
    return options;
  }

  return {
    ...options,
    headers,
  };
}

function metricValue(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function toSummary(id, title, result) {
  const latencyP95 = result.latency.p95 ?? result.latency.p97_5 ?? result.latency.p99;

  return {
    id,
    title,
    requestsPerSecAvg: metricValue(result.requests.average),
    requestsPerSecP97_5: metricValue(result.requests.p97_5),
    latencyP95Ms: metricValue(latencyP95),
    latencyP99Ms: metricValue(result.latency.p99),
    latencyAvgMs: metricValue(result.latency.average),
    throughputBytesPerSec: metricValue(result.throughput.average),
    errors: metricValue(result.errors),
    timeouts: metricValue(result.timeouts),
    non2xx: metricValue(result.non2xx),
  };
}

function asMarkdown(base, seconds, rows) {
  const header = [
    "# Load Test Baseline Report",
    "",
    `- Base URL: ${base}`,
    `- Duration per scenario: ${seconds}s`,
    `- Executed at: ${new Date().toISOString()}`,
    "",
    "| Scenario | RPS Avg | P95 Latency (ms) | P99 Latency (ms) | Non-2xx | Errors | Timeouts |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];

  const lines = rows.map((row) =>
    `| ${row.title} | ${row.requestsPerSecAvg.toFixed(2)} | ${row.latencyP95Ms.toFixed(2)} | ${row.latencyP99Ms.toFixed(2)} | ${row.non2xx} | ${row.errors} | ${row.timeouts} |`
  );

  const notes = [
    "",
    "## Interpretation",
    "",
    "- This baseline is intended for regression tracking before and after tuning changes.",
    "- Watch for increasing P95/P99 latency and non-2xx responses between runs.",
    "",
  ];

  return [...header, ...lines, ...notes].join("\n");
}

async function main() {
  const summaries = [];

  for (const scenario of scenarios) {
    const result = await runScenario({
      ...scenario,
      options: withCommonHeaders(scenario.options),
    });
    summaries.push(toSummary(scenario.id, scenario.title, result));
  }

  const outputDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "load-test-baseline.json");
  const mdPath = path.join(outputDir, "load-test-baseline.md");

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        baseUrl,
        duration,
        generatedAt: new Date().toISOString(),
        summaries,
      },
      null,
      2
    )
  );

  fs.writeFileSync(mdPath, asMarkdown(baseUrl, duration, summaries));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error("Load baseline failed:", error);
  process.exitCode = 1;
});
