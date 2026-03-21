/**
 * Slack OAuth Utilities
 *
 * Handles Slack OAuth install URL generation, code exchange,
 * and token storage in the working database.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const WORKING_DB_DIR = path.join(process.cwd(), 'data');
const WORKING_DB_PATH = path.join(WORKING_DB_DIR, 'working.db');

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || '';
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const SCOPES = ['chat:write', 'commands', 'app_mentions:read', 'channels:history'];

function getDb(): Database.Database {
  if (!fs.existsSync(WORKING_DB_DIR)) {
    fs.mkdirSync(WORKING_DB_DIR, { recursive: true });
  }

  const db = new Database(WORKING_DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS slack_installations (
      team_id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      bot_token TEXT NOT NULL,
      installed_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

/**
 * Generate the Slack OAuth install URL that redirects users to Slack's authorization page.
 */
export function getSlackInstallUrl(): string {
  const redirectUri = `${APP_URL}/api/slack/oauth?action=callback`;

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: SCOPES.join(','),
    redirect_uri: redirectUri,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for a bot access token via Slack's OAuth API.
 */
export async function exchangeCodeForToken(
  code: string
): Promise<{ botToken: string; teamId: string; teamName: string }> {
  const redirectUri = `${APP_URL}/api/slack/oauth?action=callback`;

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'Unknown error'}`);
  }

  const botToken = data.access_token as string;
  const teamId = data.team?.id as string;
  const teamName = (data.team?.name as string) || 'Unknown Team';

  // Store the installation in the database
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO slack_installations (team_id, team_name, bot_token)
      VALUES (?, ?, ?)
      ON CONFLICT(team_id) DO UPDATE SET
        team_name = excluded.team_name,
        bot_token = excluded.bot_token,
        updated_at = datetime('now')
    `).run(teamId, teamName, botToken);
  } finally {
    db.close();
  }

  return { botToken, teamId, teamName };
}

/**
 * Retrieve a stored Slack bot token from the database.
 * If teamId is provided, returns the token for that specific team.
 * Otherwise, returns the most recently installed token.
 */
export function getStoredSlackToken(teamId?: string): string | null {
  const db = getDb();
  try {
    let row: { bot_token: string } | undefined;

    if (teamId) {
      row = db
        .prepare('SELECT bot_token FROM slack_installations WHERE team_id = ?')
        .get(teamId) as { bot_token: string } | undefined;
    } else {
      row = db
        .prepare('SELECT bot_token FROM slack_installations ORDER BY updated_at DESC LIMIT 1')
        .get() as { bot_token: string } | undefined;
    }

    return row?.bot_token || null;
  } finally {
    db.close();
  }
}
