export type { User, Team, TeamMember, Session, UserRole } from './types';

export { PERMISSIONS, hasPermission, assertPermission } from './rbac';
export type { Action } from './rbac';

export {
  getSession,
  createSession,
  destroySession,
  buildSessionCookie,
} from './session';

export { withTeamContext } from './team-context';

export {
  setTablePermission,
  getTablePermissions,
  checkTableAccess,
} from './table-permissions';
export type { TableVisibility, TablePermission, TableAccessResult } from './table-permissions';

export {
  getGoogleAuthUrl,
  handleGoogleCallback,
  getGitHubAuthUrl,
  handleGitHubCallback,
} from './sso';
