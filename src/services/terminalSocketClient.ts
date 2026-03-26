import WebSocket from 'ws';
import { logger } from '@utils/logger';
import { TERMINAL_WS_URL } from '@/config';
import MatchModel from '@/models/match.model';
import FancyOddsService from '@/services/fancyodds.service';
import { matchCache } from '@/services/matchCache.service';
import { socketService } from '@/services/socket.service';

/**
 * Terminal dashboard often wraps lists as `{ statusCode, data: [...] }` or `{ data: { matches: [...] } }`.
 * Some feeds use `list` / `records` / split buckets (`live` + `upcoming`) or snake_case `game_id`.
 */
function extractMatchArrayFromTerminal(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'object') return [];

  const tryArrays = (o: any): any[] | null => {
    if (!o || typeof o !== 'object') return null;
    for (const key of [
      'matches',
      'result',
      'items',
      'list',
      'records',
      'rows',
      'data',
      'content',
      'live',
      'upcoming',
      'inplay',
      'matchList',
    ]) {
      const v = (o as any)[key];
      if (Array.isArray(v) && v.length > 0) return v;
    }
    return null;
  };

  const first = tryArrays(raw);
  if (first) return first;

  const d = raw.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    const inner = tryArrays(d);
    if (inner) return inner;
    if (Array.isArray(d.data)) return d.data;
    if (Array.isArray(d.matches)) return d.matches;
    if (Array.isArray(d.items)) return d.items;
    if (Array.isArray(d.result)) return d.result;
    const d2 = d.data;
    if (d2 && typeof d2 === 'object') {
      const inner2 = tryArrays(d2);
      if (inner2) return inner2;
      if (Array.isArray(d2.matches)) return d2.matches;
      if (Array.isArray(d2.data)) return d2.data;
    }
  }

  // Merge any object-valued arrays whose elements look like match rows
  const merged: any[] = [];
  for (const v of Object.values(raw)) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const el = v[0];
    if (el && typeof el === 'object' && (el.gameId != null || el.game_id != null)) {
      merged.push(...v);
    }
  }
  if (merged.length > 0) return merged;

  // Single match object (not wrapped in an array)
  if (raw.gameId != null || raw.game_id != null) {
    return [raw];
  }

  return [];
}

/**
 * Odds frames are often `{ statusCode, data: { bookMakerOdds, ... } }` while we read top-level fields.
 */
function unwrapOddsPayloadFromTerminal(data: any): any {
  if (data == null || typeof data !== 'object') return data;
  const pick = (o: any): boolean =>
    o &&
    typeof o === 'object' &&
    !Array.isArray(o) &&
    ('matchOdds' in o || 'bookMakerOdds' in o || 'fancyOdds' in o || 'otherMarketOdds' in o || 'premiumFancy' in o);

  const d1 = data.data;
  if (pick(d1)) return d1;
  if (d1 && typeof d1 === 'object' && !Array.isArray(d1) && pick(d1.data)) return d1.data;
  return data;
}

/**
 * Normalized fields from terminal `cricket/matches` (no spread of full payload — avoids bad _id / admin flags).
 * Admin-controlled fields (status, declared, limits, locks) are only set on insert via $setOnInsert.
 */
function buildTerminalMatchUpsertFields(m: any): Record<string, any> | null {
  const gidRaw = m?.gameId ?? m?.game_id;
  const gameId = gidRaw != null ? String(gidRaw).trim() : '';
  const eidRaw = m?.eventId ?? m?.event_id;
  const eventIdRaw = eidRaw != null ? String(eidRaw).trim() : '';
  const eventId = eventIdRaw || gameId;
  const midRaw = m?.marketId ?? m?.market_id;
  const marketId = midRaw != null ? String(midRaw).trim() : '';
  if (!gameId || !eventId) return null;

  const fields: Record<string, any> = {
    gameId,
    eventId,
    marketId: marketId || gameId,
    eventName: m?.eventName != null ? String(m.eventName) : 'Unknown',
    seriesName: m?.seriesName != null ? String(m.seriesName) : 'Unknown',
    eventTime: m?.eventTime != null ? String(m.eventTime) : new Date().toISOString(),
  };

  if (typeof m?.inPlay === 'boolean') fields.inPlay = m.inPlay;
  if (Array.isArray(m?.teams) && m.teams.length > 0) fields.teams = m.teams;
  if (m?.tv != null) fields.tv = String(m.tv);
  if (m?.seriesId != null) fields.seriesId = String(m.seriesId);
  if (m?.channel != null) fields.channel = String(m.channel);
  if (m?.scoreBoardId != null) fields.scoreBoardId = String(m.scoreBoardId);

  return fields;
}

