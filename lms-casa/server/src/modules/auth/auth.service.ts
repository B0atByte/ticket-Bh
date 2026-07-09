import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { publishToUser } from '../notifications/notifications.hub.js';
import {
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  refreshExpiry,
  signAccessToken,
  verifyPassword,
} from './tokens.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

interface SessionContext {
  ip?: string;
  userAgent?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  perms: string[];
}

async function loadAuthContext(userId: bigint): Promise<{ roles: string[]; perms: string[] }> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });
  const roles = userRoles.map((ur) => ur.role.key);
  const permSet = new Set<string>();
  for (const ur of userRoles) {
    for (const rp of ur.role.rolePermissions) {
      permSet.add(rp.permission.key);
    }
  }
  return { roles, perms: [...permSet] };
}

/**
 * Single active session: revoke every still-active refresh token for the user.
 * Called on a fresh login (password or SSO) BEFORE the new token is issued, so the
 * new session stays valid while every other device is logged out on its next refresh.
 * Not called on rotation/register — rotation revokes only its own predecessor.
 */
async function revokeActiveSessions(userId: bigint): Promise<void> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if ((result?.count ?? 0) > 0) {
    // Real-time alert to the device(s) being signed out. Their SSE stream is still
    // open (it was authenticated at connect time), so they receive this even though
    // their access token is now dead. Fire-and-forget — never block login.
    publishToUser(userId.toString(), 'session-revoked', {
      reason: 'NEW_LOGIN',
      message: 'บัญชีนี้ถูกเข้าสู่ระบบจากอุปกรณ์อื่น คุณจึงถูกออกจากระบบ',
      at: new Date().toISOString(),
    });
  }
}

async function issueTokens(
  userId: bigint,
  roles: string[],
  perms: string[],
  ctx: SessionContext,
): Promise<AuthTokens> {
  const { token: refreshToken, hash } = generateRefreshToken();
  const expiresAt = refreshExpiry();

  // Create the session (refresh token) first so the access token can be bound to it
  // via `sid`. requireAuth checks that session per request, so revoking it (e.g. on
  // login from another device) kills the access token immediately, not only at refresh.
  const session = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt,
      userAgent: ctx.userAgent?.slice(0, 255),
      ipAddress: ctx.ip?.slice(0, 64),
    },
  });

  const accessToken = signAccessToken({
    sub: userId.toString(),
    roles,
    perms,
    sid: session.id.toString(),
  });

  return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
}

export async function register(
  input: RegisterInput,
  ctx: SessionContext,
): Promise<{ user: UserSummary; tokens: AuthTokens }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw HttpError.conflict('อีเมลนี้ถูกใช้แล้ว');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        employeeId: input.employeeId,
        phone: input.phone,
      },
    });
    // Default role: EMPLOYEE
    const employeeRole = await tx.role.findUnique({ where: { key: 'EMPLOYEE' } });
    if (employeeRole) {
      await tx.userRole.create({
        data: { userId: created.id, roleId: employeeRole.id },
      });
    }
    return created;
  });

  const { roles, perms } = await loadAuthContext(user.id);
  const tokens = await issueTokens(user.id, roles, perms, ctx);

  return {
    user: {
      id: user.id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      perms,
    },
    tokens,
  };
}

export async function login(
  input: LoginInput,
  ctx: SessionContext,
): Promise<{ user: UserSummary; tokens: AuthTokens }> {
  const user = input.identifier.includes('@')
    ? await prisma.user.findUnique({ where: { email: input.identifier } })
    : await prisma.user.findUnique({ where: { employeeId: input.identifier } });
  // Generic message to avoid email enumeration
  if (!user || user.deletedAt) {
    throw HttpError.unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  if (user.status !== 'ACTIVE') {
    throw HttpError.forbidden(`บัญชีผู้ใช้ถูกระงับการใช้งาน (${user.status.toLowerCase()})`);
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw HttpError.unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Enforce single active session: drop any session left open on another device.
  await revokeActiveSessions(user.id);

  const { roles, perms } = await loadAuthContext(user.id);
  const tokens = await issueTokens(user.id, roles, perms, ctx);

  return {
    user: {
      id: user.id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      perms,
    },
    tokens,
  };
}

export async function refresh(
  refreshTokenPlain: string,
  ctx: SessionContext,
): Promise<AuthTokens> {
  const hash = hashRefreshToken(refreshTokenPlain);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!record || record.revokedAt) {
    throw HttpError.unauthorized('Invalid refresh token');
  }
  if (record.expiresAt < new Date()) {
    throw HttpError.unauthorized('Refresh token expired');
  }

  // Rotate: revoke the old one
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const { roles, perms } = await loadAuthContext(record.userId);
  return issueTokens(record.userId, roles, perms, ctx);
}

export async function logout(refreshTokenPlain: string | undefined): Promise<void> {
  if (!refreshTokenPlain) return;
  const hash = hashRefreshToken(refreshTokenPlain);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: bigint): Promise<UserSummary> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw HttpError.notFound('ไม่พบผู้ใช้');
  }
  const { roles, perms } = await loadAuthContext(user.id);
  return {
    id: user.id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    perms,
  };
}

/**
 * Shared helper for OIDC: load auth context and issue tokens for an existing user.
 */
export async function issueTokensForUser(
  userId: bigint,
  ctx: SessionContext,
): Promise<AuthTokens> {
  // SSO login is also a fresh login -> enforce single active session.
  await revokeActiveSessions(userId);
  const { roles, perms } = await loadAuthContext(userId);
  return issueTokens(userId, roles, perms, ctx);
}
