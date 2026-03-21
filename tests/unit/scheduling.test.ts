import { describe, it, expect } from 'vitest';
import type { ScheduleType, Schedule } from '../../src/lib/scheduling/types';
import { parseCronExpression } from '../../src/lib/scheduling/cron-runner';

describe('Scheduling types', () => {
  it('ScheduleType includes report', () => {
    const t: ScheduleType = 'report';
    expect(t).toBe('report');
  });

  it('ScheduleType includes alert', () => {
    const t: ScheduleType = 'alert';
    expect(t).toBe('alert');
  });

  it('ScheduleType includes digest', () => {
    const t: ScheduleType = 'digest';
    expect(t).toBe('digest');
  });
});

describe('parseCronExpression', () => {
  it('parses a standard 5-field cron expression', () => {
    const result = parseCronExpression('30 9 * * 1');
    expect(result).toEqual({
      minute: '30',
      hour: '9',
      dayOfMonth: '*',
      month: '*',
      dayOfWeek: '1',
    });
  });

  it('parses all-wildcards expression', () => {
    const result = parseCronExpression('* * * * *');
    expect(result).toEqual({
      minute: '*',
      hour: '*',
      dayOfMonth: '*',
      month: '*',
      dayOfWeek: '*',
    });
  });

  it('throws on invalid cron expression with wrong field count', () => {
    expect(() => parseCronExpression('* * *')).toThrow(/expected 5 fields/);
  });

  it('parses cron expression with step values', () => {
    const result = parseCronExpression('*/5 */2 1 1-6 0,6');
    expect(result).toEqual({
      minute: '*/5',
      hour: '*/2',
      dayOfMonth: '1',
      month: '1-6',
      dayOfWeek: '0,6',
    });
  });
});
