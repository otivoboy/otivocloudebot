import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { DerivBotEngine } from './server/derivEngine.ts';
import type { BotSettings } from './src/types.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json());

const engine = new DerivBotEngine();

// SSE stream for real-time account balance, ticks, trades, session, and logs
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('snapshot', engine.getSnapshot());

  const unsubscribe = engine.subscribe((event, payload) => {
    sendEvent(event, payload);
  });

  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 20_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

app.get('/api/snapshot', (_req, res) => {
  res.json(engine.getSnapshot());
});

app.post('/api/journal/log', (req, res) => {
  const { level, message } = req.body ?? {};
  const msg = typeof message === 'string' ? message.trim() : '';
  if (!msg) {
    res.status(400).json({ error: 'Log message is required.' });
    return;
  }
  const allowedLevels = new Set(['info', 'win', 'loss', 'warn', 'error']);
  const safeLevel = allowedLevels.has(String(level))
    ? (String(level) as 'info' | 'win' | 'loss' | 'warn' | 'error')
    : 'info';
  engine.addLog(safeLevel, msg);
  res.json({ ok: true });
});

app.post('/api/account/connect', async (req, res) => {
  try {
    const { token, authMode, accountId, appId, virtualToken } = req.body ?? {};
    const account = await engine.connectAccount({
      token: String(token ?? ''),
      authMode,
      accountId,
      appId,
      virtualToken,
    });
    res.json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to connect Deriv account.' });
  }
});

app.post('/api/account/refresh', async (_req, res) => {
  try {
    const account = await engine.refreshBalance();
    res.json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Could not refresh balance.' });
  }
});

app.post('/api/account/disconnect', async (_req, res) => {
  try {
    await engine.disconnectAccount();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to disconnect account.' });
  }
});

