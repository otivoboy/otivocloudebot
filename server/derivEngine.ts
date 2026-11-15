import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AccountInfo,
  ActiveTrade,
  AppSnapshot,
  AuthMode,
  BotSettings,
  LogEntry,
  OpenPosition,
  SavedStrategy,
  SessionStats,
  TickPoint,
  TradeRecord,
  TradeType,
} from '../src/types.ts';
import {
  MARKETS,
  MT5_SYMBOLS,
  DEFAULT_SETTINGS,
  BARRIER_TYPES,
  DIGIT_TYPES,
  DUAL_TYPES,
  VALID_DIGITS,
} from '../src/types.ts';

const DEFAULT_WS_APP_ID = '1089';
const PAT_API_URL = 'https://api.derivws.com/trading/v1/options';
export const DERIV_DATA_APP_ID = '34SRQBBtI5nwEFQqmc3se';
const DEFAULT_PAT_APP_ID = DERIV_DATA_APP_ID;
const PUBLIC_WS_URL = `wss://api.derivws.com/trading/v1/options/ws/public?app_id=${DERIV_DATA_APP_ID}`;
const MAX_MART_STAKE = 1_000_000;
const STRATEGIES_FILE = path.resolve(process.cwd(), 'data', 'strategies.json');
const CONNECTION_FILE = path.resolve(process.cwd(), 'data', 'connection.json');
const SETTINGS_FILE = path.resolve(process.cwd(), 'data', 'settings.json');

type Listener = (event: string, payload: unknown) => void;

const EXTRA_MARKET_DECIMALS: Record<string, number> = {
  JD10: 2,
  JD25: 2,
  JD50: 2,
  JD100: 2,
  RDBULL: 4,
  RDBEAR: 4,
  BOOM300N: 4,
  CRASH300N: 4,
  BOOM600: 4,
  BOOM900: 4,
  CRASH600: 4,
  CRASH900: 4,
};

const MARKET_DECIMALS: Record<string, number> = {
  ...EXTRA_MARKET_DECIMALS,
  ...Object.fromEntries(MT5_SYMBOLS.map((m) => [m.symbol, m.decimals])),
  ...Object.fromEntries(MARKETS.map((m) => [m.symbol, m.decimals])),
};
const MARKET_LABELS: Record<string, string> = {
  ...Object.fromEntries(MT5_SYMBOLS.map((m) => [m.symbol, m.label])),
  ...Object.fromEntries(MARKETS.map((m) => [m.symbol, m.label])),
};

function extractLastDigit(quote: number, symbol: string): number {
  const dec = MARKET_DECIMALS[symbol] ?? 2;
  const fixed = quote.toFixed(dec);
  return Number(fixed.charAt(fixed.length - 1));
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectDemoFromLoginId(loginId: string): boolean {
  const upper = loginId.toUpperCase();
  return upper.startsWith('VR') || upper.startsWith('DOT') || upper.includes('DEMO');
}

interface PendingReq {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class DerivWsConnection {
  private ws: WebSocket | null = null;
  private nextReqId = 1;
  private pending = new Map<number, PendingReq>();
  private subscribers = new Set<(msg: any) => void>();
  private closedByCaller = false;
  private abortConnect: ((err: Error) => void) | null = null;

  async connect(
    url: string,
    timeoutMs = 20_000,
    headers?: Record<string, string>
  ): Promise<void> {
    this.closedByCaller = false;
    await this.close();
    this.closedByCaller = false;

    await new Promise<void>((resolve, reject) => {
      const ws = headers ? new WebSocket(url, { headers }) : new WebSocket(url);
      this.ws = ws;
      let settled = false;

      // Always keep an error listener attached for the entire socket lifetime
      // so asynchronous socket errors or CONNECTING aborts never crash Node.js.
      const handleSocketError = (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(connectTimer);
          this.abortConnect = null;
          reject(err);
        }
      };

      ws.on('error', handleSocketError);

      const connectTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.abortConnect = null;
          this.safeDisposeSocket(ws);
          if (this.ws === ws) this.ws = null;
          reject(new Error('Deriv WebSocket connection timed out'));
        }
      }, timeoutMs);

      this.abortConnect = (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(connectTimer);
          this.abortConnect = null;
          reject(err);
        }
      };

      ws.once('open', () => {
        if (!settled) {
          settled = true;
          clearTimeout(connectTimer);
          this.abortConnect = null;
          resolve();
        }
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const rid = msg.req_id;
          if (typeof rid === 'number' && this.pending.has(rid)) {
            const p = this.pending.get(rid)!;
            this.pending.delete(rid);
            clearTimeout(p.timer);
            p.resolve(msg);
          }
          for (const sub of this.subscribers) {
            sub(msg);
          }
        } catch {
          // ignore malformed frames
        }
      });

      ws.on('close', () => {
        if (!settled) {
          settled = true;
          clearTimeout(connectTimer);
          this.abortConnect = null;
          reject(new Error('WebSocket closed before opening'));
        }
        if (this.ws === ws) {
          this.ws = null;
        }
        for (const [rid, p] of this.pending.entries()) {
          clearTimeout(p.timer);
          p.reject(new Error('WebSocket connection closed'));
          this.pending.delete(rid);
        }
      });
    });
  }

  private safeDisposeSocket(ws: WebSocket): void {
    try {
      ws.removeAllListeners('open');
      ws.removeAllListeners('message');
      ws.removeAllListeners('close');
      // Keep a no-op error listener attached so ws.close()/terminate() during
      // CONNECTING never emits an unhandled 'error' event.
      ws.removeAllListeners('error');
      ws.on('error', () => {});

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    } catch {
      // ignore disposal errors
    }
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onMessage(fn: (msg: any) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  request(payload: Record<string, unknown>, timeoutMs = 45_000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Deriv WebSocket is not connected'));
    }
    const reqId = this.nextReqId++;
    const body = { ...payload, req_id: reqId };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error('Deriv API request timed out'));
      }, timeoutMs);

      this.pending.set(reqId, { resolve, reject, timer });
      try {
        this.ws!.send(JSON.stringify(body), (err) => {
          if (err) {
            this.pending.delete(reqId);
            clearTimeout(timer);
            reject(err);
          }
        });
      } catch (err: any) {
        this.pending.delete(reqId);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async close(): Promise<void> {
    this.closedByCaller = true;
    if (this.abortConnect) {
      this.abortConnect(new Error('Connection closed by caller'));
      this.abortConnect = null;
    }
    for (const [rid, p] of this.pending.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error('Connection closed'));
      this.pending.delete(rid);
    }
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      this.safeDisposeSocket(ws);
    }
  }

  wasClosedByCaller(): boolean {
    return this.closedByCaller;
  }
}

export class DerivBotEngine {
  private listeners = new Set<Listener>();
  private account: AccountInfo | null = null;
  private credentials: {
    token: string;
    authMode: AuthMode;
    accountId?: string;
    appId: string;
    virtualToken?: string;
  } | null = null;

  private accountConn: DerivWsConnection | null = null;
  private tickConn: DerivWsConnection | null = null;
  private tickMarket = 'R_100';
  private tickConnectingMarket: string | null = null;
  private ticks: TickPoint[] = [];

  private multiTickConn: DerivWsConnection | null = null;
  private multiConnectPromise: Promise<DerivWsConnection> | null = null;
  private multiSubscribedSymbols = new Set<string>();
  private multiTicks: Record<string, TickPoint[]> = {};

  private positions = new Map<string, OpenPosition>();
  private subscribedPositionIds = new Set<string>();

  private settings: BotSettings = structuredClone(DEFAULT_SETTINGS);
  private strategies: SavedStrategy[] = [];
  private trades: TradeRecord[] = [];
  private logs: LogEntry[] = [];
  private cfCache = new Map<string, any[]>();