class TerminalSocketClient {
  private static instance: TerminalSocketClient;

  private ws: WebSocket | null = null;
  private fancyOddsService: FancyOddsService;
  private activeSubscriptions = new Set<string>();
  private activeMatchGameIds = new Map<string, string>();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private lastMessageAt: Date | null = null;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private rebuildTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Inbound telemetry (terminal → this server) */
  private inboundMessageCount = 0;
  private lastInbound: { channel: string; gameId?: string; at: string; payloadBytes: number } | null = null;

  /** Avoid log spam when odds arrive for unknown/inactive matches */
  private oddsSkipLoggedGameIds = new Set<string>();

  /** Log once when UltraFast rebuild returns nothing after DB update */
  private rebuildEmitMissLogged = new Set<string>();

  /** Log once if cricket/matches shape did not yield an array */
  private matchesExtractEmptyWarned = false;

  private readonly MIN_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;

  private heartbeatTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.fancyOddsService = new FancyOddsService();
    this.startHeartbeatLog();
  }

  private startHeartbeatLog(): void {
    this.heartbeatTimer = setInterval(() => {
      logger.info(
        `[TerminalSocket] HEARTBEAT state=${this.connectionState} msgs=${this.inboundMessageCount} ` +
          `subs=${this.activeSubscriptions.size} matchSubs=${this.activeMatchGameIds.size} ` +
          `lastMsg=${this.lastMessageAt?.toISOString() ?? 'never'} url=${TERMINAL_WS_URL}`,
      );
    }, 30_000);
    this.heartbeatTimer.unref();
  }

  public static getInstance(): TerminalSocketClient {
    if (!TerminalSocketClient.instance) {
      TerminalSocketClient.instance = new TerminalSocketClient();
    }
    return TerminalSocketClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.warn('[TerminalSocket] Already connected');
      return;
    }

    this.connectionState = 'connecting';
    logger.info(`[TerminalSocket] Connecting to ${TERMINAL_WS_URL}`);

    try {
      this.ws = new WebSocket(TERMINAL_WS_URL, {
        headers: {
          Origin: 'https://socket.hpterminal.com',
        },
      });
      this.setupEventHandlers();
    } catch (error: any) {
      logger.error(`[TerminalSocket] Connection failed: ${error.message}`);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', async () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      logger.info('[TerminalSocket] Connected');

      await this.onConnected();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.lastMessageAt = new Date();
      const raw = data.toString();

      if (this.inboundMessageCount < 3) {
        const snippet = raw.length > 500 ? raw.slice(0, 500) + '...' : raw;
        logger.info(`[TerminalSocket] RAW_MSG #${this.inboundMessageCount + 1} (${raw.length}b): ${snippet}`);
      }

      // The server may send multiple JSON objects concatenated in a single frame (NDJSON).
      // Split on newlines and also handle back-to-back objects like `}{`.
      const chunks = raw.split(/\n/).flatMap(line => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        // Split back-to-back JSON objects: e.g. `{...}{...}`
        return trimmed.split(/(?<=\})\s*(?=\{)/);
      });

      for (const chunk of chunks) {
        try {
          const parsed = JSON.parse(chunk);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && typeof item === 'object') {
                this.handleMessage(item, chunk.length);
              }
            }
          } else {
            this.handleMessage(parsed, chunk.length);
          }
        } catch (error: any) {
          logger.error(`[TerminalSocket] Failed to parse message chunk (${chunk.length}b): ${error.message}`);
        }
      }
    });

    this.ws.on('ping', () => {
      logger.info('[TerminalSocket] ← received WS ping from server');
    });

    this.ws.on('pong', () => {
      logger.info('[TerminalSocket] ← received WS pong from server');
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      logger.warn(`[TerminalSocket] Disconnected code=${code} reason=${reason.toString()}`);
      this.connectionState = 'disconnected';
      this.ws = null;

      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error: Error) => {
      logger.error(`[TerminalSocket] Error: ${error.message}`);
    });
  }

  private async onConnected(): Promise<void> {
    this.subscribe('cricket/matches');

    try {
      const activeMatches = await MatchModel.find(
        { status: true, declared: false },
        { gameId: 1 }
      ).lean();

      for (const match of activeMatches) {
        if (match.gameId) {
          this.subscribeToMatch(match.gameId);
        }
      }

      logger.info(`[TerminalSocket] Subscribed to ${activeMatches.length} active matches`);
    } catch (error: any) {
      logger.error(`[TerminalSocket] Failed to subscribe to active matches: ${error.message}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) return;

    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;

    const delay = Math.min(
      this.MIN_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      this.MAX_RECONNECT_DELAY
    );

    logger.info(`[TerminalSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  private send(payload: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const json = JSON.stringify(payload);
      logger.info(`[TerminalSocket] SEND → ${json}`);
      this.ws.send(json);
    } catch (error: any) {
      logger.error(`[TerminalSocket] Send failed: ${error.message}`);
    }
  }

  public subscribe(channel: string): void {
    this.activeSubscriptions.add(channel);
    this.send({ subscribe: channel });
    logger.info(`[TerminalSocket] Subscribed to ${channel}`);
  }

  public unsubscribe(channel: string): void {
    this.activeSubscriptions.delete(channel);
    this.send({ unsubscribe: channel });
    logger.info(`[TerminalSocket] Unsubscribed from ${channel}`);
  }

  public subscribeToMatch(gameId: string): void {
    const channel = `cricket/odds/${gameId}`;
    if (this.activeMatchGameIds.has(gameId)) return;

    this.activeMatchGameIds.set(gameId, channel);
    this.subscribe(channel);
  }

  public unsubscribeFromMatch(gameId: string): void {
    const channel = this.activeMatchGameIds.get(gameId);
    if (!channel) return;

    this.activeMatchGameIds.delete(gameId);
    this.unsubscribe(channel);
  }

  private wsInitialLogCount = 0;
  private readonly WS_INITIAL_LOG_LIMIT = 5;

  private handleMessage(message: any, rawByteLength: number): void {
    const channel =
      message?.channel ?? message?.Channel ?? message?.topic ?? message?.name;
    let data = message?.data ?? message?.payload ?? message?.body ?? message?.result ?? message?.Data;
    if (data != null && typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        /* keep string */
      }
    }

    if (this.wsInitialLogCount < this.WS_INITIAL_LOG_LIMIT) {
      this.wsInitialLogCount++;
      const keys = message && typeof message === 'object' ? Object.keys(message).slice(0, 10).join(',') : typeof message;
      logger.info(
        `[TerminalSocket] ← msg #${this.wsInitialLogCount} keys=[${keys}] channel=${channel ?? 'NONE'} hasData=${data != null} ~${rawByteLength}b`,
      );
    }

    if (!channel || data == null) {
      if (process.env.TERMINAL_WS_TRACE === 'true') {
        const keys = message && typeof message === 'object' ? Object.keys(message).slice(0, 10).join(',') : typeof message;
        logger.info(`[TerminalSocket] ← ignored (missing channel or data) keys=[${keys}]`);
      }
      return;
    }

    this.inboundMessageCount += 1;
    const at = new Date().toISOString();
    const ch = String(channel).trim();
    let gameId: string | undefined;

    if (ch.startsWith('cricket/odds/')) {
      gameId = ch.slice('cricket/odds/'.length);
      this.lastInbound = {
        channel: ch,
        gameId,
        at,
        payloadBytes: rawByteLength,
      };
    } else {
      this.lastInbound = {
        channel: ch,
        at,
        payloadBytes: rawByteLength,
      };
    }

    if (process.env.TERMINAL_WS_TRACE === 'true') {
      logger.info(
        `[TerminalSocket] ← inbound #${this.inboundMessageCount} channel=${ch}` +
          (gameId ? ` gameId=${gameId}` : '') +
          ` ~${rawByteLength}b`,
      );
    }

    const isMatchesChannel =
      ch === 'cricket/matches' || ch.endsWith('/cricket/matches') || ch.toLowerCase() === 'cricket/matches';
    if (isMatchesChannel) {
      void this.handleMatchesMessage(data);
    } else if (ch.startsWith('cricket/odds/')) {
      this.handleOddsMessage(gameId!, data);
    }
  }

  private async handleMatchesMessage(matches: any): Promise<void> {
    try {
      const payloadType = Array.isArray(matches) ? `array[${matches.length}]` : typeof matches;
      const payloadKeys = matches && typeof matches === 'object' && !Array.isArray(matches)
        ? Object.keys(matches).slice(0, 15).join(',')
        : '';
      logger.info(
        `[TerminalSocket] handleMatchesMessage called — type=${payloadType} keys=[${payloadKeys}]`,
      );

      const matchList = extractMatchArrayFromTerminal(matches);
      logger.info(
        `[TerminalSocket] extractMatchArrayFromTerminal returned ${matchList.length} row(s)`,
      );
      if (!matchList.length) {
        if (!this.matchesExtractEmptyWarned && matches && typeof matches === 'object') {
          this.matchesExtractEmptyWarned = true;
          const snippet = JSON.stringify(matches).slice(0, 300);
          logger.warn(
            `[TerminalSocket] cricket/matches: could not extract a match array. payload keys=[${Object.keys(matches).join(',')}] snippet=${snippet}`,
          );
        }
        return;
      }

      let processed = 0;

      for (const m of matchList) {
        const fields = buildTerminalMatchUpsertFields(m);
        if (!fields) {
          const mKeys = m && typeof m === 'object' ? Object.keys(m).slice(0, 10).join(',') : typeof m;
          logger.warn(`[TerminalSocket] buildTerminalMatchUpsertFields returned null — row keys=[${mKeys}]`);
          continue;
        }
        logger.info(`[TerminalSocket] Upserting gameId=${fields.gameId} eventName=${fields.eventName}`);

        const gid = fields.gameId;
        // Never $set eventId from the feed — it can violate the unique index; new rows get eventId=gameId via $setOnInsert.
        const { gameId: _g, eventId: _e, ...patch } = fields;
        const $set: Record<string, any> = {};
        for (const [k, v] of Object.entries(patch)) {
          if (v !== undefined) $set[k] = v;
        }

        const $setOnInsert: Record<string, any> = {
          gameId: gid,
          eventId: gid,
          status: false,
          declared: false,
          bm_lock: [],
          fancy_lock: [],
          bet_delay: 3,
          min: 500,
          max: 50000,
        };
        if (!$set.marketId) {
          $setOnInsert.marketId = fields.marketId || gid;
        }

        // Remove any keys from $setOnInsert that are already in $set to avoid MongoDB path conflicts
        for (const key of Object.keys($set)) {
          delete $setOnInsert[key];
        }

        try {
          const before = await MatchModel.findOne({ gameId: gid }, { _id: 1 }).lean();
          await MatchModel.findOneAndUpdate(
            { gameId: gid },
            { $set, $setOnInsert },
            { upsert: true, runValidators: true },
          );
          processed += 1;
          if (!before) {
            this.subscribeToMatch(gid);
          }
        } catch (oneErr: any) {
          if (oneErr?.code === 11000) {
            logger.warn(
              `[TerminalSocket] cricket/matches upsert skipped for gameId=${gid} (duplicate key — check eventId uniqueness).`,
            );
          } else {
            throw oneErr;
          }
        }
      }

      if (processed > 0) {
        logger.info(`[TerminalSocket] cricket/matches: processed ${processed} row(s) from feed (upsert)`);
      }
    } catch (error: any) {
      logger.error(`[TerminalSocket] Failed to handle matches message: ${error.message}`);
    }
  }

  private async handleOddsMessage(gameId: string, rawData: any): Promise<void> {
    const data = unwrapOddsPayloadFromTerminal(rawData);
    const gid = String(gameId).trim();
    try {
      const match = await MatchModel.findOne(
        { gameId: gid, status: true, declared: false },
        { _id: 1, gameId: 1, eventId: 1 },
      ).lean();

      if (!match) {
        // Terminal often sends odds before a row exists, or for matches with status:false (default on insert).
        if (!this.oddsSkipLoggedGameIds.has(gid)) {
          this.oddsSkipLoggedGameIds.add(gid);
          const anyRow = await MatchModel.findOne({ gameId: gid }, { gameId: 1, eventId: 1, status: 1, declared: 1 }).lean();
          if (!anyRow) {
            logger.warn(
              `[TerminalSocket] Inbound odds for gameId=${gid} but no Mongo match row — ` +
                `wait for cricket/matches to insert it or check DB/TERMINAL_WS_URL.`,
            );
          } else {
            logger.warn(
              `[TerminalSocket] Inbound odds for gameId=${gid} but match is inactive: status=${anyRow.status} declared=${anyRow.declared} ` +
                `(need status=true, declared=false). eventId=${anyRow.eventId}`,
            );
          }
        }
        return;
      }

      const updateData: any = {};

      if (data.matchOdds && Array.isArray(data.matchOdds) && data.matchOdds.length > 0) {
        updateData.matchOdds = data.matchOdds;
        updateData.isMatchEnded = false;
      } else {
        updateData.isMatchEnded = true;
      }

      if (data.bookMakerOdds && Array.isArray(data.bookMakerOdds) && data.bookMakerOdds.length > 0) {
        updateData.bookMakerOdds = data.bookMakerOdds;
        updateData.isBMEnded = false;
      } else {
        updateData.isBMEnded = true;
      }

      updateData.otherMarketOdds = data.otherMarketOdds || [];

      const teams = this.extractTeamNames(data);
      if (teams.length > 0) {
        updateData.teams = teams;
      }

      await MatchModel.findByIdAndUpdate(match._id, updateData);

      const fancyOdds =
        Array.isArray(data.fancyOdds) && data.fancyOdds.length > 0
          ? data.fancyOdds
          : Array.isArray(data.premiumFancy) && data.premiumFancy.length > 0
            ? data.premiumFancy
            : null;
      if (fancyOdds && fancyOdds.length > 0) {
        await this.fancyOddsService.bulkCreateOrUpdate(fancyOdds, match._id.toString(), gid);
      }

      if (match.eventId) {
        this.scheduleMatchRebuildAndEmit(match.eventId.toString());
      }
    } catch (error: any) {
      logger.error(`[TerminalSocket] Failed to handle odds for gameId ${gid}: ${error.message}`);
    }
  }

  private scheduleMatchRebuildAndEmit(eventId: string): void {
    const existing = this.rebuildTimers.get(eventId);
    if (existing) clearTimeout(existing);

    // Debounce rebuilds/emit bursts from high-frequency WS messages.
    this.rebuildTimers.set(
      eventId,
      setTimeout(async () => {
        this.rebuildTimers.delete(eventId);
        const payload = await matchCache.rebuildFromUltraFast(eventId);
        if (payload) {
          socketService.emitMatchUpdate(eventId, payload);
        } else if (!this.rebuildEmitMissLogged.has(eventId)) {
          this.rebuildEmitMissLogged.add(eventId);
          logger.warn(
            `[TerminalSocket] DB updated for eventId=${eventId} but matchCache rebuild returned no payload — ` +
              `Socket.IO match:update not emitted (check UltraFast / match row / status & declared).`,
          );
        }
      }, 80),
    );
  }

  private extractTeamNames(data: any): string[] {
    const teams: string[] = [];
    const oddsSource = data.matchOdds?.[0]?.oddDatas
      || data.bookMakerOdds?.[0]?.oddDatas
      || data.bookMakerOdds?.[0]?.bm1?.oddDatas
      || data.bookMakerOdds?.[0]?.bm2?.oddDatas;

    if (oddsSource && Array.isArray(oddsSource)) {
      teams.push(...oddsSource.filter((item: any) => item?.rname).map((item: any) => item.rname));
    }
    return teams;
  }

  public async disconnect(): Promise<void> {
    this.isShuttingDown = true;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Server shutdown');
      this.ws = null;
    }

    for (const [, t] of this.rebuildTimers) {
      clearTimeout(t);
    }
    this.rebuildTimers.clear();
    this.activeSubscriptions.clear();
    this.activeMatchGameIds.clear();
    this.connectionState = 'disconnected';
    logger.info('[TerminalSocket] Disconnected');
  }

  public getStatus(): {
    connectionState: string;
    activeSubscriptions: number;
    activeMatchSubscriptions: number;
    lastMessageAt: string | null;
    reconnectAttempts: number;
    wsUrl: string;
    inboundMessageCount: number;
    lastInbound: { channel: string; gameId?: string; at: string; payloadBytes: number } | null;
  } {
    return {
      connectionState: this.connectionState,
      activeSubscriptions: this.activeSubscriptions.size,
      activeMatchSubscriptions: this.activeMatchGameIds.size,
      lastMessageAt: this.lastMessageAt?.toISOString() || null,
      reconnectAttempts: this.reconnectAttempts,
      wsUrl: TERMINAL_WS_URL,
      inboundMessageCount: this.inboundMessageCount,
      lastInbound: this.lastInbound,
    };
  }
}

export const terminalSocketClient = TerminalSocketClient.getInstance();
export default TerminalSocketClient;
