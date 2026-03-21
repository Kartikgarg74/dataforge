export type ScheduleType = 'report' | 'alert' | 'digest';

export interface Schedule {
  id: string;
  teamId: string;
  name: string;
  type: ScheduleType;
  sourceType: 'dashboard' | 'query';
  sourceId: string;
  cronExpression: string;
  timezone: string;
  channels: ScheduleChannels;
  alertConfig?: AlertConfig;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: 'success' | 'failed' | 'partial';
  nextRunAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface ScheduleChannels {
  email?: { recipients: string[] };
  slack?: { webhookUrl: string };
  webhook?: { url: string; headers?: Record<string, string> };
}

export interface AlertConfig {
  condition: 'gt' | 'lt' | 'eq' | 'change_pct';
  threshold: number;
  column: string;
}

export interface ScheduleRun {
  id: string;
  scheduleId: string;
  status: 'success' | 'failed' | 'partial';
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  deliveryResults?: Record<string, unknown>;
}
