import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { DerivBotEngine } from './server/derivEngine.ts';
import { BotSettings } from './src/types.ts';

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

app.post('/api/market/subscribe', async (req, res) => {
  try {
    const { market } = req.body ?? {};
    await engine.startTickStream(String(market ?? 'R_100'));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to subscribe to market.' });
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

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DerivBot Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
