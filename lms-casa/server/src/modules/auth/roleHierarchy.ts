import { HttpError } from '../../utils/httpError.js';

/**
 * Central role hierarchy. Higher rank = more authority.
 *
 * Used for privilege-ceiling checks so a lower- or equal-ranked actor can never
 * manage (edit / delete / reset-password) a higher-or-equal user, nor grant a
 * role they do not themselves outrank. This is the single source of truth for
 * "who can act on whom" and must agree wherever role authority is evaluated.
 *
 * NOTE: this is intentionally code-level (not a DB permission) so it applies
 * immediately to already-seeded environments with no data migration.
 */
export const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 90,
  HR: 50,
  INSTRUCTOR: 40,
  MANAGER: 40,
  EMPLOYEE: 10,
};

/** Minimum rank required to assign/change roles at all (ADMIN-tier and above). */
export const ROLE_ASSIGN_MIN_RANK: number = ROLE_RANK.ADMIN ?? 90;

export interface Actor {
  id: bigint;
  roles: string[];
}

/** Roles allowed to read the WHOLE user directory / any training record. */
const ALL_USER_VIEWER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

/**
 * True if the actor may view every user. MANAGER holds `user.read` for their
 * team only and is intentionally excluded here — their queries are scoped to
 * direct reports (managerId = actor.id) by the users service.
 */
export function canViewAllUsers(roles: readonly string[]): boolean {
  return roles.some((r) => ALL_USER_VIEWER_ROLES.includes(r));
}

export function roleRank(key: string): number {
  return ROLE_RANK[key] ?? 0;
}

export function maxRank(roles: readonly string[]): number {
  return roles.reduce((m, r) => Math.max(m, roleRank(r)), 0);
}

/**
 * Throw 403 unless `actor` strictly outranks the target user.
 * Acting on yourself is always allowed for non-role operations.
 */
export function assertCanManageTarget(
  actor: Actor,
  targetId: bigint,
  targetRoles: readonly string[],
): void {
  if (actor.id === targetId) return;
  if (maxRank(actor.roles) <= maxRank(targetRoles)) {
    throw HttpError.forbidden('ไม่สามารถจัดการผู้ใช้ที่มีสิทธิ์สูงกว่าหรือเท่ากับคุณได้');
  }
}

/**
 * Throw 403/400 unless `actor` may grant every role in `roleKeys`.
 * Requires ADMIN-tier rank, and each granted role must rank STRICTLY below the actor.
 * Consequence (by design): SUPER_ADMIN cannot be minted through the API — it is
 * provisioned only via seed / DB, which removes the most dangerous escalation path.
 */
export function assertCanAssignRoles(actor: Actor, roleKeys: readonly string[]): void {
  const actorRank = maxRank(actor.roles);
  if (actorRank < ROLE_ASSIGN_MIN_RANK) {
    throw HttpError.forbidden('คุณไม่มีสิทธิ์กำหนด role ให้ผู้ใช้');
  }
  for (const key of roleKeys) {
    if (!(key in ROLE_RANK)) {
      throw HttpError.badRequest(`role ไม่ถูกต้อง: ${key}`);
    }
    if (roleRank(key) >= actorRank) {
      throw HttpError.forbidden(`ไม่สามารถกำหนด role ที่สูงกว่าหรือเท่ากับคุณได้: ${key}`);
    }
  }
}
