import { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { ADMIN_SECRET_KEY, APP_SECRET_KEY } from '@/config';
import Admin from '@models/admin.model';
import User from '@/models/user.model';
import { DataStoredInToken } from '@interfaces/auth.interface';
import { logger } from '@utils/logger';

/** Strip accidental quotes / duplicate Bearer from Postman or copy-paste. */
function normalizeToken(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    s = s.slice(1, -1).trim();
  }
  if (s.toLowerCase().startsWith('bearer ')) {
    s = s.slice(7).trim();
  }
  return s;
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function extractToken(handshake: Socket['handshake']): string | null {
  const auth = handshake.auth;
  if (auth && typeof auth === 'object' && auth !== null && 'token' in auth) {
    const t = (auth as { token?: unknown }).token;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  const cookies = parseCookieHeader(handshake.headers.cookie);
  if (cookies.Authorization) return cookies.Authorization;

  const authHeader = handshake.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Plain `token` header (Postman / some HTTP clients; Node lowercases header names)
  const tokenHeader = handshake.headers.token;
  if (typeof tokenHeader === 'string' && tokenHeader.trim()) return tokenHeader.trim();
  if (Array.isArray(tokenHeader) && tokenHeader[0]?.trim()) return tokenHeader[0].trim();

  return null;
}

/**
 * Socket.IO handshake auth: admin JWT OR user JWT + session (same order as REST adminOrUserMiddleware).
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const raw = extractToken(socket.handshake);
    const token = raw ? normalizeToken(raw) : null;
    if (!token) {
      next(new Error('Authentication token missing'));
      return;
    }

    try {
      const verificationResponse = verify(token, ADMIN_SECRET_KEY) as DataStoredInToken;
      const adminId = verificationResponse.id;
      const findAdmin = await Admin.findById(adminId);
      if (findAdmin) {
        if (!findAdmin.status) {
          next(new Error('Not authorized as admin'));
          return;
        }
        socket.data.principal = { type: 'admin', admin: findAdmin };
        next();
        return;
      }
    } catch {
      /* not a valid admin token — try user */
    }

    try {
      const verificationResponse = verify(token, APP_SECRET_KEY) as DataStoredInToken;
      const userId = verificationResponse.id;
      const findUser = await User.findById(userId).select('+session_token');
      if (findUser) {
        const tokenSession = verificationResponse.sessionToken;
        if (!tokenSession || !findUser.session_token || tokenSession !== findUser.session_token) {
          next(new Error('Session expired'));
          return;
        }
        socket.data.principal = { type: 'user', user: findUser };
        next();
        return;
      }
      logger.warn('[socketAuth] User JWT verified but no user in DB — login must use this server and same MongoDB', {
        userId,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('[socketAuth] User JWT verify failed (wrong secret, expired, or malformed)', { message: msg });
    }

    next(new Error('Wrong authentication token'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Authentication failed';
    next(new Error(msg));
  }
}
