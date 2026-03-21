/**
 * Slack Integration Types
 */

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  appId: string;
}

export interface SlackMessage {
  text: string;
  channel: string;
  userId: string;
  threadTs?: string;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text?: string;
    action_id?: string;
    value?: string;
  }>;
  block_id?: string;
}

export interface SlackResponse {
  text: string;
  blocks?: SlackBlock[];
  imageUrl?: string;
}

export interface SlackEvent {
  type: string;
  event?: {
    type: string;
    text: string;
    channel: string;
    user: string;
    ts: string;
    thread_ts?: string;
  };
  challenge?: string;
  token?: string;
  event_id?: string;
}

export interface SlackSlashCommand {
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  user_id: string;
  user_name: string;
  channel_id: string;
  channel_name: string;
  team_id: string;
}
