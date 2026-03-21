import { describe, it, expect } from 'vitest';
import type { TablePermission, TableAccessResult, TableVisibility } from '../../src/lib/auth/table-permissions';
import { checkTableAccess } from '../../src/lib/auth/table-permissions';

describe('table-permissions', () => {
  it('exports checkTableAccess as a function', () => {
    expect(typeof checkTableAccess).toBe('function');
  });

  it('checkTableAccess has the expected arity (3 parameters)', () => {
    expect(checkTableAccess.length).toBe(3);
  });

  it('TablePermission type can be used', () => {
    const perm: TablePermission = {
      connectorId: 'c1',
      tableName: 'users',
      visibility: 'visible',
      allowedRoles: ['editor', 'viewer'],
      hiddenColumns: ['password'],
      updatedAt: '2024-01-01',
    };
    expect(perm.connectorId).toBe('c1');
    expect(perm.visibility).toBe('visible');
  });

  it('TableAccessResult type can be used', () => {
    const result: TableAccessResult = {
      allowed: true,
      hiddenColumns: ['secret'],
    };
    expect(result.allowed).toBe(true);
    expect(result.hiddenColumns).toContain('secret');
  });

  it('TableVisibility accepts valid values', () => {
    const visible: TableVisibility = 'visible';
    const hidden: TableVisibility = 'hidden';
    const restricted: TableVisibility = 'restricted';
    expect(visible).toBe('visible');
    expect(hidden).toBe('hidden');
    expect(restricted).toBe('restricted');
  });
});
