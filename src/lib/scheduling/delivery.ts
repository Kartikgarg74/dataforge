/**
 * Scheduled Report Delivery
 *
 * Handles delivery of scheduled reports and alerts across multiple
 * channels: email, Slack, and generic webhooks.
 */

import type { Schedule, ScheduleChannels } from './types';

/**
 * Deliver an email using nodemailer (lazy-loaded).
 * Falls back to logging if SMTP is not configured.
 */
export async function deliverEmail(
  recipients: string[],
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'dataforge@localhost';

  if (!smtpHost) {
    console.warn(
      '[delivery] SMTP not configured. Would send email to:',
      recipients.join(', '),
      'Subject:',
      subject
    );
    return false;
  }

  try {
    // Dynamic import so nodemailer is not required at build time
    const moduleName = 'nodemailer';
    const nodemailer = await import(/* webpackIgnore: true */ moduleName);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '587', 10),
      secure: smtpPort === '465',
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: recipients.join(', '),
      subject,
      html: htmlBody,
    });

    return true;
  } catch (error) {
    console.error('[delivery] Email delivery failed:', error);
    return false;
  }
}

/**
 * Deliver a message to a Slack incoming webhook URL.
 */
export async function deliverSlack(
  webhookUrl: string,
  message: { text: string; blocks?: unknown[] }
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error(
        '[delivery] Slack webhook failed:',
        response.status,
        await response.text()
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('[delivery] Slack delivery failed:', error);
    return false;
  }
}

/**
 * Deliver a JSON payload to a generic webhook URL with retry logic.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 */
export async function deliverWebhook(
  url: string,
  payload: unknown,
  headers?: Record<string, string>
): Promise<boolean> {
  const maxAttempts = 3;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return true;
      }

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(
          `[delivery] Webhook returned ${response.status}, not retrying:`,
          await response.text()
        );
        return false;
      }

      console.warn(
        `[delivery] Webhook attempt ${attempt}/${maxAttempts} failed: ${response.status}`
      );
    } catch (error) {
      console.warn(
        `[delivery] Webhook attempt ${attempt}/${maxAttempts} error:`,
        error instanceof Error ? error.message : error
      );
    }

    // Exponential backoff before retry
    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(`[delivery] Webhook delivery failed after ${maxAttempts} attempts: ${url}`);
  return false;
}

/**
 * Orchestrate delivery of a scheduled report across all configured channels.
 *
 * Returns the overall success status and per-channel results.
 */
export async function deliverScheduledReport(
  schedule: Schedule
): Promise<{ success: boolean; results: Record<string, boolean> }> {
  const { channels } = schedule;
  const results: Record<string, boolean> = {};

  const reportSubject = `[DataForge] Scheduled Report: ${schedule.name}`;
  const reportText = `Scheduled report "${schedule.name}" (${schedule.type}) for ${schedule.sourceType} "${schedule.sourceId}" has been generated.`;

  const htmlBody = `
    <h2>DataForge Scheduled Report</h2>
    <p><strong>Report:</strong> ${schedule.name}</p>
    <p><strong>Type:</strong> ${schedule.type}</p>
    <p><strong>Source:</strong> ${schedule.sourceType} — ${schedule.sourceId}</p>
    <p><strong>Generated at:</strong> ${new Date().toISOString()}</p>
    <hr>
    <p>View the full report in <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}">DataForge</a>.</p>
  `;

  // Deliver to all configured channels in parallel
  const deliveries: Promise<void>[] = [];

  if (channels.email?.recipients?.length) {
    deliveries.push(
      deliverEmail(channels.email.recipients, reportSubject, htmlBody).then((ok) => {
        results['email'] = ok;
      })
    );
  }

  if (channels.slack?.webhookUrl) {
    deliveries.push(
      deliverSlack(channels.slack.webhookUrl, {
        text: reportText,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `Report: ${schedule.name}` },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Type:* ${schedule.type}\n*Source:* ${schedule.sourceType} — ${schedule.sourceId}\n*Generated:* ${new Date().toISOString()}`,
            },
          },
        ],
      }).then((ok) => {
        results['slack'] = ok;
      })
    );
  }

  if (channels.webhook?.url) {
    deliveries.push(
      deliverWebhook(
        channels.webhook.url,
        {
          event: 'scheduled_report',
          schedule: {
            id: schedule.id,
            name: schedule.name,
            type: schedule.type,
            sourceType: schedule.sourceType,
            sourceId: schedule.sourceId,
          },
          generatedAt: new Date().toISOString(),
        },
        channels.webhook.headers
      ).then((ok) => {
        results['webhook'] = ok;
      })
    );
  }

  await Promise.all(deliveries);

  // Overall success: at least one channel succeeded, or no channels configured
  const channelResults = Object.values(results);
  const success = channelResults.length === 0 || channelResults.some((r) => r);

  return { success, results };
}
