import { describe, it, expect } from 'vitest';
import {
  maxRank,
  roleRank,
  assertCanAssignRoles,
  assertCanManageTarget,
  type Actor,
} from './roleHierarchy.js';

const superAdmin: Actor = { id: 1n, roles: ['SUPER_ADMIN'] };
const admin: Actor = { id: 2n, roles: ['ADMIN'] };
const hr: Actor = { id: 4n, roles: ['HR'] };
const employee: Actor = { id: 7n, roles: ['EMPLOYEE'] };

describe('roleRank / maxRank', () => {
  it('ranks SUPER_ADMIN highest and EMPLOYEE lowest', () => {
    expect(roleRank('SUPER_ADMIN')).toBeGreaterThan(roleRank('ADMIN'));
    expect(roleRank('ADMIN')).toBeGreaterThan(roleRank('HR'));
    expect(roleRank('HR')).toBeGreaterThan(roleRank('EMPLOYEE'));
  });
  it('unknown role ranks 0', () => {
    expect(roleRank('NOPE')).toBe(0);
  });
  it('maxRank takes the highest of multiple roles', () => {
    expect(maxRank(['EMPLOYEE', 'ADMIN', 'HR'])).toBe(roleRank('ADMIN'));
    expect(maxRank([])).toBe(0);
  });
});

describe('assertCanAssignRoles (Issue #1 — privilege escalation)', () => {
  it('blocks HR from assigning ANY role (no ADMIN-tier rank)', () => {
    expect(() => assertCanAssignRoles(hr, ['EMPLOYEE'])).toThrowError(/ไม่มีสิทธิ์กำหนด role/);
    expect(() => assertCanAssignRoles(hr, ['SUPER_ADMIN'])).toThrow();
  });
  it('blocks employee from assigning roles', () => {
    expect(() => assertCanAssignRoles(employee, ['MANAGER'])).toThrow();
  });
  it('blocks ADMIN from minting SUPER_ADMIN or another ADMIN (must outrank)', () => {
    expect(() => assertCanAssignRoles(admin, ['SUPER_ADMIN'])).toThrowError(/สูงกว่าหรือเท่ากับคุณ/);
    expect(() => assertCanAssignRoles(admin, ['ADMIN'])).toThrowError(/สูงกว่าหรือเท่ากับคุณ/);
  });
  it('allows ADMIN to assign HR / MANAGER / EMPLOYEE', () => {
    expect(() => assertCanAssignRoles(admin, ['HR', 'MANAGER', 'EMPLOYEE'])).not.toThrow();
  });
  it('blocks SUPER_ADMIN from minting another SUPER_ADMIN (API can never create one)', () => {
    expect(() => assertCanAssignRoles(superAdmin, ['SUPER_ADMIN'])).toThrow();
  });
  it('allows SUPER_ADMIN to assign ADMIN and below', () => {
    expect(() => assertCanAssignRoles(superAdmin, ['ADMIN', 'HR'])).not.toThrow();
  });
  it('rejects unknown role keys', () => {
    expect(() => assertCanAssignRoles(admin, ['WIZARD'])).toThrowError(/role ไม่ถูกต้อง/);
  });
});

describe('assertCanManageTarget (Issue #2 — password-reset / edit escalation)', () => {
  it('blocks HR from managing a SUPER_ADMIN or ADMIN', () => {
    expect(() => assertCanManageTarget(hr, 1n, ['SUPER_ADMIN'])).toThrowError(/สูงกว่าหรือเท่ากับคุณ/);
    expect(() => assertCanManageTarget(hr, 2n, ['ADMIN'])).toThrow();
  });
  it('blocks HR from managing another HR (equal rank)', () => {
    expect(() => assertCanManageTarget(hr, 99n, ['HR'])).toThrow();
  });
  it('allows HR to manage EMPLOYEE / MANAGER / INSTRUCTOR', () => {
    expect(() => assertCanManageTarget(hr, 7n, ['EMPLOYEE'])).not.toThrow();
    expect(() => assertCanManageTarget(hr, 5n, ['MANAGER'])).not.toThrow();
  });
  it('allows ADMIN to manage HR but not another ADMIN', () => {
    expect(() => assertCanManageTarget(admin, 4n, ['HR'])).not.toThrow();
    expect(() => assertCanManageTarget(admin, 99n, ['ADMIN'])).toThrow();
  });
  it('always allows acting on yourself', () => {
    expect(() => assertCanManageTarget(hr, hr.id, ['HR'])).not.toThrow();
    expect(() => assertCanManageTarget(admin, admin.id, ['ADMIN'])).not.toThrow();
  });
});
