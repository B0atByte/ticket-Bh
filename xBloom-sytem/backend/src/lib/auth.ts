import bcrypt from "bcryptjs";
import { sign, verify } from "hono/jwt";
import { env } from "../env.js";

export type Role = "admin" | "staff" | "tech" | "customer";

export interface AuthUser {
  name: string;
  role: Role;
}

export interface JwtPayload extends AuthUser {
  exp: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  // bcrypt-hashed values start with $2; tolerate legacy plaintext seed rows.
  if (hash.startsWith("$2")) return bcrypt.compare(pin, hash);
  return pin === hash;
}

export async function signToken(user: AuthUser): Promise<string> {
  const payload: Record<string, unknown> = {
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  return sign(payload, env.JWT_SECRET, "HS256");
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  return (await verify(token, env.JWT_SECRET, "HS256")) as unknown as JwtPayload;
}
