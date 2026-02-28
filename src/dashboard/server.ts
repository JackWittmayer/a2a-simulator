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

function computeLiveBatchSummary(logsDir: string, batchId: string) {
  const batchPath = join(logsDir, batchId);
  const runDirs = readdirSync(batchPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('run-'));

  const outcomes: Record<string, number> = {};
  let completedRuns = 0;
  let totalTurns = 0;
  let totalDuration = 0;
  let echoingCount = 0;
  const variations: Record<string, { count: number; outcomes: Record<string, number> }> = {};

  for (const d of runDirs) {
    const summaryPath = join(batchPath, d.name, 'summary.json');
    if (!existsSync(summaryPath)) continue;
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8')) as RunSummary;
    completedRuns++;
    outcomes[summary.outcome] = (outcomes[summary.outcome] || 0) + 1;
    totalTurns += summary.totalTurns;
    totalDuration += summary.totalDurationMs || 0;
    if (summary.outcome === 'echoing') echoingCount++;
    const vid = summary.variationId || 'unknown';
    if (!variations[vid]) variations[vid] = { count: 0, outcomes: {} };
    variations[vid].count++;
    variations[vid].outcomes[summary.outcome] = (variations[vid].outcomes[summary.outcome] || 0) + 1;
  }

  return {
    batchId,
    totalRuns: runDirs.length,
    completedRuns,
    outcomes,
    averageTurns: completedRuns > 0 ? Math.round((totalTurns / completedRuns) * 10) / 10 : 0,
    echoingRate: completedRuns > 0 ? echoingCount / completedRuns : 0,
    averageDurationMs: completedRuns > 0 ? Math.round(totalDuration / completedRuns) : 0,
    variations,
  };
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
        // Compute live stats from individual run summaries
        return computeLiveBatchSummary(logsDir, e.name);
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
        // For in-progress runs, read metadata for variationId and count turns
        const runDir = join(batchDir, e.name);
        const metadataPath = join(runDir, 'metadata.json');
        const conversationPath = join(runDir, 'conversation.jsonl');
        const metadata = existsSync(metadataPath)
          ? JSON.parse(readFileSync(metadataPath, 'utf-8'))
          : null;
        const turnCount = existsSync(conversationPath)
          ? readFileSync(conversationPath, 'utf-8').trim().split('\n').filter(Boolean).length
          : 0;
        return {
          runId: e.name,
          variationId: metadata?.variationId || '',
          outcome: 'pending',
          totalTurns: turnCount > 0 ? turnCount : undefined,
        };
      });

    const summaryPath = join(batchDir, 'batch-summary.json');
    const batchSummary = existsSync(summaryPath)
      ? JSON.parse(readFileSync(summaryPath, 'utf-8'))
      : computeLiveBatchSummary(logsDir, req.params.batchId);

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
