import express from 'express';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getLogsDir } from '../logger.js';
import type { RunSummary, BatchSummary } from '../types.js';
import type { Variation } from '../types.js';

function loadVariations(): Variation[] {
  const variationsPath = join(import.meta.dirname, '..', 'prompts', 'variations.json');
  return JSON.parse(readFileSync(variationsPath, 'utf-8'));
}

export function startDashboard(port: number): void {
  const app = express();
  const logsDir = getLogsDir();

  app.get('/', (_req, res) => {
    const htmlPath = join(import.meta.dirname, 'index.html');
    res.sendFile(htmlPath);
  });

  app.get('/api/batches', (_req, res) => {
    if (!existsSync(logsDir)) {
      res.json([]);
      return;
    }
    const entries = readdirSync(logsDir, { withFileTypes: true });
    const batches = entries
      .filter(e => e.isDirectory())
      .map(e => {
        const summaryPath = join(logsDir, e.name, 'batch-summary.json');
        if (existsSync(summaryPath)) {
          return JSON.parse(readFileSync(summaryPath, 'utf-8')) as BatchSummary;
        }
        const batchPath = join(logsDir, e.name);
        const runDirs = readdirSync(batchPath, { withFileTypes: true })
          .filter(d => d.isDirectory() && d.name.startsWith('run-'));
        const completedRuns = runDirs.filter(d =>
          existsSync(join(batchPath, d.name, 'summary.json'))
        ).length;
        return { batchId: e.name, totalRuns: runDirs.length, completedRuns };
      })
      .sort((a, b) => b.batchId.localeCompare(a.batchId));
    res.json(batches);
  });

  app.get('/api/batches/:batchId', (req, res) => {
    const batchDir = join(logsDir, req.params.batchId);
    if (!existsSync(batchDir)) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const entries = readdirSync(batchDir, { withFileTypes: true });
    const runs = entries
      .filter(e => e.isDirectory() && e.name.startsWith('run-'))
      .map(e => {
        const summaryPath = join(batchDir, e.name, 'summary.json');
        if (existsSync(summaryPath)) {
          return JSON.parse(readFileSync(summaryPath, 'utf-8')) as RunSummary;
        }
        return { runId: e.name, outcome: 'pending' };
      });

    const summaryPath = join(batchDir, 'batch-summary.json');
    const batchSummary = existsSync(summaryPath)
      ? JSON.parse(readFileSync(summaryPath, 'utf-8'))
      : null;

    res.json({ batchSummary, runs });
  });

  app.get('/api/runs/:batchId/:runId', (req, res) => {
    const runDir = join(logsDir, req.params.batchId, req.params.runId);
    if (!existsSync(runDir)) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const metadataPath = join(runDir, 'metadata.json');
    const summaryPath = join(runDir, 'summary.json');
    const conversationPath = join(runDir, 'conversation.jsonl');

    const metadata = existsSync(metadataPath)
      ? JSON.parse(readFileSync(metadataPath, 'utf-8'))
      : null;
    const summary = existsSync(summaryPath)
      ? JSON.parse(readFileSync(summaryPath, 'utf-8'))
      : null;
    const conversation = existsSync(conversationPath)
      ? readFileSync(conversationPath, 'utf-8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line))
      : [];

    const variations = loadVariations();
    const variation = metadata?.variationId
      ? variations.find((v: Variation) => v.id === metadata.variationId) || null
      : null;

    res.json({ metadata, summary, conversation, variation });
  });

  app.listen(port, () => {
    console.log(`Dashboard running at http://localhost:${port}`);
  });
}