  private session: SessionStats = this.createIdleSession();
  private activeTrade: ActiveTrade | null = null;
  private stopRequested = false;
  private activeLoopPromise: Promise<void> | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadStrategies();
    this.loadSettings();
    if (this.settings.market && MARKET_DECIMALS[this.settings.market]) {
      this.tickMarket = this.settings.market;
    }
    this.startTickStream(this.tickMarket).catch(() => {});
    this.restorePersistedConnection().catch(() => {});
  }

  private createIdleSession(): SessionStats {
    return {
      status: 'idle',
      contractStage: 'NOT_RUNNING',
      realTrades: 0,
      realWins: 0,
      realLosses: 0,
      virtualTrades: 0,
      virtualWins: 0,
      virtualLossesStreak: 0,
      vneed: 0,
      inRealPhase: true,
      totalStake: 0,
      totalPayout: 0,
      totalProfit: 0,
      currentStake: 0,
      baseStake: 0,
      martingaleStep: 0,
      currentTicks: 1,
      activeTypeIndex: 0,
      activeType: null,
      currency: this.account?.currency ?? 'USD',
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: string, payload: unknown): void {
    for (const fn of this.listeners) {
      try {
        fn(event, payload);
      } catch {
        // ignore listener failure
      }
    }
  }

  private addLog(level: LogEntry['level'], message: string): void {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: nowIso(),
      level,
      message,
    };
    this.logs = [entry, ...this.logs].slice(0, 250);
    this.emit('log', entry);
  }

  private setActiveTrade(trade: ActiveTrade | null): void {
    this.activeTrade = trade;
    this.emit('active_trade', trade);
  }

  getSnapshot(): AppSnapshot {
    return {
      account: this.account,
      session: this.session,
      activeTrade: this.activeTrade,
      trades: this.trades,
      logs: this.logs,
      strategies: this.strategies,
      ticks: this.ticks,
      tickMarket: this.tickMarket,
      settings: this.settings,
      multiTicks: this.multiTicks,
      positions: Array.from(this.positions.values()),
    };
  }

  // ---------- Persistence for Connection, Settings & Strategies ----------
  private ensureDataDir(): void {
    const dir = path.dirname(STRATEGIES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.settings = { ...structuredClone(DEFAULT_SETTINGS), ...parsed };
        }
      }
    } catch {
      this.settings = structuredClone(DEFAULT_SETTINGS);
    }
  }

  getSettings(): BotSettings {
    return this.settings;
  }

  saveSettings(next: BotSettings): BotSettings {
    this.settings = { ...structuredClone(DEFAULT_SETTINGS), ...structuredClone(next) };
    try {
      this.ensureDataDir();
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    } catch {
      // ignore if read-only
    }
    this.emit('settings', this.settings);
    return this.settings;
  }

  private saveConnectionToDisk(creds: {
    token: string;
    authMode: AuthMode;
    accountId?: string;
    appId: string;
    virtualToken?: string;
  }): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(CONNECTION_FILE, JSON.stringify(creds, null, 2));
    } catch {
      // ignore
    }
  }

  private clearConnectionFromDisk(): void {
    try {
      if (fs.existsSync(CONNECTION_FILE)) {
        fs.unlinkSync(CONNECTION_FILE);
      }
    } catch {
      // ignore
    }
  }

  private async restorePersistedConnection(): Promise<void> {
    try {
      if (!fs.existsSync(CONNECTION_FILE)) return;
      const raw = fs.readFileSync(CONNECTION_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
        await this.connectAccount({
          token: parsed.token,
          authMode: parsed.authMode,
          accountId: parsed.accountId,
          appId: parsed.appId,
          virtualToken: parsed.virtualToken,
        });
      }
    } catch {
      // ignore invalid saved connection on boot
    }
  }

  private loadStrategies(): void {
    try {
      if (fs.existsSync(STRATEGIES_FILE)) {
        const raw = fs.readFileSync(STRATEGIES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.strategies = parsed;
        }
      }
    } catch {
      this.strategies = [];
    }
  }

  private saveStrategiesToDisk(): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(STRATEGIES_FILE, JSON.stringify(this.strategies, null, 2));
    } catch {
      // ignore if read-only
    }
  }

  listStrategies(): SavedStrategy[] {
    return this.strategies;
  }

  saveStrategy(name: string, settings: BotSettings): SavedStrategy {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) {
      throw new Error('Strategy name must be 1 to 40 characters.');
    }
    if (
      this.strategies.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      throw new Error('A strategy with that name already exists.');
    }
    const now = nowIso();
    const item: SavedStrategy = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      settings: structuredClone(settings),
    };
    this.strategies = [item, ...this.strategies];
    this.saveStrategiesToDisk();
    this.emit('strategies', this.strategies);
    return item;
  }

  updateStrategy(
    id: string,
    patch: { name?: string; settings?: Partial<BotSettings> }
  ): SavedStrategy {
    const idx = this.strategies.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Strategy not found.');
    const existing = this.strategies[idx];
    let nextName = existing.name;
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed || trimmed.length > 40) {
        throw new Error('Strategy name must be 1 to 40 characters.');
      }
      if (
        this.strategies.some(
          (s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase()
        )
      ) {
        throw new Error('Another strategy already uses that name.');
      }
      nextName = trimmed;
    }
    const updated: SavedStrategy = {
      ...existing,
      name: nextName,
      updatedAt: nowIso(),
      settings: patch.settings
        ? { ...existing.settings, ...patch.settings }
        : existing.settings,
    };
    this.strategies = this.strategies.map((s) => (s.id === id ? updated : s));
    this.saveStrategiesToDisk();
    this.emit('strategies', this.strategies);
    return updated;
  }

  deleteStrategy(id: string): void {
    this.strategies = this.strategies.filter((s) => s.id !== id);
    this.saveStrategiesToDisk();
    this.emit('strategies', this.strategies);
  }

  // ---------- Live Market Tick Stream ----------
  async startTickStream(market: string): Promise<void> {
    if (!MARKET_DECIMALS[market]) {
      throw new Error(`Unsupported market: ${market}`);
    }
    if (
      this.tickMarket === market &&
      ((this.tickConn?.isOpen() && this.ticks.length > 0) ||
        this.tickConnectingMarket === market)
    ) {
      return;
    }

    this.tickMarket = market;
    this.tickConnectingMarket = market;
    this.ticks = [];
    this.emit('ticks_reset', { market });

    if (this.tickConn) {
      await this.tickConn.close();
    }

    const conn = new DerivWsConnection();
    this.tickConn = conn;

    try {
      if (this.credentials?.authMode === 'api_token') {
        try {
          await conn.connect(
            `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(this.credentials.appId)}`
          );
        } catch {
          await conn.connect(PUBLIC_WS_URL, 20_000, {
            'Deriv-App-ID': DERIV_DATA_APP_ID,
          });
        }
      } else {
        await conn.connect(PUBLIC_WS_URL, 20_000, {
          'Deriv-App-ID': DERIV_DATA_APP_ID,
        });
      }

      conn.onMessage((msg) => {
        if (msg.msg_type === 'history' && msg.history) {
          const prices: number[] = msg.history.prices ?? [];
          const times: number[] = msg.history.times ?? [];
          const pts: TickPoint[] = prices.map((p, i) => ({
            epoch: times[i] ?? Math.floor(Date.now() / 1000),
            quote: Number(p),
            lastDigit: extractLastDigit(Number(p), market),
          }));
          this.ticks = pts.slice(-60);
          this.emit('ticks', { market, ticks: this.ticks });
        } else if (msg.msg_type === 'tick' && msg.tick && msg.tick.symbol === market) {
          const q = Number(msg.tick.quote);
          const pt: TickPoint = {
            epoch: Number(msg.tick.epoch),
            quote: q,
            lastDigit: extractLastDigit(q, market),
          };
          this.ticks = [...this.ticks, pt].slice(-60);
          this.emit('tick', { market, tick: pt });
        }
      });

      const histRes = await conn.request({
        ticks_history: market,
        adjust_start_time: 1,
        count: 50,
        end: 'latest',
        style: 'ticks',
        subscribe: 1,
      });

      if (histRes.error) {
        this.addLog('warn', `Tick feed notice (${market}): ${histRes.error.message}`);
      }
    } catch (err: any) {
      if (!conn.wasClosedByCaller()) {
        this.addLog('warn', `Market stream error: ${err?.message ?? 'Disconnected'}`);
      }
    } finally {
      if (this.tickConnectingMarket === market) {
        this.tickConnectingMarket = null;
      }
    }
  }

  // ---------- Multi-Market Tick Stream (for AutoBot & Analysis Tool) ----------
  async subscribeMultiMarkets(symbols: string[]): Promise<void> {
    const valid = Array.from(
      new Set(symbols.map((s) => s.trim()).filter((s) => s.length > 0))
    ).slice(0, 20);
    if (valid.length === 0) return;

    let conn = this.multiTickConn;
    if (!conn || !conn.isOpen()) {
      if (!this.multiConnectPromise) {
        this.multiConnectPromise = (async () => {
          if (this.multiTickConn) {
            await this.multiTickConn.close().catch(() => {});
          }
          const nextConn = new DerivWsConnection();
          this.multiTickConn = nextConn;
          this.multiSubscribedSymbols.clear();
          await nextConn.connect(PUBLIC_WS_URL, 20_000, {
            'Deriv-App-ID': DERIV_DATA_APP_ID,
          });
          nextConn.onMessage((msg) => {
            if (msg.msg_type === 'history' && msg.history && msg.echo_req?.ticks_history) {
              const sym = String(msg.echo_req.ticks_history);
              const prices: number[] = msg.history.prices ?? [];
              const times: number[] = msg.history.times ?? [];
              const pts: TickPoint[] = prices.map((p, i) => ({
                epoch: times[i] ?? Math.floor(Date.now() / 1000),
                quote: Number(p),
                lastDigit: extractLastDigit(Number(p), sym),
              }));
              this.multiTicks[sym] = pts.slice(-200);
              this.emit('multi_ticks', { symbol: sym, ticks: this.multiTicks[sym] });
            } else if (msg.msg_type === 'tick' && msg.tick) {
              const sym = String(msg.tick.symbol);
              const q = Number(msg.tick.quote);
              const pt: TickPoint = {
                epoch: Number(msg.tick.epoch),
                quote: q,
                lastDigit: extractLastDigit(q, sym),
              };
              const prev = this.multiTicks[sym] ?? [];
              this.multiTicks[sym] = [...prev, pt].slice(-200);
              this.emit('multi_tick', { symbol: sym, tick: pt });
            }
          });
          return nextConn;
        })().finally(() => {
          this.multiConnectPromise = null;
        });
      }
      conn = await this.multiConnectPromise;
    }

    const toSubscribe = valid.filter((sym) => !this.multiSubscribedSymbols.has(sym));
    for (const sym of toSubscribe) {
      this.multiSubscribedSymbols.add(sym);
      conn
        .request({
          ticks_history: sym,
          adjust_start_time: 1,
          count: 150,
          end: 'latest',
          style: 'ticks',
          subscribe: 1,
        })
        .catch(() => {
          this.multiSubscribedSymbols.delete(sym);
        });
    }
  }

  // ---------- Account Connection & Real/Demo Detection ----------
  private async getPatWsUrl(accountId: string, pat: string, appId: string): Promise<string> {
    const res = await fetch(`${PAT_API_URL}/accounts/${encodeURIComponent(accountId)}/otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Deriv-App-ID': appId,
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Deriv PAT authentication failed (${res.status}): ${txt || res.statusText}`);
    }
    const json: any = await res.json();
    const url = json?.data?.url;
    if (!url) {
      throw new Error('Deriv OTP endpoint did not return a WebSocket URL.');
    }
    return url;
  }

  private async openAccountConnection(creds: {
    token: string;
    authMode: AuthMode;
    accountId?: string;
    appId: string;
  }): Promise<{ conn: DerivWsConnection; info: AccountInfo }> {
    const conn = new DerivWsConnection();

    if (creds.authMode === 'pat') {
      if (!creds.accountId?.trim()) {
        throw new Error('Deriv Account ID is required when using a pat_ token.');
      }
      const wsUrl = await this.getPatWsUrl(creds.accountId.trim(), creds.token, creds.appId);
      await conn.connect(wsUrl);
      const balRes = await conn.request({ balance: 1, subscribe: 1 });
      if (balRes.error) {
        await conn.close();
        throw new Error(balRes.error.message);
      }
      const balData = balRes.balance ?? {};
      const loginId = String(balData.loginid || creds.accountId.trim());
      const isVirtual =
        typeof balData.is_virtual === 'number'
          ? balData.is_virtual === 1
          : detectDemoFromLoginId(loginId);

      const info: AccountInfo = {
        connected: true,
        authMode: 'pat',
        loginId,
        accountType: isVirtual ? 'DEMO' : 'REAL',
        isVirtual,
        balance: Number(balData.balance ?? 0),
        currency: String(balData.currency || 'USD'),
        appId: creds.appId,
        lastUpdated: nowIso(),
      };
      return { conn, info };
    }

    // Standard Deriv API Token (wss://ws.derivws.com/websockets/v3)
    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(creds.appId)}`;
    await conn.connect(wsUrl);

    const authRes = await conn.request({ authorize: creds.token });
    if (authRes.error) {
      await conn.close();
      throw new Error(authRes.error.message || 'Invalid Deriv API token.');
    }

    const auth = authRes.authorize;
    const isVirtual = Number(auth.is_virtual) === 1;
    const loginId = String(auth.loginid || '');

    // Subscribe to live balance updates
    const balRes = await conn.request({ balance: 1, subscribe: 1 }).catch(() => null);
    const liveBalance =
      balRes && !balRes.error && balRes.balance
        ? Number(balRes.balance.balance)
        : Number(auth.balance ?? 0);
    const currency =
      balRes && !balRes.error && balRes.balance?.currency
        ? String(balRes.balance.currency)
        : String(auth.currency || 'USD');

    const info: AccountInfo = {
      connected: true,
      authMode: 'api_token',
      loginId,
      accountType: isVirtual ? 'DEMO' : 'REAL',
      isVirtual,
      balance: liveBalance,
      currency,
      fullname: auth.fullname ? String(auth.fullname) : undefined,
      email: auth.email ? String(auth.email) : undefined,
      scopes: Array.isArray(auth.scopes) ? auth.scopes : undefined,
      appId: creds.appId,
      lastUpdated: nowIso(),
    };

    return { conn, info };
  }

  private attachAccountListeners(conn: DerivWsConnection): void {
    conn.onMessage((msg) => {
      if (msg.msg_type === 'balance' && msg.balance && this.account) {
        const nextBal = Number(msg.balance.balance);
        const nextCur = msg.balance.currency
          ? String(msg.balance.currency)
          : this.account.currency;
        const loginId = msg.balance.loginid
          ? String(msg.balance.loginid)
          : this.account.loginId;
        const isVirtual =
          typeof msg.balance.is_virtual === 'number'
            ? msg.balance.is_virtual === 1
            : this.account.isVirtual;

        this.account = {
          ...this.account,
          balance: nextBal,
          currency: nextCur,
          loginId,
          isVirtual,
          accountType: isVirtual ? 'DEMO' : 'REAL',
          lastUpdated: nowIso(),
        };
        this.emit('account', this.account);
      } else if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
        const poc = msg.proposal_open_contract;
        const cid = String(poc.contract_id);
        if (this.subscribedPositionIds.has(cid)) {
          const sym = String(poc.underlying_symbol || poc.underlying || poc.symbol || '');
          const pos: OpenPosition = {
            id: cid,
            symbol: sym,
            contractType: String(poc.contract_type || ''),
            buyPrice: Number(poc.buy_price ?? 0),
            profit: Number(poc.profit ?? 0),
            currency: String(poc.currency || this.account?.currency || 'USD'),
            entrySpot: poc.entry_spot !== undefined ? Number(poc.entry_spot) : undefined,
            currentSpot: poc.current_spot !== undefined ? Number(poc.current_spot) : undefined,
            isSold: Boolean(poc.is_sold),
          };
          if (poc.is_sold) {
            this.positions.delete(cid);
            this.subscribedPositionIds.delete(cid);
            this.emit('mt_closed', {
              ...pos,
              entrySpot: poc.entry_tick_display_value || poc.entry_spot,
              exitSpot: poc.exit_tick_display_value || poc.exit_tick,
              timestamp: nowIso(),
            });
          } else {
            this.positions.set(cid, pos);
          }
          this.emit('positions', Array.from(this.positions.values()));
        }
      }
    });
  }

  async connectAccount(params: {
    token: string;
    authMode?: AuthMode;
    accountId?: string;
    appId?: string;
    virtualToken?: string;
  }): Promise<AccountInfo> {
    const token = params.token.trim();
    if (!token) {
      throw new Error('Please enter your Deriv API token.');
    }
    if (this.session.status === 'running') {
      throw new Error('Stop the active trading session before switching accounts.');
    }

    const authMode: AuthMode =
      params.authMode ?? (token.startsWith('pat_') ? 'pat' : 'api_token');
    const appId =
      params.appId?.trim() ||
      (authMode === 'pat' ? DEFAULT_PAT_APP_ID : DEFAULT_WS_APP_ID);

    const creds = {
      token,
      authMode,
      accountId: params.accountId?.trim(),
      appId,
      virtualToken: params.virtualToken?.trim() || undefined,
    };

    const { conn, info } = await this.openAccountConnection(creds);

    if (this.accountConn) {
      await this.accountConn.close();
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.credentials = creds;
    this.accountConn = conn;
    this.account = info;
    this.cfCache.clear();
    this.attachAccountListeners(conn);

    // Keep WebSocket alive with periodic pings
    this.pingInterval = setInterval(() => {
      if (this.accountConn?.isOpen()) {
        this.accountConn.request({ ping: 1 }).catch(() => {});
      }
    }, 25_000);

    this.session.currency = info.currency;
    this.saveConnectionToDisk(creds);
    this.emit('account', this.account);
    this.emit('session', this.session);
    this.addLog('info', `You are using your ${info.currency} account (${info.accountType} · ${info.loginId}).`);
    this.addLog(
      'info',
      `Connected ${info.accountType} account (${info.loginId}) · Balance ${info.balance.toFixed(2)} ${info.currency}`
    );

    // Refresh tick stream if appId changed
    this.startTickStream(this.tickMarket).catch(() => {});
    this.fetchPortfolio().catch(() => {});

    return info;
  }

  async refreshBalance(): Promise<AccountInfo> {
    if (!this.accountConn || !this.credentials) {
      throw new Error('No account connected.');
    }
    if (!this.accountConn.isOpen()) {
      const { conn, info } = await this.openAccountConnection(this.credentials);
      this.accountConn = conn;
      this.account = info;
      this.attachAccountListeners(conn);
      this.emit('account', this.account);
      return info;
    }
    const res = await this.accountConn.request({ balance: 1 });
    if (res.error) throw new Error(res.error.message);
    if (this.account && res.balance) {
      this.account = {
        ...this.account,
        balance: Number(res.balance.balance),
        currency: String(res.balance.currency || this.account.currency),
        lastUpdated: nowIso(),
      };
      this.emit('account', this.account);
    }
    return this.account!;
  }

  async disconnectAccount(): Promise<void> {
    if (this.session.status === 'running') {
      await this.stopSession();
      if (this.activeLoopPromise) {
        await this.activeLoopPromise.catch(() => {});
      }
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.accountConn) {
      await this.accountConn.close();
      this.accountConn = null;
    }
    this.credentials = null;
    this.account = null;
    this.positions.clear();
    this.subscribedPositionIds.clear();
    this.cfCache.clear();
    this.clearConnectionFromDisk();
    this.emit('account', null);
    this.emit('positions', []);
    this.addLog('info', 'Account disconnected and token cleared from memory.');
  }

  // ---------- MetaTrader Instant Orders & Positions ----------
  async fetchPortfolio(): Promise<OpenPosition[]> {
    if (!this.accountConn || !this.credentials) return [];
    if (!this.accountConn.isOpen()) {
      const { conn, info } = await this.openAccountConnection(this.credentials);
      this.accountConn = conn;
      this.account = info;
      this.attachAccountListeners(conn);
    }
    const res = await this.accountConn.request({ portfolio: 1 });
    if (res.error) throw new Error(res.error.message);
    const contracts: any[] = res.portfolio?.contracts ?? [];
    const activeIds = new Set<string>();
    for (const c of contracts) {
      const cid = String(c.contract_id);
      activeIds.add(cid);
      if (!this.positions.has(cid)) {
        this.positions.set(cid, {
          id: cid,
          symbol: String(c.symbol || c.underlying || ''),
          contractType: String(c.contract_type || ''),
          buyPrice: Number(c.buy_price ?? 0),
          profit: 0,
          currency: this.account?.currency || 'USD',
        });
      }
      if (!this.subscribedPositionIds.has(cid)) {
        this.subscribedPositionIds.add(cid);
        this.accountConn
          .request({
            proposal_open_contract: 1,
            contract_id: Number(cid) || cid,
            subscribe: 1,
          })
          .catch(() => {});
      }
    }
    for (const cid of Array.from(this.positions.keys())) {
      if (!activeIds.has(cid)) {
        this.positions.delete(cid);
        this.subscribedPositionIds.delete(cid);
      }
    }
    const list = Array.from(this.positions.values());
    this.emit('positions', list);
    return list;
  }

  async placeManualOrder(params: {
    symbol: string;
    contractType: string;
    stake: number;
    multiplier?: number;
    duration?: number;
    durationUnit?: string;
  }): Promise<OpenPosition> {
    if (!this.account || !this.credentials || !this.accountConn) {
      throw new Error('Connect your Deriv API token before placing an order.');
    }
    if (!this.accountConn.isOpen()) {
      const { conn, info } = await this.openAccountConnection(this.credentials);
      this.accountConn = conn;
      this.account = info;
      this.attachAccountListeners(conn);
    }

    const stake = Number(params.stake);
    if (!Number.isFinite(stake) || stake <= 0) {
      throw new Error('Order stake must be greater than 0.');
    }

    const symbolKey = this.credentials.authMode === 'pat' ? 'underlying_symbol' : 'symbol';
    const currency = this.account.currency || 'USD';
    const orderParams: Record<string, unknown> = {
      amount: stake,
      basis: 'stake',
      contract_type: params.contractType,
      currency,
      [symbolKey]: params.symbol,
    };

    if (params.contractType === 'MULTUP' || params.contractType === 'MULTDOWN') {
      orderParams.multiplier = params.multiplier ?? 100;
    } else {
      orderParams.duration = params.duration ?? 1;
      orderParams.duration_unit = params.durationUnit ?? 'm';
    }

    const buyRes = await this.accountConn.request({
      buy: 1,
      price: stake,
      parameters: orderParams,
    });
    if (buyRes.error) {
      throw new Error(buyRes.error.message || 'Order rejected by Deriv.');
    }

    const cid = String(buyRes.buy.contract_id);
    const pos: OpenPosition = {
      id: cid,
      symbol: params.symbol,
      contractType: params.contractType,
      buyPrice: Number(buyRes.buy.buy_price ?? stake),
      profit: 0,
      currency,
    };
    this.positions.set(cid, pos);
    this.subscribedPositionIds.add(cid);
    this.emit('positions', Array.from(this.positions.values()));

    this.accountConn
      .request({
        proposal_open_contract: 1,
        contract_id: Number(cid) || cid,
        subscribe: 1,
      })
      .catch(() => {});

    return pos;
  }

  async closePosition(contractId: string): Promise<void> {
    if (!this.accountConn || !this.accountConn.isOpen()) {
      throw new Error('Deriv account connection is not active.');
    }
    const res = await this.accountConn.request({
      sell: Number(contractId) || contractId,
      price: 0,
    });
    if (res.error) {
      throw new Error(res.error.message || 'Could not close position.');
    }
  }

  // ---------- Trading Helpers ----------
  private validateSettings(s: BotSettings): void {
    if (!MARKET_DECIMALS[s.market]) {
      throw new Error('Select a valid market.');
    }
    if (!s.types || s.types.length === 0) {
      throw new Error('Select at least one trade type.');
    }
    if (s.mode === 'hybrid' && s.types.length < 2) {
      throw new Error('Hybrid mode requires at least 2 trade types.');
    }
    const minStake = s.types.includes('Accumulator') ? 1.0 : 0.01;
    if (!Number.isFinite(s.stake) || s.stake < minStake || s.stake > 5000) {
      throw new Error(`Stake must be between ${minStake} and 5000.`);
    }
    const needsDur = s.types.some((t) => t !== 'Accumulator');
    const hasBarrier = s.types.some((t) => BARRIER_TYPES.includes(t) || t === 'Dual H/L');
    const minTicks = hasBarrier ? 5 : 1;
    if (needsDur && (!Number.isInteger(s.ticks) || s.ticks < minTicks || s.ticks > 10)) {
      throw new Error(`Duration must be an integer between ${minTicks} and 10 ticks.`);
    }
    for (const t of s.types) {
      if (t === 'Higher' || t === 'Lower' || t === 'Dual H/L') {
        const checkList: ('Higher' | 'Lower')[] =
          t === 'Dual H/L' ? ['Higher', 'Lower'] : [t];
        for (const bt of checkList) {
          const b = s.barriers[bt];
          if (!b || !/^[+-][0-9]+(\.[0-9]+)?$/.test(b.trim())) {
            throw new Error(`Barrier for ${bt} must be a signed offset like +0.5 or -0.5.`);
          }
        }
      }
      if (t === 'Accumulator') {
        if (![0.01, 0.02, 0.03, 0.04, 0.05].includes(Number(s.growth.toFixed(2)))) {
          throw new Error('Accumulator growth rate must be 1% to 5%.');
        }
        if (!Number.isFinite(s.atp) || s.atp < 0.01) {
          throw new Error('Accumulator limit take profit must be >= 0.01.');
        }
      }
    }
    if (s.mart) {
      if (!Number.isFinite(s.mult) || s.mult < 1.1 || s.mult > 100) {
        throw new Error('Martingale multiplier must be between 1.1 and 100.');
      }
      if (s.martTickStep > 0) {
        if (s.martTickStep < 1 || s.martTickStep > 50) {
          throw new Error('Martingale tick step must be between 1 and 50.');
        }
        if (s.martTicks < minTicks || s.martTicks > 10 || s.martTicks === s.ticks) {
          throw new Error(
            `Martingale alternate ticks must be ${minTicks}-10 and different from normal duration.`
          );
        }
      }
    }
    if (s.virtual && (s.vneed < 1 || s.vneed > 50)) {
      throw new Error('Virtual losses required must be between 1 and 50.');
    }
    if (!Number.isFinite(s.tp) || s.tp <= 0) {
      throw new Error('Take profit must be greater than 0.');
    }
    if (!Number.isFinite(s.sl) || s.sl <= 0) {
      throw new Error('Stop loss must be greater than 0.');
    }
  }

  private pickParam(s: BotSettings, t: TradeType): string | number | null {
    if (DIGIT_TYPES.includes(t)) {
      const dt = t as 'Differs' | 'Over' | 'Under';
      const fixed = s.digits[dt];
      if (fixed !== null && fixed !== undefined) return fixed;
      const pool = VALID_DIGITS[dt];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    if (BARRIER_TYPES.includes(t)) {
      return s.barriers[t as 'Higher' | 'Lower'] ?? '+0.5';
    }
    return null;
  }

  private makeLabel(s: BotSettings, t: TradeType, param: string | number | null): string {
    if (t === 'Accumulator') return `Accumulator ${Math.round(s.growth * 100)}%`;
    if (t === 'Dual H/L') return `Dual H${s.barriers.Higher}/L${s.barriers.Lower}`;
    if (t === 'Dual O5/U4') return 'Dual Over 5 / Under 4';
    return param !== null ? `${t} ${param}` : t;
  }

  private mapContractType(t: TradeType, authMode: AuthMode): string {
    switch (t) {
      case 'Differs':
        return 'DIGITDIFF';
      case 'Over':
        return 'DIGITOVER';
      case 'Under':
        return 'DIGITUNDER';
      case 'Even':
        return 'DIGITEVEN';
      case 'Odd':
        return 'DIGITODD';
      case 'Rise':
        return 'CALL';
      case 'Fall':
        return 'PUT';
      case 'Higher':
        return authMode === 'pat' ? 'HIGHER' : 'CALL';
      case 'Lower':
        return authMode === 'pat' ? 'LOWER' : 'PUT';
      case 'Accumulator':
        return 'ACCU';
      default:
        return 'CALL';
    }
  }

  private buildProposal(
    s: BotSettings,
    t: TradeType,
    param: string | number | null,
    stake: number,
    currency: string,
    ticks: number,
    authMode: AuthMode
  ): Record<string, unknown> {
    const symbolKey = authMode === 'pat' ? 'underlying_symbol' : 'symbol';

    if (t === 'Accumulator') {
      return {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type: 'ACCU',
        currency,
        growth_rate: s.growth,
        [symbolKey]: s.market,
        limit_order: { take_profit: s.atp },
      };
    }

    const req: Record<string, unknown> = {
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: this.mapContractType(t, authMode),
      currency,
      duration: ticks,
      duration_unit: 't',
      [symbolKey]: s.market,
    };

    if (param !== null) {
      req.barrier = String(param);
    }
    return req;
  }

  private dualLegs(
    s: BotSettings,
    t: TradeType,
    authMode: AuthMode
  ): Array<{ ctype: string; barrier: string }> {
    if (t === 'Dual O5/U4') {
      return [
        { ctype: 'DIGITOVER', barrier: '5' },
        { ctype: 'DIGITUNDER', barrier: '4' },
      ];
    }
    return [
      {
        ctype: authMode === 'pat' ? 'HIGHER' : 'CALL',
        barrier: s.barriers.Higher ?? '+0.5',
      },
      {
        ctype: authMode === 'pat' ? 'LOWER' : 'PUT',
        barrier: s.barriers.Lower ?? '-0.5',
      },
    ];
  }

  private async checkBarrierContract(
    conn: DerivWsConnection,
    market: string,
    t: 'Higher' | 'Lower',
    ticks: number,
    authMode: AuthMode
  ): Promise<void> {
    if (!this.cfCache.has(market)) {
      const res = await conn.request({ contracts_for: market });
      if (res.error) throw new Error(res.error.message);
      this.cfCache.set(market, res.contracts_for?.available ?? []);
    }
    const available = this.cfCache.get(market)!;
    const targetType = this.mapContractType(t, authMode);
    const matching = available.filter((c) => {
      if (c.contract_type !== targetType) return false;
      if (authMode === 'api_token' && c.barrier_category) {
        return c.barrier_category !== 'euro_atm';
      }
      return true;
    });

    if (matching.length === 0) {
      // Fallback: check any matching contract_type
      const anyType = available.filter((c) => c.contract_type === targetType);
      if (anyType.length === 0) {
        throw new Error(`${t} is not available on ${market}.`);
      }
    }

    const candidates = matching.length > 0 ? matching : available.filter((c) => c.contract_type === targetType);
    const parseTicks = (v: unknown): number | null => {
      const str = String(v ?? '');
      return str.endsWith('t') && /^\d+$/.test(str.slice(0, -1))
        ? Number(str.slice(0, -1))
        : null;
    };

    for (const c of candidates) {
      const lo = parseTicks(c.min_contract_duration);
      const hi = parseTicks(c.max_contract_duration);
      if (lo !== null && hi !== null && ticks >= lo && ticks <= hi) {
        return;
      }
    }

    if (candidates.length > 0 && ticks < 5) {
      throw new Error(
        `${t} on ${market}: ${ticks} ticks not supported (allowed ${candidates[0].min_contract_duration} to ${candidates[0].max_contract_duration}).`
      );
    }
  }

  private async waitSettled(
    conn: DerivWsConnection,
    contractIds: string[],
    ensureConn: () => Promise<DerivWsConnection>,
    onEntrySpot?: (entrySpot: number, currentSpot?: number) => void
  ): Promise<{ profits: Record<string, number>; entrySpot?: number; exitSpot?: number }> {
    const profits: Record<string, number> = {};
    let entrySpot: number | undefined;
    let exitSpot: number | undefined;
    let activeConn = conn;

    while (Object.keys(profits).length < contractIds.length) {
      const unsubRef: { fn: (() => void) | null } = { fn: null };

      try {
        await new Promise<void>(async (resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubRef.fn?.();
            reject(new Error('Contract settlement timed out'));
          }, 90_000);

          unsubRef.fn = activeConn.onMessage((msg) => {
            if (msg.error) {
              clearTimeout(timeout);
              unsubRef.fn?.();
              reject(new Error(msg.error.message));
              return;
            }
            const poc = msg.proposal_open_contract;
            if (poc && contractIds.includes(String(poc.contract_id))) {
              if (poc.entry_spot !== undefined) {
                entrySpot = Number(poc.entry_spot);
                onEntrySpot?.(
                  entrySpot,
                  poc.current_spot !== undefined ? Number(poc.current_spot) : undefined
                );
              } else if (poc.current_spot !== undefined && entrySpot !== undefined) {
                onEntrySpot?.(entrySpot, Number(poc.current_spot));
              }
              if (poc.exit_tick !== undefined) exitSpot = Number(poc.exit_tick);
              if (poc.is_sold) {
                profits[String(poc.contract_id)] = Number(poc.profit);
                if (Object.keys(profits).length >= contractIds.length) {
                  clearTimeout(timeout);
                  unsubRef.fn?.();
                  resolve();
                }
              }
            }
          });

          for (const cid of contractIds) {
            if (profits[cid] === undefined) {
              const subRes = await activeConn
                .request({
                  proposal_open_contract: 1,
                  contract_id: Number(cid) || cid,
                  subscribe: 1,
                })
                .catch((err) => ({ error: { message: err.message } }));

              if (subRes?.error) {
                clearTimeout(timeout);
                unsubRef.fn?.();
                reject(new Error(subRes.error.message));
                return;
              }
              const poc = subRes?.proposal_open_contract;
              if (poc) {
                if (poc.entry_spot !== undefined) {
                  entrySpot = Number(poc.entry_spot);
                  onEntrySpot?.(
                    entrySpot,
                    poc.current_spot !== undefined ? Number(poc.current_spot) : undefined
                  );
                }
                if (poc.exit_tick !== undefined) exitSpot = Number(poc.exit_tick);
                if (poc.is_sold) {
                  profits[String(poc.contract_id)] = Number(poc.profit);
                }
              }
            }
          }

          if (Object.keys(profits).length >= contractIds.length) {
            clearTimeout(timeout);
            unsubRef.fn?.();
            resolve();
          }
        });
      } catch (err: any) {
        unsubRef.fn?.();
        if (this.stopRequested) throw err;
        // Reconnect and re-subscribe on socket drop
        if (err?.message?.includes('closed') || err?.message?.includes('not connected')) {
          this.addLog('warn', 'Connection interrupted while monitoring contract. Reconnecting...');
          activeConn = await ensureConn();
          continue;
        }
        throw err;
      }
    }

    return { profits, entrySpot, exitSpot };
  }

  private async executeSingleContract(
    conn: DerivWsConnection,
    s: BotSettings,
    t: TradeType,
    param: string | number | null,
    stake: number,
    currency: string,
    ticks: number,
    authMode: AuthMode,
    ensureConn: () => Promise<DerivWsConnection>,
    onPurchased?: (contractIds: string[]) => void,
    onEntrySpot?: (entrySpot: number, currentSpot?: number) => void
  ): Promise<{
    profit: number;
    contractIds: string[];
    entrySpot?: number;
    exitSpot?: number;
  }> {
    if (t === 'Higher' || t === 'Lower') {
      await this.checkBarrierContract(conn, s.market, t, ticks, authMode);
    }

    const req = this.buildProposal(s, t, param, stake, currency, ticks, authMode);
    const prop = await conn.request(req);
    if (prop.error) {
      throw new Error(prop.error.message);
    }

    const propId = prop.proposal?.id;
    if (!propId) {
      throw new Error('Proposal ID missing from Deriv response.');
    }

    const buyRes = await conn.request({ buy: propId, price: stake });
    if (buyRes.error) {
      throw new Error(buyRes.error.message);
    }

    const cid = String(buyRes.buy.contract_id);
    onPurchased?.([cid]);
    const settled = await this.waitSettled(conn, [cid], ensureConn, onEntrySpot);
    return {
      profit: settled.profits[cid] ?? 0,
      contractIds: [cid],
      entrySpot: settled.entrySpot,
      exitSpot: settled.exitSpot,
    };
  }

  private async executeDualContract(
    conn: DerivWsConnection,
    s: BotSettings,
    t: TradeType,
    stake: number,
    currency: string,
    ticks: number,
    authMode: AuthMode,
    ensureConn: () => Promise<DerivWsConnection>,
    onPurchased?: (contractIds: string[]) => void,
    onEntrySpot?: (entrySpot: number, currentSpot?: number) => void
  ): Promise<{
    profit: number;
    legs: number[];
    contractIds: string[];
    entrySpot?: number;
    exitSpot?: number;
  }> {
    if (t === 'Dual H/L') {
      await this.checkBarrierContract(conn, s.market, 'Higher', ticks, authMode);
      await this.checkBarrierContract(conn, s.market, 'Lower', ticks, authMode);
    }

    const legs = this.dualLegs(s, t, authMode);
    const symbolKey = authMode === 'pat' ? 'underlying_symbol' : 'symbol';

    const props = await Promise.all(
      legs.map((leg) =>
        conn.request({
          proposal: 1,
          amount: stake,
          basis: 'stake',
          contract_type: leg.ctype,
          currency,
          duration: ticks,
          duration_unit: 't',
          [symbolKey]: s.market,
          barrier: leg.barrier,
        })
      )
    );

    for (let i = 0; i < props.length; i++) {
      if (props[i].error) {
        throw new Error(`${legs[i].ctype} ${legs[i].barrier}: ${props[i].error.message}`);
      }
    }

    const buys = await Promise.all(
      props.map((p) => conn.request({ buy: p.proposal.id, price: stake }))
    );

    const cids: string[] = [];
    const errs: string[] = [];
    for (const b of buys) {
      if (b.error) errs.push(b.error.message);
      else cids.push(String(b.buy.contract_id));
    }
    if (cids.length === 0) {
      throw new Error(errs[0] || 'Failed to buy dual legs');
    }

    onPurchased?.(cids);
    const settled = await this.waitSettled(conn, cids, ensureConn, onEntrySpot);
    if (errs.length > 0) {
      const partial = cids.reduce((acc, c) => acc + (settled.profits[c] ?? 0), 0);
      throw new Error(`One leg failed (${errs[0]}). Other leg settled ${partial >= 0 ? '+' : ''}${partial.toFixed(2)}.`);
    }

    const legProfits = cids.map((c) => settled.profits[c] ?? 0);
    return {
      profit: legProfits.reduce((a, b) => a + b, 0),
      legs: legProfits,
      contractIds: cids,
      entrySpot: settled.entrySpot,
      exitSpot: settled.exitSpot,
    };
  }

  private async simulateVirtualTradeOnLiveTicks(
    s: BotSettings,
    t: TradeType,
    param: string | number | null,
    ticks: number
  ): Promise<{ profit: number; entrySpot: number; exitSpot: number; legs?: number[] }> {
    if (this.tickMarket !== s.market || !this.tickConn?.isOpen()) {
      await this.startTickStream(s.market);
    }

    const targetTicks = t === 'Accumulator' ? 2 : Math.max(1, ticks);
    const collected: TickPoint[] = [];

    await new Promise<void>((resolve, reject) => {
      let unsub: (() => void) | null = null;
      const timer = setTimeout(() => {
        if (unsub) unsub();
        reject(new Error('Live tick feed timed out during virtual trade.'));
      }, 30_000);

      unsub = this.tickConn!.onMessage((msg) => {
        if (msg.msg_type === 'tick' && msg.tick && msg.tick.symbol === s.market) {
          const q = Number(msg.tick.quote);
          collected.push({
            epoch: Number(msg.tick.epoch),
            quote: q,
            lastDigit: extractLastDigit(q, s.market),
          });
          // Need entry tick + targetTicks subsequent ticks
          if (collected.length >= targetTicks + 1) {
            clearTimeout(timer);
            if (unsub) unsub();
            resolve();
          }
        }
      });
    });

    const entry = collected[0];
    const exit = collected[collected.length - 1];
    const vStake = t === 'Accumulator' ? 1.0 : 0.35;

    let won = false;
    let profit = -vStake;
    let legs: number[] | undefined;

    if (t === 'Differs') {
      won = exit.lastDigit !== Number(param);
      profit = won ? Number((vStake * 0.09).toFixed(2)) : -vStake;
    } else if (t === 'Over') {
      won = exit.lastDigit > Number(param);
      profit = won ? Number((vStake * 0.95).toFixed(2)) : -vStake;
    } else if (t === 'Under') {
      won = exit.lastDigit < Number(param);
      profit = won ? Number((vStake * 0.95).toFixed(2)) : -vStake;
    } else if (t === 'Even') {
      won = exit.lastDigit % 2 === 0;
      profit = won ? Number((vStake * 0.95).toFixed(2)) : -vStake;
    } else if (t === 'Odd') {
      won = exit.lastDigit % 2 === 1;
      profit = won ? Number((vStake * 0.95).toFixed(2)) : -vStake;
    } else if (t === 'Rise') {
      won = exit.quote > entry.quote;
      profit = won ? Number((vStake * 0.95).toFixed(2)) : -vStake;
    } else if (t === 'Fall') {
      won = exit.quote < entry.quote;
      profit = won ? Number((vStake * 0.95).toFixed(2)) : -vStake;
    } else if (t === 'Higher') {
      const barrierOffset = parseFloat(s.barriers.Higher ?? '+0.5');
      won = exit.quote > entry.quote + barrierOffset;
      profit = won ? Number((vStake * 1.1).toFixed(2)) : -vStake;
    } else if (t === 'Lower') {
      const barrierOffset = parseFloat(s.barriers.Lower ?? '-0.5');
      won = exit.quote < entry.quote + barrierOffset;
      profit = won ? Number((vStake * 1.1).toFixed(2)) : -vStake;
    } else if (t === 'Dual O5/U4') {
      const leg1 = exit.lastDigit > 5 ? Number((vStake * 1.4).toFixed(2)) : -vStake;
      const leg2 = exit.lastDigit < 4 ? Number((vStake * 1.4).toFixed(2)) : -vStake;
      legs = [leg1, leg2];
      profit = Number((leg1 + leg2).toFixed(2));
      won = profit > 0;
    } else if (t === 'Dual H/L') {
      const hiOff = parseFloat(s.barriers.Higher ?? '+0.5');
      const loOff = parseFloat(s.barriers.Lower ?? '-0.5');
      const leg1 = exit.quote > entry.quote + hiOff ? Number((vStake * 1.2).toFixed(2)) : -vStake;
      const leg2 = exit.quote < entry.quote + loOff ? Number((vStake * 1.2).toFixed(2)) : -vStake;
      legs = [leg1, leg2];
      profit = Number((leg1 + leg2).toFixed(2));
      won = profit > 0;
    } else if (t === 'Accumulator') {
      // Check if spot stayed within modest tick band
      const diffPct = Math.abs(exit.quote - entry.quote) / Math.max(1, entry.quote);
      won = diffPct < 0.003;
      profit = won ? Number((vStake * s.growth * 2).toFixed(2)) : -vStake;
    }

    return {
      profit,
      entrySpot: entry.quote,
      exitSpot: exit.quote,
      legs,
    };
  }

  // ---------- Start / Stop Session ----------
  async startSession(rawSettings: BotSettings): Promise<void> {
    if (!this.account || !this.credentials || !this.accountConn) {
      throw new Error('Connect your Deriv API token before starting the bot.');
    }
    if (this.session.status === 'running' || this.session.status === 'stopping') {
      throw new Error('A trading session is already active.');
    }

    const s = structuredClone(rawSettings);
    this.validateSettings(s);
    this.saveSettings(s);

    // Ensure tick chart matches trading market
    this.startTickStream(s.market).catch(() => {});

    this.stopRequested = false;
    this.trades = [];
    this.emit('trades_reset', []);

    const fast = s.exec === 'fast';
    const baseStake = s.stake;
    const currency = this.account.currency;

    this.session = {
      status: 'running',
      contractStage: 'STARTING',
      startedAt: nowIso(),
      realTrades: 0,
      realWins: 0,
      realLosses: 0,
      virtualTrades: 0,
      virtualWins: 0,
      virtualLossesStreak: 0,
      vneed: s.virtual ? s.vneed : 0,
      inRealPhase: !s.virtual,
      totalStake: 0,
      totalPayout: 0,
      totalProfit: 0,
      currentStake: baseStake,
      baseStake,
      martingaleStep: 0,
      currentTicks: s.ticks,
      activeTypeIndex: 0,
      activeType: s.types[0],
      currency,
    };
    this.emit('session', this.session);

    const modeDesc =
      s.types.length > 1 ? `Hybrid (${s.types.join(' -> ')})` : s.types[0];
    this.addLog(
      'info',
      `${fast ? 'FAST' : 'NORMAL'} session started on ${MARKET_LABELS[s.market] || s.market} · ${modeDesc} · Base stake ${baseStake} ${currency} · TP ${s.tp} / SL ${s.sl}`
    );

    this.activeLoopPromise = this.runTradingLoop(s);
  }

  resetStats(): void {
    if (this.session.status === 'running' || this.session.status === 'stopping') {
      throw new Error('Stop the bot before resetting statistics.');
    }
    this.setActiveTrade(null);
    this.trades = [];
    this.logs = [];
    this.session = this.createIdleSession();
    if (this.account) {
      this.addLog('info', `You are using your ${this.account.currency} account.`);
    }
    this.emit('trades_reset', []);
    this.emit('logs_reset', this.logs);
    this.emit('session', this.session);
  }

  async stopSession(): Promise<void> {
    if (this.session.status !== 'running') {
      return;
    }
    this.stopRequested = true;
    this.session = {
      ...this.session,
      status: 'stopping',
      contractStage: 'IS_STOPPING',
    };
    this.emit('session', this.session);
    this.addLog('warn', 'Stop requested. Finishing current contract before halting...');
  }

  private async runTradingLoop(s: BotSettings): Promise<void> {
    const fast = s.exec === 'fast';
    const base = s.stake;
    let stake = base;
    let step = 0;
    let idx = 0;
    let vloss = 0;
    let inRealPhase = !s.virtual;
    let total = 0;
    let curTicks = s.ticks;
    let seq = 0;
    let stoppedReason = 'Stopped by user';

    const ensureAccountConn = async (): Promise<DerivWsConnection> => {
      if (this.accountConn?.isOpen()) return this.accountConn;
      if (!this.credentials) throw new Error('Account credentials cleared');

      let delay = 1000;
      for (let attempt = 0; attempt < 8; attempt++) {
        if (this.stopRequested) throw new Error('Stopped by user');
        try {
          const { conn, info } = await this.openAccountConnection(this.credentials);
          this.accountConn = conn;
          this.account = info;
          this.attachAccountListeners(conn);
          this.emit('account', this.account);
          this.addLog('info', 'Reconnected to Deriv WebSocket.');
          return conn;
        } catch {
          await sleep(delay);
          delay = Math.min(delay * 2, 15_000);
        }
      }
      throw new Error('Failed to reconnect to Deriv WebSocket after multiple attempts.');
    };

    // Optional separate virtual demo connection if user provided virtualToken
    let virtualConn: DerivWsConnection | null = null;
    let virtualCurrency = 'USD';
    let virtualAuthMode: AuthMode = 'api_token';

    if (s.virtual && this.credentials?.virtualToken) {
      try {
        const vToken = this.credentials.virtualToken;
        virtualAuthMode = vToken.startsWith('pat_') ? 'pat' : 'api_token';
        const res = await this.openAccountConnection({
          token: vToken,
          authMode: virtualAuthMode,
          appId: DEFAULT_WS_APP_ID,
        });
        virtualConn = res.conn;
        virtualCurrency = res.info.currency;
        this.addLog(
          'info',
          `Virtual phase linked to Demo account ${res.info.loginId} (${res.info.balance.toFixed(2)} ${virtualCurrency}).`
        );
      } catch (err: any) {
        this.addLog(
          'warn',
          `Virtual token connection failed (${err?.message}). Falling back to live tick virtual evaluation.`
        );
        virtualConn = null;
      }
    } else if (s.virtual) {
      this.addLog(
        'info',
        `Virtual mode active: waiting for ${s.vneed} consecutive virtual loss(es) on live market ticks.`
      );
    }

    const effectiveTicks = (): number => {
      if (s.mart && s.martTickStep > 0 && s.martTicks > 0 && step >= s.martTickStep) {
        return s.martTicks;
      }
      return s.ticks;
    };

    try {
      // Pre-check Higher/Lower duration support on market
      const conn0 = await ensureAccountConn();
      const ticksToCheck =
        s.mart && s.martTickStep > 0 && s.martTicks > 0
          ? [s.ticks, s.martTicks]
          : [s.ticks];
      for (const tk of ticksToCheck) {
        for (const t of s.types) {
          if (t === 'Higher' || t === 'Lower') {
            await this.checkBarrierContract(conn0, s.market, t, tk, this.credentials!.authMode);
          } else if (t === 'Dual H/L') {
            await this.checkBarrierContract(conn0, s.market, 'Higher', tk, this.credentials!.authMode);
            await this.checkBarrierContract(conn0, s.market, 'Lower', tk, this.credentials!.authMode);
          }
        }
      }

      while (!this.stopRequested) {
        const t = s.types[idx];
        const param = this.pickParam(s, t);
        const label = this.makeLabel(s, t, param);
        const tk = effectiveTicks();

        this.session = {
          ...this.session,
          activeTypeIndex: idx,
          activeType: t,
          currentTicks: tk,
          currentStake: stake,
          martingaleStep: step,
          virtualLossesStreak: vloss,
          inRealPhase: !s.virtual || inRealPhase,
        };
        this.emit('session', this.session);

        // ----- VIRTUAL PHASE -----
        if (s.virtual && !inRealPhase) {
          const vStake = t === 'Accumulator' ? 1.0 : 0.35;
          let vProfit = 0;
          let entrySpot: number | undefined;
          let exitSpot: number | undefined;
          let legs: number[] | undefined;
          let cids: string[] = [];

          if (virtualConn && virtualConn.isOpen()) {
            if (DUAL_TYPES.includes(t)) {
              const res = await this.executeDualContract(
                virtualConn,
                s,
                t,
                vStake,
                virtualCurrency,
                tk,
                virtualAuthMode,
                async () => virtualConn!
              );
              vProfit = res.profit;
              legs = res.legs;
              cids = res.contractIds;
              entrySpot = res.entrySpot;
              exitSpot = res.exitSpot;
            } else {
              const res = await this.executeSingleContract(
                virtualConn,
                s,
                t,
                param,
                vStake,
                virtualCurrency,
                tk,
                virtualAuthMode,
                async () => virtualConn!
              );
              vProfit = res.profit;
              cids = res.contractIds;
              entrySpot = res.entrySpot;
              exitSpot = res.exitSpot;
            }
          } else {
            const sim = await this.simulateVirtualTradeOnLiveTicks(s, t, param, tk);
            vProfit = sim.profit;
            entrySpot = sim.entrySpot;
            exitSpot = sim.exitSpot;
            legs = sim.legs;
            cids = ['LIVE-TICK-SIM'];
          }

          const vWon = vProfit > 0;
          const vTotalStake = DUAL_TYPES.includes(t) ? vStake * 2 : vStake;
          const vPayout = vProfit > 0 ? Number((vTotalStake + vProfit).toFixed(2)) : 0;
          vloss = vWon ? 0 : vloss + 1;
          seq += 1;

          const record: TradeRecord = {
            id: crypto.randomUUID(),
            seq,
            timestamp: nowIso(),
            isVirtual: true,
            market: s.market,
            marketLabel: MARKET_LABELS[s.market] || s.market,
            contractType: t,
            label,
            contractIds: cids,
            stake: vTotalStake,
            payout: vPayout,
            currency: virtualCurrency,
            ticks: tk,
            entrySpot,
            exitSpot,
            profit: vProfit,
            won: vWon,
            legs,
            martingaleStep: step,
            sessionTotalAfter: total,
          };

          this.trades = [record, ...this.trades].slice(0, 500);
          this.session = {
            ...this.session,
            contractStage: this.stopRequested ? 'IS_STOPPING' : 'CONTRACT_CLOSED',
            virtualTrades: this.session.virtualTrades + 1,
            virtualWins: this.session.virtualWins + (vWon ? 1 : 0),
            virtualLossesStreak: vloss,
          };

          this.emit('trade', record);
          this.emit('session', this.session);
          this.addLog(
            vWon ? 'win' : 'loss',
            `V#${this.session.virtualTrades} ${label} · ${vWon ? 'WIN' : 'LOSS'} ${vProfit >= 0 ? '+' : ''}${vProfit.toFixed(2)} · Virtual losses ${vloss}/${s.vneed}`
          );

          if (vloss >= s.vneed) {
            inRealPhase = true;
            this.session = { ...this.session, inRealPhase: true };
            this.emit('session', this.session);
            this.addLog('warn', `Virtual loss target (${s.vneed}) reached. Switching to REAL trade (${t}).`);
          }

          if (!fast && !this.stopRequested) {
            await sleep(900);
          }
          continue;
        }

        // ----- REAL TRADE PHASE -----
        this.session = {
          ...this.session,
          contractStage: this.stopRequested ? 'IS_STOPPING' : 'PURCHASE_SENT',
        };
        this.emit('session', this.session);

        const conn = await ensureAccountConn();
        const authMode = this.credentials!.authMode;
        const currency = this.account!.currency;

        let profit = 0;
        let contractIds: string[] = [];
        let entrySpot: number | undefined;
        let exitSpot: number | undefined;
        let legs: number[] | undefined;

        const effectiveStake = DUAL_TYPES.includes(t) ? Number((stake * 2).toFixed(2)) : stake;
        const activeId = crypto.randomUUID();
        const emitActiveContract = (cids: string[], entry?: number, current?: number) => {
          this.setActiveTrade({
            id: activeId,
            isVirtual: false,
            market: s.market,
            marketLabel: MARKET_LABELS[s.market] || s.market,
            contractType: t,
            label,
            contractIds: cids,
            stake: effectiveStake,
            currency,
            ticks: tk,
            entrySpot: entry,
            currentSpot: current,
            timestamp: nowIso(),
          });
        };

        const handlePurchased = (cids: string[]) => {
          this.session = {
            ...this.session,
            contractStage: this.stopRequested ? 'IS_STOPPING' : 'CONTRACT_OPEN',
          };
          this.emit('session', this.session);
          emitActiveContract(cids);
        };

        const handleEntrySpot = (entry: number, current?: number) => {
          if (this.activeTrade && this.activeTrade.id === activeId) {
            this.setActiveTrade({
              ...this.activeTrade,
              entrySpot: entry,
              currentSpot: current,
            });
          }
        };

        if (DUAL_TYPES.includes(t)) {
          const res = await this.executeDualContract(
            conn,
            s,
            t,
            stake,
            currency,
            tk,
            authMode,
            ensureAccountConn,
            handlePurchased,
            handleEntrySpot
          );
          profit = res.profit;
          legs = res.legs;
          contractIds = res.contractIds;
          entrySpot = res.entrySpot;
          exitSpot = res.exitSpot;
        } else {
          const res = await this.executeSingleContract(
            conn,
            s,
            t,
            param,
            stake,
            currency,
            tk,
            authMode,
            ensureAccountConn,
            handlePurchased,
            handleEntrySpot
          );
          profit = res.profit;
          contractIds = res.contractIds;
          entrySpot = res.entrySpot;
          exitSpot = res.exitSpot;
        }

        this.setActiveTrade(null);
        total = Number((total + profit).toFixed(2));
        const won = profit > 0;
        seq += 1;
        const payout = profit > 0 ? Number((effectiveStake + profit).toFixed(2)) : 0;

        let balanceAfter = this.account?.balance;
        if (!fast) {
          try {
            const refreshed = await this.refreshBalance();
            balanceAfter = refreshed.balance;
          } catch {
            // rely on subscribed balance
          }
        }

        const record: TradeRecord = {
          id: crypto.randomUUID(),
          seq,
          timestamp: nowIso(),
          isVirtual: false,
          market: s.market,
          marketLabel: MARKET_LABELS[s.market] || s.market,
          contractType: t,
          label,
          contractIds,
          stake: effectiveStake,
          payout,
          currency,
          ticks: tk,
          entrySpot,
          exitSpot,
          profit,
          won,
          legs,
          martingaleStep: step,
          sessionTotalAfter: total,
          balanceAfter,
        };

        this.trades = [record, ...this.trades].slice(0, 500);
        this.session = {
          ...this.session,
          contractStage: this.stopRequested ? 'IS_STOPPING' : 'CONTRACT_CLOSED',
          realTrades: this.session.realTrades + 1,
          realWins: this.session.realWins + (won ? 1 : 0),
          realLosses: this.session.realLosses + (won ? 0 : 1),
          totalStake: Number((this.session.totalStake + effectiveStake).toFixed(2)),
          totalPayout: Number((this.session.totalPayout + payout).toFixed(2)),
          totalProfit: total,
        };

        this.emit('trade', record);
        this.emit('session', this.session);
        this.addLog(
          won ? 'win' : 'loss',
          `#${this.session.realTrades} REAL ${label} (stake ${stake}) · ${won ? 'WIN' : 'LOSS'} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ${currency} · Session P/L ${total >= 0 ? '+' : ''}${total.toFixed(2)} ${currency}`
        );

        // Check TP / SL
        if (total >= s.tp) {
          stoppedReason = `Take profit reached (${total >= 0 ? '+' : ''}${total.toFixed(2)} ${currency})`;
          this.addLog('win', stoppedReason);
          break;
        }
        if (total <= -s.sl) {
          stoppedReason = `Stop loss reached (${total.toFixed(2)} ${currency})`;
          this.addLog('error', stoppedReason);
          break;
        }

        // Hybrid type rotation only on REAL loss
        if (!won && s.types.length > 1) {
          idx = (idx + 1) % s.types.length;
          this.addLog('info', `Real loss — switching hybrid type to ${s.types[idx]}.`);
        }

        // Martingale calculation
        if (s.mart) {
          if (won) {
            step = 0;
            stake = base;
          } else {
            step += 1;
            const nextStake = Number((base * Math.pow(s.mult, step)).toFixed(2));
            if (nextStake > MAX_MART_STAKE) {
              step = 0;
              stake = base;
              this.addLog('warn', 'Martingale safety cap reached; stake reset to base.');
            } else {
              stake = nextStake;
            }
          }
          const nextTk = effectiveTicks();
          if (nextTk !== curTicks && s.ticks > 0) {
            curTicks = nextTk;
            this.addLog(
              'info',
              nextTk === s.ticks
                ? `Martingale step ${step}: duration restored to ${nextTk} ticks.`
                : `Martingale step ${step}: duration switched to ${nextTk} ticks.`
            );
          }
        }

        // Virtual mode return logic
        if (s.virtual) {
          if (won) {
            vloss = 0;
            inRealPhase = false;
            this.addLog('info', 'Real win — returning to virtual mode.');
          } else if (s.cont) {
            inRealPhase = true;
            this.addLog('info', 'Real loss — continuing real trades until a win.');
          } else {
            vloss = 0;
            inRealPhase = false;
            this.addLog('info', 'Returning to virtual mode.');
          }
        }

        if (!fast && !this.stopRequested) {
          await sleep(1000);
        }
      }

      if (fast) {
        await this.refreshBalance().catch(() => {});
      }

      this.session = {
        ...this.session,
        status: 'idle',
        contractStage: 'NOT_RUNNING',
        stoppedReason,
        currentStake: stake,
        martingaleStep: step,
        virtualLossesStreak: vloss,
        inRealPhase: !s.virtual || inRealPhase,
      };
      this.emit('session', this.session);
      this.addLog(
        'info',
        `Session finished (${stoppedReason}). Real trades: ${this.session.realTrades}, Wins: ${this.session.realWins}, Total P/L: ${total >= 0 ? '+' : ''}${total.toFixed(2)} ${this.account?.currency ?? ''}`
      );
    } catch (err: any) {
      const msg = err?.message || 'Unexpected trading session error';
      this.session = {
        ...this.session,
        status: 'error',
        contractStage: 'NOT_RUNNING',
        errorMessage: msg,
        stoppedReason: msg,
      };
      this.emit('session', this.session);
      this.addLog('error', `Session halted: ${msg}`);
    } finally {
      this.setActiveTrade(null);
      if (virtualConn) {
        await virtualConn.close().catch(() => {});
      }
      this.stopRequested = false;
      this.activeLoopPromise = null;
    }
  }
}
