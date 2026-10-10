import express from 'express';
import dotenv from 'dotenv';
import { agentRouter } from '../server/routes/agent';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount agent router under /api/agent
app.use('/api/agent', agentRouter);

// Health check endpoint for Vercel serverless verification
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    environment: 'vercel-serverless',
    timestamp: Date.now(),
  });
});

export default app;
