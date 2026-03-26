import http from 'http';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { REDIS_URL } from '@/config';
import { matchCache } from '@/services/matchCache.service';
import { socketAuthMiddleware } from '@/middlewares/socketAuth.middleware';
import { logger } from '@utils/logger';

type MatchUpdatePayload = any;
type RedisClient = ReturnType<typeof createClient>;

/** Align with Express CORS in `app.ts` so cookie-based auth can be used from browsers. */
const SOCKET_CORS_ORIGINS = [
  'https://highphone11.com',
  'https://cricket.highphone11.com',
  'http://localhost:3000',
  'http://localhost:3030',
  'http://localhost:4040',
  'localhost:3000',
  'localhost:3030',
  'localhost:4040',
];

/** Postman / some clients emit JSON as a string, or pass matchId as a number — normalize for join. */
function parseMatchJoinPayload(...args: unknown[]): { matchId?: string } {
  const raw = args.find((a) => a !== undefined && typeof a !== 'function');
  if (raw == null) return {};

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const o = parsed as { matchId?: unknown; gameId?: unknown };
        if (o.matchId != null && o.matchId !== '') {
          return { matchId: String(o.matchId).trim() };
        }
        if (o.gameId != null && o.gameId !== '') {
          return { matchId: String(o.gameId).trim() };
        }
      }
    } catch {
      /* not JSON — treat whole string as id */
      return { matchId: trimmed };
    }
    return {};
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { matchId?: unknown; gameId?: unknown };
    if (o.matchId != null && o.matchId !== '') {
      return { matchId: String(o.matchId).trim() };
    }
    if (o.gameId != null && o.gameId !== '') {
      return { matchId: String(o.gameId).trim() };
    }
    return {};
  }

  /* Single primitive as event payload */
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return { matchId: String(raw) };
  }

  return {};
}

class SocketService {
  private io: SocketIOServer | null = null;
  private adapterPubClient: RedisClient | null = null;
  private adapterSubClient: RedisClient | null = null;

  public async init(httpServer: http.Server): Promise<void> {
    if (this.io) return;

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: SOCKET_CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.io.use(socketAuthMiddleware);

    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    this.adapterPubClient = pubClient;
    this.adapterSubClient = subClient;

    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.io.adapter(createAdapter(pubClient, subClient));

    this.io.on('connection', (socket) => {
      this.attachHandlers(socket);
    });

    logger.info('[SocketService] Socket.IO initialized (JWT auth + Redis adapter)');
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.adapterSubClient?.isOpen) {
        await this.adapterSubClient.quit();
      }
    } catch (e) {
      logger.warn('[SocketService] subClient quit', e);
    }
    try {
      if (this.adapterPubClient?.isOpen) {
        await this.adapterPubClient.quit();
      }
    } catch (e) {
      logger.warn('[SocketService] pubClient quit', e);
    }
    this.adapterSubClient = null;
    this.adapterPubClient = null;
  }

  public getIo(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO not initialized yet');
    }
    return this.io;
  }

  private attachHandlers(socket: Socket): void {
    socket.on('match:join', async (...args: unknown[]) => {
      let matchId = '';
      try {
        const payload = parseMatchJoinPayload(...args);
        matchId = payload.matchId ?? '';
        if (!matchId) {
          socket.emit('match:error', { matchId: null, reason: 'missing_matchId' });
          return;
        }

        const resolved = await matchCache.ensureCachedByEventOrGameId(matchId);
        if (resolved.ok === false) {
          const { reason } = resolved;
          socket.emit('match:error', {
            matchId,
            reason,
            hint:
              reason === 'not_found'
                ? 'No match with this eventId or gameId in DB.'
                : reason === 'match_inactive'
                  ? 'Match must be status=true and declared=false to be in cache.'
                  : 'UltraFast payload could not be built for this match.',
          });
          return;
        }

        socket.join(`match:${resolved.eventId}`);
        socket.emit('match:update', resolved.payload as MatchUpdatePayload);
      } catch (error: any) {
        socket.emit('match:error', { matchId: matchId || null, reason: error?.message ?? 'join_failed' });
      }
    });
  }

  public emitMatchUpdate(eventId: string, payload: MatchUpdatePayload): void {
    if (!this.io) return;
    this.io.to(`match:${eventId}`).emit('match:update', payload);
  }

  public emitMatchDeclared(eventId: string): void {
    if (!this.io) return;
    this.io.to(`match:${eventId}`).emit('match:declared', { matchId: eventId });
  }
}

export const socketService = new SocketService();
export default SocketService;
