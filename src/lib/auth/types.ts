export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  teamId: string;
  email: string;
  name?: string;
  role: UserRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface Session {
  user: User;
  teamId: string;
  role: UserRole;
}
