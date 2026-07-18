import { createHash, timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

export interface HttpSecurityConfig {
  httpHost: string;
  httpAuthToken?: string;
  httpAllowedOrigins: string[];
  httpBodyLimitBytes: number;
  httpMaxSessions: number;
  httpSessionTtlMs: number;
}

interface ClosableSession {
  close(): Promise<void> | void;
}

interface SessionEntry<T extends ClosableSession> {
  transport: T;
  lastAccessedAt: number;
}

export type SessionReservation = symbol;

const ALLOWED_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Mcp-Session-Id',
  'Mcp-Protocol-Version',
  'Last-Event-ID'
].join(', ');
const EXPOSED_HEADERS = 'Mcp-Session-Id';

function digestToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function tokensMatch(candidate: string, expectedDigest: Buffer): boolean {
  return timingSafeEqual(digestToken(candidate), expectedDigest);
}

function readBearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1];
}

export function createHttpSecurityMiddleware(config: HttpSecurityConfig): RequestHandler {
  const allowedOrigins = new Set(config.httpAllowedOrigins);
  const expectedTokenDigest = config.httpAuthToken
    ? digestToken(config.httpAuthToken)
    : undefined;

  return (req, res, next) => {
    const origin = req.get('origin');

    if (origin) {
      res.vary('Origin');
      if (!allowedOrigins.has(origin)) {
        res.status(403).json({ error: 'Origin not allowed' });
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    if (expectedTokenDigest) {
      const candidate = readBearerToken(req.get('authorization'));
      if (!candidate || !tokensMatch(candidate, expectedTokenDigest)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    next();
  };
}

export class HttpSessionRegistry<T extends ClosableSession> {
  private readonly sessions = new Map<string, SessionEntry<T>>();
  private readonly reservations = new Set<SessionReservation>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly maxSessions: number,
    private readonly sessionTtlMs: number,
    private readonly now: () => number = Date.now,
    private readonly onCloseError?: (error: unknown, sessionId: string) => void
  ) {}

  get size(): number {
    return this.sessions.size;
  }

  reserve(): SessionReservation | undefined {
    if (this.sessions.size + this.reservations.size >= this.maxSessions) {
      return undefined;
    }

    const reservation = Symbol('mcp-session-reservation');
    this.reservations.add(reservation);
    return reservation;
  }

  release(reservation: SessionReservation): void {
    this.reservations.delete(reservation);
  }

  register(sessionId: string, transport: T, reservation: SessionReservation): void {
    if (!this.reservations.delete(reservation)) {
      throw new Error('Invalid or expired session reservation');
    }
    if (this.sessions.has(sessionId)) {
      throw new Error('Duplicate session ID');
    }

    this.sessions.set(sessionId, {
      transport,
      lastAccessedAt: this.now()
    });
  }

  get(sessionId: string): T | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return undefined;
    }

    entry.lastAccessedAt = this.now();
    return entry.transport;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  async cleanupExpired(): Promise<number> {
    const cutoff = this.now() - this.sessionTtlMs;
    const expired: Array<[string, T]> = [];

    for (const [sessionId, entry] of this.sessions) {
      if (entry.lastAccessedAt <= cutoff) {
        this.sessions.delete(sessionId);
        expired.push([sessionId, entry.transport]);
      }
    }

    await Promise.all(expired.map(([sessionId, transport]) => this.closeTransport(sessionId, transport)));
    return expired.length;
  }

  startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    const intervalMs = Math.min(this.sessionTtlMs, 60_000);
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired();
    }, intervalMs);
    this.cleanupTimer.unref?.();
  }

  stopCleanup(): void {
    if (!this.cleanupTimer) {
      return;
    }

    clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async closeAll(): Promise<void> {
    this.stopCleanup();
    this.reservations.clear();
    const active = Array.from(this.sessions.entries());
    this.sessions.clear();

    await Promise.all(active.map(([sessionId, entry]) => {
      return this.closeTransport(sessionId, entry.transport);
    }));
  }

  private async closeTransport(sessionId: string, transport: T): Promise<void> {
    try {
      await transport.close();
    } catch (error) {
      this.onCloseError?.(error, sessionId);
    }
  }
}
