/**
 * Slack Slash Commands API Endpoint
 *
 * POST /api/slack/commands
 * Handles the /dataforge slash command with subcommands:
 *   - query <natural language question>
 *   - dashboard <dashboard-id>
 *   - help
 */

import { NextResponse } from 'next/server';
import { verifySlackRequest, formatSlackResponse } from '@/lib/slack';
import type { SlackBlock } from '@/lib/slack';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';

function buildHelpResponse(): { text: string; blocks: SlackBlock[] } {
  return {
    text: 'DataForge Slash Command Help',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'DataForge Commands',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '*`/dataforge query <question>`*',
            'Ask a natural language question about your data.',
            '_Example: `/dataforge query What are the top 10 products by revenue?`_',
            '',
            '*`/dataforge dashboard <id>`*',
            'Get a summary of a specific dashboard.',
            '_Example: `/dataforge dashboard abc123`_',
            '',
            '*`/dataforge help`*',
            'Show this help message.',
          ].join('\n'),
        },
      },
    ],
  };
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

    // Parse URL-encoded form data from Slack
    const params = new URLSearchParams(rawBody);
    const commandText = params.get('text')?.trim() || '';
    const channelId = params.get('channel_id') || '';
    const userId = params.get('user_id') || '';

    // Parse subcommand
    const spaceIndex = commandText.indexOf(' ');
    const subcommand = spaceIndex === -1 ? commandText : commandText.slice(0, spaceIndex);
    const args = spaceIndex === -1 ? '' : commandText.slice(spaceIndex + 1).trim();

    switch (subcommand.toLowerCase()) {
      case 'query': {
        if (!args) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: 'Please provide a question. Example: `/dataforge query What are the top products?`',
          });
        }

        // In a full implementation, this would call the NL-to-SQL pipeline,
        // execute the query, and format results. For now, acknowledge and
        // indicate the query is being processed.
        return NextResponse.json({
          response_type: 'in_channel',
          text: `Processing query from <@${userId}>: "${args}"`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:mag: <@${userId}> asked: *${args}*`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: ':hourglass_flowing_sand: Processing query...',
              },
            },
          ],
        });
      }

      case 'dashboard': {
        if (!args) {
          return NextResponse.json({
            response_type: 'ephemeral',
            text: 'Please provide a dashboard ID. Example: `/dataforge dashboard abc123`',
          });
        }

        return NextResponse.json({
          response_type: 'ephemeral',
          text: `Fetching dashboard: ${args}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:chart_with_upwards_trend: Loading dashboard *${args}*...`,
              },
            },
          ],
        });
      }

      case 'help':
      case '': {
        const help = buildHelpResponse();
        return NextResponse.json({
          response_type: 'ephemeral',
          ...help,
        });
      }

      default: {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: `Unknown subcommand: "${subcommand}". Type \`/dataforge help\` for available commands.`,
        });
      }
    }
  } catch (error) {
    console.error('Slack commands endpoint error:', error);
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Something went wrong processing your command. Please try again.',
    });
  }
}
