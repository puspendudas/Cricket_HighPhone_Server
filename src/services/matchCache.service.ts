import mongoose from 'mongoose';
import MatchModel from '@/models/match.model';
import FancyOddsModel from '@/models/fancyodds.model';
import UltraFastMatchService from '@/services/ultraFast.match.service';
import { Match } from '@/interfaces/match.inderface';
import { getRedis } from '@/services/redis.client';

type UltraFastPayload = Match & { fancyOdds: any[] };

const KEY_UF = (eventId: string) => `cricket:match:uf:${eventId}`;
const KEY_GID = (gameId: string) => `cricket:match:gid:${gameId}`;

class MatchCacheService {
  private ultraFast = new UltraFastMatchService();

  private isBootstrapping = false;

  public async bootstrap(): Promise<void> {
    if (this.isBootstrapping) return;
    this.isBootstrapping = true;

    try {
      const redis = getRedis();
      await redis.ping();

      if (mongoose.connection.readyState !== 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const matches = await MatchModel.find(
        { status: true, declared: false },
        { eventId: 1, gameId: 1 },
      ).lean();

      for (const m of matches) {
        const eventId = m?.eventId?.toString?.();
        if (!eventId) continue;

        await this.rebuildFromUltraFast(eventId, { silent: true });
      }
    } finally {
      this.isBootstrapping = false;
    }
  }

  public async get(eventId: string): Promise<UltraFastPayload | undefined> {
    const raw = await getRedis().get(KEY_UF(eventId));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as UltraFastPayload;
    } catch {
      return undefined;
    }
  }

  public async has(eventId: string): Promise<boolean> {
    const n = await getRedis().exists(KEY_UF(eventId));
    return n === 1;
  }

  public async getEventIdByGameId(gameId: string): Promise<string | undefined> {
    const v = await getRedis().get(KEY_GID(gameId));
    return v ?? undefined;
  }

  public async remove(eventId: string): Promise<void> {
    const redis = getRedis();
    const raw = await redis.get(KEY_UF(eventId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UltraFastPayload;
        if (parsed?.gameId != null && String(parsed.gameId).trim() !== '') {
          await redis.del(KEY_GID(String(parsed.gameId)));
        }
      } catch {
        /* ignore parse errors */
      }
    }
    await redis.del(KEY_UF(eventId));
  }

  /**
   * Resolve `eventId` or terminal `gameId` to a cached UltraFast payload.
   * Used by Socket.IO `match:join` so clients can send either id; room is always `match:${eventId}`.
   */
  public async ensureCachedByEventOrGameId(rawId: string): Promise<
    | { ok: true; eventId: string; payload: UltraFastPayload }
    | { ok: false; reason: 'not_found' | 'match_inactive' | 'payload_unavailable'; queryId: string }
  > {
    const id = rawId.trim();
    if (!id) {
      return { ok: false, reason: 'not_found', queryId: rawId };
    }

    const cachedByEvent = await this.get(id);
    if (cachedByEvent) {
      return { ok: true, eventId: id, payload: cachedByEvent };
    }

    const eventFromGame = await this.getEventIdByGameId(id);
    if (eventFromGame) {
      const p = await this.get(eventFromGame);
      if (p) {
        return { ok: true, eventId: eventFromGame, payload: p };
      }
    }

    // Plain equality on eventId/gameId fails when DB has Number and client sends String (Socket/JSON).
    let doc = await MatchModel.findOne(
      {
        $expr: {
          $or: [
            { $eq: [{ $toString: { $ifNull: ['$eventId', ''] } }, id] },
            { $eq: [{ $toString: { $ifNull: ['$gameId', ''] } }, id] },
          ],
        },
      },
      { eventId: 1, gameId: 1, status: 1, declared: 1 },
    ).lean();

    // Terminal id often equals fancy `gameId` while `matches` may use different event/game ids; fancy rows carry `matchId`.
    if (!doc) {
      const fo = await FancyOddsModel.findOne(
        {
          $expr: {
            $eq: [{ $toString: { $ifNull: ['$gameId', ''] } }, id],
          },
        },
        { matchId: 1 },
      ).lean();

      if (fo?.matchId) {
        doc = await MatchModel.findById(fo.matchId, {
          eventId: 1,
          gameId: 1,
          status: 1,
          declared: 1,
        }).lean();
      }
    }

    if (!doc) {
      return { ok: false, reason: 'not_found', queryId: id };
    }

    // Clients often send terminal gameId; DB row may match gameId while eventId is empty or only on the other field.
    // Do not use `!doc.eventId` — that rejects valid rows found by gameId.
    const eventId =
      doc.eventId != null && String(doc.eventId).trim() !== ''
        ? String(doc.eventId)
        : doc.gameId != null && String(doc.gameId).trim() !== ''
          ? String(doc.gameId)
          : id;
    if (doc.declared === true || doc.status !== true) {
      return { ok: false, reason: 'match_inactive', queryId: id };
    }

    const payload = await this.rebuildFromUltraFast(eventId, { silent: true });
    if (!payload) {
      return { ok: false, reason: 'payload_unavailable', queryId: id };
    }

    return { ok: true, eventId, payload };
  }

  public async rebuildFromUltraFast(
    eventId: string,
    opts?: { silent?: boolean },
  ): Promise<UltraFastPayload | null> {
    try {
      const payload = await this.ultraFast.getMatchByIdUltraFast(eventId);
      if (!payload) {
        await this.remove(eventId);
        return null;
      }

      if (!payload.status || payload.declared) {
        await this.remove(eventId);
        return null;
      }

      const redis = getRedis();
      await redis.set(KEY_UF(eventId), JSON.stringify(payload));
      if (payload.gameId != null && String(payload.gameId).trim() !== '') {
        await redis.set(KEY_GID(String(payload.gameId)), eventId);
      }
      return payload;
    } catch (error: any) {
      if (!opts?.silent) {
        // eslint-disable-next-line no-console
        console.error(`[MatchCache] rebuild failed for eventId=${eventId}:`, error?.message || error);
      }
      return null;
    }
  }
}

export const matchCache = new MatchCacheService();
export default MatchCacheService;
