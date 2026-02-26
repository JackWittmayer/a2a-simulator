import { mkdirSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import type { Turn, RunMetadata, RunSummary } from './types.js';

const LOGS_DIR = join(import.meta.dirname, '..', 'logs');

export function getLogsDir(): string {
  return LOGS_DIR;
}

export function getRunDir(batchId: string, runId: string): string {
  return join(LOGS_DIR, batchId, runId);
}

export function initRunDir(batchId: string, runId: string): string {
  const dir = getRunDir(batchId, runId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeMetadata(batchId: string, runId: string, metadata: RunMetadata): void {
  const dir = getRunDir(batchId, runId);
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));
}

export function appendTurn(batchId: string, runId: string, turn: Turn): void {
  const dir = getRunDir(batchId, runId);
  appendFileSync(join(dir, 'conversation.jsonl'), JSON.stringify(turn) + '\n');
}

export function writeSummary(batchId: string, runId: string, summary: RunSummary): void {
  const dir = getRunDir(batchId, runId);
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));
}

export function writeBatchSummary(batchId: string, data: Record<string, unknown>): void {
  const dir = join(LOGS_DIR, batchId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'batch-summary.json'), JSON.stringify(data, null, 2));
}
