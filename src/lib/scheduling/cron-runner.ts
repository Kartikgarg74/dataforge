/**
 * In-Process Cron Runner
 *
 * Simple setInterval-based cron runner for scheduled reports.
 * Uses no external dependencies (no BullMQ/Redis).
 * Checks enabled schedules every 60 seconds and fires matched ones.
 */

import Database from 'better-sqlite3';
import path from 'path';
import type { Schedule } from './types';
import { renderWidgetToHTML } from './chart-renderer';
import { generateReportEmail } from './email-template';
import { deliverScheduledReport } from './delivery';
import type { WidgetType, VisualizationConfig } from '@/lib/dashboard/types';

const WORKING_DB_PATH = path.join(process.cwd(), 'data', 'working.db');
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the in-process cron runner.
 * Checks every 60 seconds for schedules that should fire.
 */
export function startCronRunner(): void {
  if (intervalHandle) {
    console.warn('[cron-runner] Already running, skipping duplicate start');
    return;
  }

  console.log('[cron-runner] Starting cron runner (60s check interval)');

  intervalHandle = setInterval(async () => {
    try {
      await checkAndRunSchedules();
    } catch (err) {
      console.error('[cron-runner] Error checking schedules:', err);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the in-process cron runner.
 */
export function stopCronRunner(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[cron-runner] Stopped');
  }
}

/**
 * Parse a cron expression into its component parts.
 * Supports standard 5-field cron: minute hour dayOfMonth month dayOfWeek
 *
 * Each field can be:
 *   - '*'      (any value)
 *   - number   (exact match)
 *   - 'x/n'    (step: every n starting at x, or * /n)
 *   - 'x-y'    (range)
 *   - 'x,y,z'  (list)
 */
export function parseCronExpression(cron: string): {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} {
  const parts = cron.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

/**
 * Check whether a cron expression matches the given date/time.
 */
export function shouldRunNow(cron: string, now: Date): boolean {
  try {
    const parsed = parseCronExpression(cron);

    return (
      matchesField(parsed.minute, now.getMinutes()) &&
      matchesField(parsed.hour, now.getHours()) &&
      matchesField(parsed.dayOfMonth, now.getDate()) &&
      matchesField(parsed.month, now.getMonth() + 1) &&
      matchesField(parsed.dayOfWeek, now.getDay())
    );
  } catch {
    return false;
  }
}

/**
 * Match a single cron field against a value.
 */
function matchesField(field: string, value: number): boolean {
  // Wildcard
  if (field === '*') return true;

  // List (comma-separated)
  if (field.includes(',')) {
    return field.split(',').some((part) => matchesField(part.trim(), value));
  }

  // Step (*/n or x/n)
  if (field.includes('/')) {
    const [base, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;

    if (base === '*') {
      return value % step === 0;
    }

    const start = parseInt(base, 10);
    if (isNaN(start)) return false;
    return value >= start && (value - start) % step === 0;
  }

  // Range (x-y)
  if (field.includes('-')) {
    const [minStr, maxStr] = field.split('-');
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    if (isNaN(min) || isNaN(max)) return false;
    return value >= min && value <= max;
  }

  // Exact number
  const exact = parseInt(field, 10);
  if (isNaN(exact)) return false;
  return value === exact;
}

/**
 * Check all enabled schedules and run any that are due.
 */
async function checkAndRunSchedules(): Promise<void> {
  const now = new Date();
  let db: Database.Database;

  try {
    db = new Database(WORKING_DB_PATH);
    db.pragma('journal_mode = WAL');
  } catch {
    // Database may not exist yet
    return;
  }

  try {
    // Get all enabled schedules
    const rows = db
      .prepare('SELECT * FROM schedules WHERE enabled = 1')
      .all() as Array<Record<string, unknown>>;

    for (const row of rows) {
      const cronExpr = row.cron_expression as string;
      const timezone = (row.timezone as string) || 'UTC';

      // Convert current time to the schedule's timezone before comparing.
      // Uses Intl.DateTimeFormat.formatToParts which correctly handles DST transitions.
      let adjustedNow = now;
      try {
        // Validate timezone first
        Intl.DateTimeFormat('en-US', { timeZone: timezone });

        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          weekday: 'short',
        });
        const parts = formatter.formatToParts(now);
        const get = (type: string) => {
          const val = parts.find(p => p.type === type)?.value || '0';
          return parseInt(val, 10);
        };
        // Construct a Date representing "what the clock reads" in the target timezone.
        // This is only used for cron field matching (minute, hour, day), not for any
        // date arithmetic, so DST edge cases (skipped/repeated hours) are acceptable —
        // the cron will simply skip or double-fire at worst, which is standard cron behavior.
        adjustedNow = new Date(
          get('year'), get('month') - 1, get('day'),
          get('hour'), get('minute'), get('second')
        );
      } catch {
        // If timezone is invalid, fall back to UTC
        console.warn(`[cron-runner] Invalid timezone '${timezone}', falling back to UTC`);
      }

      if (!shouldRunNow(cronExpr, adjustedNow)) {
        continue;
      }

      const schedule = mapRowToSchedule(row);
      await executeSchedule(schedule, db);
    }
  } catch (err) {
    console.error('[cron-runner] Schedule check error:', err);
  } finally {
    db.close();
  }
}

/**
 * Execute a single schedule: query data, render, deliver, and log.
 */
async function executeSchedule(
  schedule: Schedule,
  db: Database.Database
): Promise<void> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  console.log(`[cron-runner] Firing schedule "${schedule.name}" (${schedule.id})`);

  // Insert a run record
  db.prepare(
    'INSERT INTO schedule_runs (id, schedule_id, status, started_at) VALUES (?, ?, ?, ?)'
  ).run(runId, schedule.id, 'running', startedAt);

  try {
    // Get the dashboard/query data
    const widgetResults = await fetchWidgetData(schedule, db);

    // For digest type, compare current values to previous run's values
    let digestSummary = '';
    if (schedule.type === 'digest') {
      digestSummary = buildDigestSummary(schedule, widgetResults, db);
    }

    // Build email HTML
    let emailHtml = buildReportEmailForSchedule(schedule, widgetResults);

    // Append digest summary if available
    if (digestSummary) {
      emailHtml = emailHtml.replace(
        '</body>',
        `<div style="margin:20px;padding:16px;background:#f8f9fa;border-radius:8px;font-family:sans-serif;">
          <h3 style="margin:0 0 12px;color:#333;">Changes Since Last Run</h3>
          ${digestSummary}
        </div></body>`
      );
    }

    // Deliver using the existing delivery infrastructure
    // Override the basic HTML in deliverScheduledReport by patching the schedule with rich content
    const { success, results } = await deliverScheduledReportWithContent(
      schedule,
      emailHtml
    );

    const status = success ? 'success' : 'failed';

    // Update the run record
    db.prepare(
      'UPDATE schedule_runs SET status = ?, completed_at = ?, delivery_results = ? WHERE id = ?'
    ).run(status, new Date().toISOString(), JSON.stringify(results), runId);

    // Update last run time on the schedule
    db.prepare(
      'UPDATE schedules SET last_run_at = ?, last_status = ? WHERE id = ?'
    ).run(new Date().toISOString(), status, schedule.id);

    console.log(`[cron-runner] Schedule "${schedule.name}" completed: ${status}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[cron-runner] Schedule "${schedule.name}" failed:`, errorMessage);

    db.prepare(
      'UPDATE schedule_runs SET status = ?, completed_at = ?, error_message = ? WHERE id = ?'
    ).run('failed', new Date().toISOString(), errorMessage, runId);

    db.prepare(
      'UPDATE schedules SET last_run_at = ?, last_status = ? WHERE id = ?'
    ).run(new Date().toISOString(), 'failed', schedule.id);
  }
}

/**
 * Fetch widget data for a schedule's source (dashboard or query).
 */
async function fetchWidgetData(
  schedule: Schedule,
  db: Database.Database
): Promise<
  Array<{
    title: string;
    type: WidgetType;
    visualization: Partial<VisualizationConfig>;
    data: Record<string, unknown>[];
    columns: string[];
  }>
> {
  if (schedule.sourceType === 'dashboard') {
    // Get dashboard widgets
    const widgets = db
      .prepare(
        'SELECT * FROM dashboard_widgets WHERE dashboard_id = ? ORDER BY sort_order'
      )
      .all(schedule.sourceId) as Array<Record<string, unknown>>;

    const results: Array<{
      title: string;
      type: WidgetType;
      visualization: Partial<VisualizationConfig>;
      data: Record<string, unknown>[];
      columns: string[];
    }> = [];

    for (const widget of widgets) {
      const sql = widget.query_sql as string;

      try {
        // Execute the query via the internal API
        const queryResult = await executeQueryInternal(sql);
        const viz = JSON.parse((widget.visualization as string) || '{}');

        results.push({
          title: widget.title as string,
          type: widget.widget_type as WidgetType,
          visualization: viz,
          data: queryResult.results,
          columns: queryResult.columns,
        });
      } catch (err) {
        console.warn(
          `[cron-runner] Widget "${widget.title}" query failed:`,
          err instanceof Error ? err.message : err
        );

        results.push({
          title: widget.title as string,
          type: widget.widget_type as WidgetType,
          visualization: {},
          data: [],
          columns: [],
        });
      }
    }

    return results;
  }

  // Single query source
  const queryRow = db
    .prepare('SELECT * FROM saved_queries WHERE id = ?')
    .get(schedule.sourceId) as Record<string, unknown> | undefined;

  if (!queryRow) {
    throw new Error(`Source query not found: ${schedule.sourceId}`);
  }

  const sql = queryRow.sql as string;
  const queryResult = await executeQueryInternal(sql);
  const viz = queryRow.visualization
    ? JSON.parse(queryRow.visualization as string)
    : {};

  return [
    {
      title: (queryRow.name as string) || 'Query Result',
      type: (viz.chartType as WidgetType) || 'table',
      visualization: viz,
      data: queryResult.results,
      columns: queryResult.columns,
    },
  ];
}

/**
 * Execute a SQL query using the internal API endpoint.
 */
async function executeQueryInternal(
  sql: string
): Promise<{ results: Record<string, unknown>[]; columns: string[] }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const response = await fetch(`${appUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Query execution failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return {
    results: data.results || [],
    columns: data.columns || [],
  };
}

/**
 * Build a rich email report for a schedule using the email template.
 */
function buildReportEmailForSchedule(
  schedule: Schedule,
  widgetResults: Array<{
    title: string;
    type: WidgetType;
    visualization: Partial<VisualizationConfig>;
    data: Record<string, unknown>[];
    columns: string[];
  }>
): string {
  const widgets = widgetResults.map((wr) => ({
    title: wr.title,
    type: wr.type,
    htmlContent: renderWidgetToHTML(wr.type, wr.data, wr.visualization),
  }));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return generateReportEmail({
    teamName: schedule.teamId || 'DataForge',
    dashboardName: schedule.name,
    widgets,
    baseUrl,
    dashboardId: schedule.sourceType === 'dashboard' ? schedule.sourceId : undefined,
    scheduleId: schedule.id,
  });
}

/**
 * Deliver a scheduled report with pre-rendered HTML content.
 * Uses the existing delivery module but with the rich email HTML.
 */
async function deliverScheduledReportWithContent(
  schedule: Schedule,
  emailHtml: string
): Promise<{ success: boolean; results: Record<string, boolean> }> {
  // Import delivery functions dynamically to avoid circular deps
  const { deliverEmail, deliverSlack, deliverWebhook } = await import('./delivery');

  const results: Record<string, boolean> = {};
  const deliveries: Promise<void>[] = [];

  const reportSubject = `[DataForge] ${schedule.name} - ${new Date().toLocaleDateString()}`;

  if (schedule.channels.email?.recipients?.length) {
    deliveries.push(
      deliverEmail(schedule.channels.email.recipients, reportSubject, emailHtml).then(
        (ok) => {
          results['email'] = ok;
        }
      )
    );
  }

  if (schedule.channels.slack?.webhookUrl) {
    deliveries.push(
      deliverSlack(schedule.channels.slack.webhookUrl, {
        text: `Scheduled report: ${schedule.name}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `Report: ${schedule.name}` },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Scheduled report generated at ${new Date().toISOString()}\nView the full report in DataForge.`,
            },
          },
        ],
      }).then((ok) => {
        results['slack'] = ok;
      })
    );
  }

  if (schedule.channels.webhook?.url) {
    deliveries.push(
      deliverWebhook(
        schedule.channels.webhook.url,
        {
          event: 'scheduled_report',
          schedule: {
            id: schedule.id,
            name: schedule.name,
            type: schedule.type,
          },
          generatedAt: new Date().toISOString(),
        },
        schedule.channels.webhook.headers
      ).then((ok) => {
        results['webhook'] = ok;
      })
    );
  }

  await Promise.all(deliveries);

  const channelResults = Object.values(results);
  const success = channelResults.length === 0 || channelResults.some((r) => r);

  return { success, results };
}

/**
 * Build a digest summary comparing current metric values to previous run values.
 */
function buildDigestSummary(
  schedule: Schedule,
  widgetResults: Array<{
    title: string;
    type: WidgetType;
    visualization: Partial<VisualizationConfig>;
    data: Record<string, unknown>[];
    columns: string[];
  }>,
  db: Database.Database
): string {
  // Load previous run's snapshot if available
  let previousSnapshot: Record<string, unknown> | null = null;
  try {
    const prevRun = db
      .prepare(
        "SELECT delivery_results FROM schedule_runs WHERE schedule_id = ? AND status = 'success' ORDER BY started_at DESC LIMIT 1 OFFSET 1"
      )
      .get(schedule.id) as { delivery_results: string } | undefined;

    if (prevRun?.delivery_results) {
      const parsed = JSON.parse(prevRun.delivery_results);
      if (parsed._digest_snapshot) {
        previousSnapshot = parsed._digest_snapshot;
      }
    }
  } catch {
    // No previous snapshot available
  }

  // Extract current key metrics from widget results
  const currentSnapshot: Record<string, unknown> = {};
  const changes: Array<{ metric: string; current: number; previous: number; changePct: number }> = [];

  for (const widget of widgetResults) {
    if (widget.data.length > 0) {
      const firstRow = widget.data[0];
      for (const col of widget.columns) {
        const val = firstRow[col];
        if (typeof val === 'number') {
          const key = `${widget.title}::${col}`;
          currentSnapshot[key] = val;

          if (previousSnapshot && typeof previousSnapshot[key] === 'number') {
            const prevVal = previousSnapshot[key] as number;
            const changePct = prevVal !== 0
              ? Math.round(((val - prevVal) / Math.abs(prevVal)) * 10000) / 100
              : 0;

            if (changePct !== 0) {
              changes.push({
                metric: `${widget.title} - ${col}`,
                current: val,
                previous: prevVal,
                changePct,
              });
            }
          }
        }
      }
    }
  }

  // Store current snapshot in the run's delivery_results for next comparison
  try {
    const latestRun = db
      .prepare(
        "SELECT id, delivery_results FROM schedule_runs WHERE schedule_id = ? ORDER BY started_at DESC LIMIT 1"
      )
      .get(schedule.id) as { id: string; delivery_results: string | null } | undefined;

    if (latestRun) {
      const existingResults = latestRun.delivery_results
        ? JSON.parse(latestRun.delivery_results)
        : {};
      existingResults._digest_snapshot = currentSnapshot;
      db.prepare('UPDATE schedule_runs SET delivery_results = ? WHERE id = ?').run(
        JSON.stringify(existingResults),
        latestRun.id
      );
    }
  } catch {
    // Non-critical: snapshot storage failed
  }

  if (changes.length === 0) {
    return '<p style="color:#666;margin:0;">No significant changes detected since last run.</p>';
  }

  const rows = changes
    .map((c) => {
      const color = c.changePct > 0 ? '#16a34a' : '#dc2626';
      const arrow = c.changePct > 0 ? '&#9650;' : '&#9660;';
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${c.metric}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${c.previous.toLocaleString()}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;">${c.current.toLocaleString()}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #eee;color:${color};font-weight:600;">${arrow} ${c.changePct > 0 ? '+' : ''}${c.changePct}%</td>
      </tr>`;
    })
    .join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="padding:8px 12px;text-align:left;">Metric</th>
        <th style="padding:8px 12px;text-align:left;">Previous</th>
        <th style="padding:8px 12px;text-align:left;">Current</th>
        <th style="padding:8px 12px;text-align:left;">Change</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function mapRowToSchedule(row: Record<string, unknown>): Schedule {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    name: row.name as string,
    type: row.type as 'report' | 'alert' | 'digest',
    sourceType: row.source_type as 'dashboard' | 'query',
    sourceId: row.source_id as string,
    cronExpression: row.cron_expression as string,
    timezone: row.timezone as string,
    channels: JSON.parse((row.channels as string) || '{}'),
    alertConfig: row.alert_config
      ? JSON.parse(row.alert_config as string)
      : undefined,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at as string | undefined,
    lastStatus: row.last_status as 'success' | 'failed' | 'partial' | undefined,
    nextRunAt: row.next_run_at as string | undefined,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}
