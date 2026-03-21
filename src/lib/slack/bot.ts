/**
 * Slack Bot Logic
 *
 * Handles Slack events and formats responses using Block Kit.
 * Integrates with the NL-to-SQL pipeline for query processing.
 */

import crypto from 'crypto';
import type { SlackEvent, SlackResponse, SlackBlock } from './types';

/**
 * Handle a Slack event (message or app_mention) by extracting the query
 * text and returning a formatted response.
 *
 * The caller is responsible for actually sending the NL-to-SQL query;
 * this function extracts the relevant text and delegates formatting.
 */
export async function handleSlackEvent(event: SlackEvent): Promise<SlackResponse> {
  if (!event.event) {
    return { text: 'No event payload received.' };
  }

  const { type, text } = event.event;

  if (type !== 'message' && type !== 'app_mention') {
    return { text: `Unsupported event type: ${type}` };
  }

  // Strip bot mention from the text (e.g. "<@U123BOT> show me sales")
  const query = text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (!query) {
    return {
      text: "Hi! Ask me a data question and I'll query the database for you. For example: _\"What are the top 10 customers by revenue?\"_",
    };
  }

  // Return the extracted query so the API route can run it through the pipeline
  return {
    text: `Processing query: ${query}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:mag: *Processing your query...*\n>${query}`,
        },
      },
    ],
  };
}

/**
 * Format query results for Slack using Block Kit.
 *
 * Renders a data table as monospaced text since Slack does not support
 * native chart rendering.
 */
export function formatSlackResponse(
  data: Record<string, unknown>[],
  columns: string[],
  chartType?: string
): SlackResponse {
  if (!data || data.length === 0) {
    return {
      text: 'Query returned no results.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':warning: Query returned no results.',
          },
        },
      ],
    };
  }

  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `:white_check_mark: *Query Results* (${data.length} row${data.length !== 1 ? 's' : ''})`,
    },
  });

  // Build text table
  const maxRows = 20; // Slack has message size limits
  const displayData = data.slice(0, maxRows);

  // Calculate column widths
  const colWidths = columns.map((col) => {
    const maxDataWidth = displayData.reduce((max, row) => {
      const val = String(row[col] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.min(Math.max(col.length, maxDataWidth), 30);
  });

  // Header row
  const headerLine = columns
    .map((col, i) => col.padEnd(colWidths[i]))
    .join(' | ');
  const separatorLine = colWidths.map((w) => '-'.repeat(w)).join('-+-');

  // Data rows
  const dataLines = displayData.map((row) =>
    columns
      .map((col, i) => {
        const val = String(row[col] ?? '');
        return val.length > 30 ? val.slice(0, 27) + '...' : val.padEnd(colWidths[i]);
      })
      .join(' | ')
  );

  const tableText = [headerLine, separatorLine, ...dataLines].join('\n');

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '```\n' + tableText + '\n```',
    },
  });

  // Truncation notice
  if (data.length > maxRows) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `_Showing ${maxRows} of ${data.length} rows._`,
      },
    });
  }

  // Chart type hint
  if (chartType) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:bar_chart: Suggested visualization: *${chartType}* (open in DataForge to view chart)`,
      },
    });
  }

  blocks.push({ type: 'divider' } as SlackBlock);

  return {
    text: `Query returned ${data.length} result${data.length !== 1 ? 's' : ''}.`,
    blocks,
  };
}

/**
 * Verify a Slack request signature using HMAC-SHA256.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(
  headers: { 'x-slack-signature'?: string; 'x-slack-request-timestamp'?: string },
  body: string,
  signingSecret: string
): boolean {
  const signature = headers['x-slack-signature'];
  const timestamp = headers['x-slack-request-timestamp'];

  if (!signature || !timestamp) {
    return false;
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(sigBaseString);
  const computed = `v0=${hmac.digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf-8'),
      Buffer.from(computed, 'utf-8')
    );
  } catch {
    return false;
  }
}
