/**
 * Slack Events API Endpoint
 *
 * POST /api/slack/events
 * Handles Slack event subscriptions including URL verification
 * and app_mention events. Responds within 3 seconds per Slack requirements.
 */

import { NextResponse } from 'next/server';
import { handleSlackEvent, verifySlackRequest, formatSlackResponse } from '@/lib/slack';
import type { SlackEvent } from '@/lib/slack';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

/**
 * Post a message to a Slack channel via the Web API.
 */
async function postSlackMessage(
  channel: string,
  text: string,
  blocks?: unknown[],
  threadTs?: string
): Promise<void> {
  if (!SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not configured, skipping message post');
    return;
  }

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    // Verify request signature
    if (SLACK_SIGNING_SECRET) {
      const isValid = verifySlackRequest(
        {
          'x-slack-signature': request.headers.get('x-slack-signature') || undefined,
          'x-slack-request-timestamp': request.headers.get('x-slack-request-timestamp') || undefined,
        },
        rawBody,
        SLACK_SIGNING_SECRET
      );

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body: SlackEvent = JSON.parse(rawBody);

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification' && body.challenge) {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Handle event callbacks
    if (body.type === 'event_callback' && body.event) {
      const { type, channel, thread_ts, ts } = body.event;

      if (type === 'app_mention' || type === 'message') {
        // Acknowledge immediately (Slack requires response within 3 seconds)
        // Process asynchronously by firing off the handler
        const responsePromise = handleSlackEvent(body);

        // We respond to Slack immediately with 200
        // and handle the actual query processing in the background
        responsePromise.then(async (slackResponse) => {
          // For a full implementation, this would run the query through
          // the NL-to-SQL pipeline and format results. For now, send
          // the acknowledgement.
          await postSlackMessage(
            channel,
            slackResponse.text,
            slackResponse.blocks,
            thread_ts || ts
          );
        }).catch((err) => {
          console.error('Slack event processing error:', err);
          postSlackMessage(
            channel,
            'Sorry, something went wrong processing your query.',
            undefined,
            thread_ts || ts
          ).catch(console.error);
        });

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack events endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
