export type ShareAccessType = 'public' | 'password' | 'team' | 'allowlist';

export interface Share {
  id: string;
  teamId: string;
  resourceType: 'dashboard' | 'query';
  resourceId: string;
  slug: string;
  accessType: ShareAccessType;
  passwordHash?: string;
  allowedEmails?: string[];
  expiresAt?: string;
  maxViews?: number;
  viewCount: number;
  createdBy: string;
  createdAt: string;
}

export interface ShareCreateInput {
  resourceType: 'dashboard' | 'query';
  resourceId: string;
  access: ShareAccessType;
  password?: string;
  allowedEmails?: string[];
  expiresAt?: string;
  maxViews?: number;
}
