import { describe, it, expect } from 'vitest';
import type { ShareAccessType, Share } from '../../src/lib/sharing/types';

describe('Sharing types', () => {
  it('ShareAccessType includes public', () => {
    const t: ShareAccessType = 'public';
    expect(t).toBe('public');
  });

  it('ShareAccessType includes password', () => {
    const t: ShareAccessType = 'password';
    expect(t).toBe('password');
  });

  it('ShareAccessType includes team', () => {
    const t: ShareAccessType = 'team';
    expect(t).toBe('team');
  });

  it('ShareAccessType includes allowlist', () => {
    const t: ShareAccessType = 'allowlist';
    expect(t).toBe('allowlist');
  });

  it('Share interface can be constructed with all access types', () => {
    const share: Share = {
      id: 's1',
      teamId: 't1',
      resourceType: 'dashboard',
      resourceId: 'r1',
      slug: 'my-share',
      accessType: 'public',
      viewCount: 0,
      createdBy: 'u1',
      createdAt: '2024-01-01',
    };
    expect(share.accessType).toBe('public');
  });
});