app.post('/api/account/virtual-token', async (req, res) => {
  try {
    const { token, authMode, accountId, appId } = req.body ?? {};
    const virtualAccount = await engine.connectVirtualToken({
      token: String(token ?? ''),
      authMode,
      accountId,
      appId,
    });
    res.json({ virtualAccount, hasVirtualToken: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to connect virtual token.' });
  }
});

app.delete('/api/account/virtual-token', async (_req, res) => {
  try {
    await engine.disconnectVirtualToken();
    res.json({ ok: true, hasVirtualToken: false });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to remove virtual token.' });
  }
});

app.post('/api/autobot/trade', async (req, res) => {
  try {
    const {
      symbol,
      contractType,
      prediction,
      prediction2,
      stake,
      duration,
      growthRate,
      takeProfit,
      isVirtual,
      strategyName,
    } = req.body ?? {};
    const result = await engine.executeAutoBotTrade({
      symbol: String(symbol ?? ''),
      contractType,
      prediction: Number(prediction ?? 0),
      prediction2: prediction2 !== undefined ? Number(prediction2) : undefined,
      stake: Number(stake),
      duration: duration !== undefined ? Number(duration) : undefined,
      growthRate: growthRate !== undefined ? Number(growthRate) : undefined,
      takeProfit: takeProfit !== undefined ? Number(takeProfit) : undefined,
      isVirtual: Boolean(isVirtual),
      strategyName: strategyName ? String(strategyName) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'AutoBot trade failed.' });
  }
});

app.post('/api/market/subscribe', async (req, res) => {
  try {
    const { market } = req.body ?? {};
    await engine.startTickStream(String(market ?? 'R_100'));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to subscribe to market.' });
  }
});

app.post('/api/markets/subscribe', async (req, res) => {
  try {
    const symbols = Array.isArray(req.body?.symbols) ? req.body.symbols.map(String) : [];
    await engine.subscribeMultiMarkets(symbols);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to subscribe to multi markets.' });
  }
});

app.get('/api/settings', (_req, res) => {
  res.json({ settings: engine.getSettings() });
});

app.put('/api/settings', (req, res) => {
  try {
    const next = req.body?.settings as BotSettings;
    if (!next || typeof next !== 'object') {
      res.status(400).json({ error: 'Invalid settings payload.' });
      return;
    }
    const saved = engine.saveSettings(next);
    res.json({ settings: saved });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to save settings.' });
  }
});

app.get('/api/mt/portfolio', async (_req, res) => {
  try {
    const positions = await engine.fetchPortfolio();
    res.json({ positions });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to fetch portfolio.' });
  }
});

app.post('/api/mt/order', async (req, res) => {
  try {
    const { symbol, contractType, stake, multiplier, duration, durationUnit } = req.body ?? {};
    const position = await engine.placeManualOrder({
      symbol: String(symbol ?? ''),
      contractType: String(contractType ?? 'MULTUP'),
      stake: Number(stake),
      multiplier: multiplier !== undefined ? Number(multiplier) : undefined,
      duration: duration !== undefined ? Number(duration) : undefined,
      durationUnit: durationUnit !== undefined ? String(durationUnit) : undefined,
    });
    res.json({ position });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Order failed.' });
  }
});

app.post('/api/mt/close', async (req, res) => {
  try {
    const { contractId } = req.body ?? {};
    await engine.closePosition(String(contractId ?? ''));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to close position.' });
  }
});

app.post('/api/session/start', async (req, res) => {
  try {
    const settings = req.body?.settings as BotSettings;
    await engine.startSession(settings);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to start trading session.' });
  }
});

app.post('/api/session/stop', async (_req, res) => {
  try {
    await engine.stopSession();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to stop trading session.' });
  }
});

app.post('/api/session/reset', (_req, res) => {
  try {
    engine.resetStats();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to reset stats.' });
  }
});

app.get('/api/strategies', (_req, res) => {
  res.json({ strategies: engine.listStrategies() });
});

app.post('/api/strategies', (req, res) => {
  try {
    const { name, settings } = req.body ?? {};
    const strategy = engine.saveStrategy(String(name ?? ''), settings);
    res.json({ strategy });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Could not save strategy.' });
  }
});

app.patch('/api/strategies/:id', (req, res) => {
  try {
    const strategy = engine.updateStrategy(req.params.id, req.body ?? {});
    res.json({ strategy });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Could not update strategy.' });
  }
});

app.delete('/api/strategies/:id', (req, res) => {
  try {
    engine.deleteStrategy(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Could not delete strategy.' });
  }
});

// Cloud Bots Control Endpoints (AutoBot + Analysis Tool Bots running on cloud server)
app.get('/api/cloud-bots/state', (_req, res) => {
  res.json({ cloudBots: engine.cloudBots.getSnapshot() });
});

app.put('/api/cloud-bots/autobot/config', (req, res) => {
  try {
    engine.cloudBots.updateAutoBotConfig(req.body ?? {});
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update AutoBot cloud config.' });
  }
});

app.post('/api/cloud-bots/autobot/start', (req, res) => {
  try {
    engine.cloudBots.startAutoBot(req.body?.config ?? req.body);
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to start cloud AutoBot.' });
  }
});

app.post('/api/cloud-bots/autobot/stop', (_req, res) => {
  try {
    engine.cloudBots.stopAutoBot();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to stop cloud AutoBot.' });
  }
});

app.post('/api/cloud-bots/autobot/reset', (_req, res) => {
  try {
    engine.cloudBots.resetAutoBot();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to reset cloud AutoBot.' });
  }
});

app.post('/api/cloud-bots/grid-master/start', (req, res) => {
  try {
    engine.cloudBots.startGridMaster(req.body ?? {});
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to start Grid Master Bot.' });
  }
});

app.post('/api/cloud-bots/grid-master/stop', (_req, res) => {
  try {
    engine.cloudBots.stopGridMaster();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to stop Grid Master Bot.' });
  }
});

app.post('/api/cloud-bots/frequency/start', (req, res) => {
  try {
    engine.cloudBots.startFrequencyBot(req.body ?? {});
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to start Frequency Bot.' });
  }
});

app.post('/api/cloud-bots/frequency/stop', (_req, res) => {
  try {
    engine.cloudBots.stopFrequencyBot();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to stop Frequency Bot.' });
  }
});

app.post('/api/cloud-bots/ai-scanner/start', (req, res) => {
  try {
    engine.cloudBots.startAiScanner(req.body ?? {});
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to start AI Scanner Bot.' });
  }
});

app.post('/api/cloud-bots/ai-scanner/stop', (_req, res) => {
  try {
    engine.cloudBots.stopAiScanner();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to stop AI Scanner Bot.' });
  }
});

app.post('/api/cloud-bots/ai-scanner/clear-result', (_req, res) => {
  try {
    engine.cloudBots.clearAiScannerTpSl();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to clear AI Scanner result.' });
  }
});

app.post('/api/cloud-bots/ai-hacker/start', (req, res) => {
  try {
    engine.cloudBots.startAiHacker(req.body ?? {});
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to start AI Market Hacker.' });
  }
});

app.post('/api/cloud-bots/ai-hacker/stop', (_req, res) => {
  try {
    engine.cloudBots.stopAiHacker();
    res.json({ cloudBots: engine.cloudBots.getSnapshot() });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to stop AI Market Hacker.' });
  }
});

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProd =
    (process.env.NODE_ENV === 'production' ||
      (process.env.NODE_ENV !== 'development' &&
        process.env.npm_lifecycle_event !== 'dev')) &&
    fs.existsSync(distPath);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OTIVO AI CLOUD server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
