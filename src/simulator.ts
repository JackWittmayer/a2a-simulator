import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { SimulationConfig, Turn, RunResult, Variation, Outcome } from './types.js';
import { createAgent, sendMessage } from './agents.js';
import { initRunDir, writeMetadata, appendTurn, writeSummary } from './logger.js';
import { classifyOutcome } from './analyzer.js';
import { formatTimestamp } from './utils.js';

const PROMPTS_DIR = join(import.meta.dirname, 'prompts');

function loadPrompt(filename: string): string {
  return readFileSync(join(PROMPTS_DIR, filename), 'utf-8').trim();
}

function loadVariations(): Variation[] {
  return JSON.parse(readFileSync(join(PROMPTS_DIR, 'variations.json'), 'utf-8'));
}

function containsStop(text: string): boolean {
  return text.includes('[STOP]');
}

export async function runSimulation(config: SimulationConfig): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const variations = loadVariations();
  const variation = variations.find(v => v.id === config.variationId);
  if (!variation) {
    throw new Error(`Unknown variation: ${config.variationId}`);
  }

  const customerSystemPrompt = loadPrompt('customer-system.txt') + variation.customerModifier;
  const merchantSystemPrompt = loadPrompt('merchant-system.txt') + variation.merchantModifier;
  const scenario = loadPrompt('shoe-scenario.txt') +
    (variation.scenarioModifier ? `\n\n${variation.scenarioModifier}` : '');

  initRunDir(config.batchId, config.runId);
  writeMetadata(config.batchId, config.runId, {
    runId: config.runId,
    batchId: config.batchId,
    variationId: config.variationId,
    model: config.model,
    maxTurns: config.maxTurns,
    startedAt,
    customerSystemPrompt,
    merchantSystemPrompt,
  });

  const customer = createAgent({
    systemPrompt: customerSystemPrompt,
    model: config.model,
    runId: config.runId,
    role: 'customer',
  });
  const merchant = createAgent({
    systemPrompt: merchantSystemPrompt,
    model: config.model,
    runId: config.runId,
    role: 'merchant',
  });

  const turns: Turn[] = [];
  let stoppedBy: 'customer' | 'merchant' | 'max_turns' = 'max_turns';
  let turnNumber = 0;

  // Turn 1: Customer receives scenario from Alex, produces opening message
  turnNumber++;
  console.log(`  Turn ${turnNumber}: customer (receiving scenario)...`);
  const customerOpening = await sendMessage(customer, scenario);
  const turn1: Turn = {
    turnNumber,
    role: 'customer',
    message: customerOpening.response,
    reasoning: customerOpening.reasoning || undefined,
    timestamp: new Date().toISOString(),
    durationMs: customerOpening.durationMs,
  };
  turns.push(turn1);
  appendTurn(config.batchId, config.runId, turn1);

  if (containsStop(customerOpening.response)) {
    stoppedBy = 'customer';
  } else {
    let lastCustomerMessage = customerOpening.response;

    while (turnNumber < config.maxTurns) {
      // Merchant turn
      turnNumber++;
      console.log(`  Turn ${turnNumber}: merchant...`);
      const merchantReply = await sendMessage(
        merchant,
        `Message from customer's agent:\n\n${lastCustomerMessage}`,
      );
      const merchantTurn: Turn = {
        turnNumber,
        role: 'merchant',
        message: merchantReply.response,
        reasoning: merchantReply.reasoning || undefined,
        timestamp: new Date().toISOString(),
        durationMs: merchantReply.durationMs,
      };
      turns.push(merchantTurn);
      appendTurn(config.batchId, config.runId, merchantTurn);

      if (containsStop(merchantReply.response)) {
        stoppedBy = 'merchant';
        break;
      }

      if (turnNumber >= config.maxTurns) break;

      // Customer turn
      turnNumber++;
      console.log(`  Turn ${turnNumber}: customer...`);
      const customerReply = await sendMessage(
        customer,
        `Message from merchant's service agent:\n\n${merchantReply.response}`,
      );
      const customerTurn: Turn = {
        turnNumber,
        role: 'customer',
        message: customerReply.response,
        reasoning: customerReply.reasoning || undefined,
        timestamp: new Date().toISOString(),
        durationMs: customerReply.durationMs,
      };
      turns.push(customerTurn);
      appendTurn(config.batchId, config.runId, customerTurn);

      if (containsStop(customerReply.response)) {
        stoppedBy = 'customer';
        break;
      }

      lastCustomerMessage = customerReply.response;
    }
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startMs;

  let outcome: Outcome = 'deadlock';
  let echoingScore = 0;
  let resolutionSummary = 'Max turns reached without resolution';
  try {
    const analysis = await classifyOutcome(turns);
    outcome = analysis.outcome;
    echoingScore = analysis.echoingScore;
    resolutionSummary = analysis.resolutionSummary;
  } catch (err) {
    console.error('  Analysis failed:', err);
    outcome = 'error';
    resolutionSummary = `Analysis error: ${err}`;
  }

  if (stoppedBy === 'max_turns' && outcome !== 'error') {
    outcome = 'deadlock';
  }

  writeSummary(config.batchId, config.runId, {
    runId: config.runId,
    batchId: config.batchId,
    variationId: config.variationId,
    totalTurns: turns.length,
    outcome,
    stoppedBy,
    completedAt,
    totalDurationMs,
    echoingScore,
    resolutionSummary,
  });

  return {
    runId: config.runId,
    batchId: config.batchId,
    variationId: config.variationId,
    turns,
    outcome,
    startedAt,
    completedAt,
    totalDurationMs,
    stoppedBy,
  };
}

export async function runBatch(opts: {
  count: number;
  variationIds: string[];
  maxTurns: number;
  model: 'sonnet' | 'opus' | 'haiku';
  parallel: number;
}): Promise<RunResult[]> {
  const now = new Date();
  const batchId = `batch-${formatTimestamp(now)}`;
  const results: RunResult[] = [];

  const jobs: SimulationConfig[] = [];
  for (const variationId of opts.variationIds) {
    for (let i = 0; i < opts.count; i++) {
      jobs.push({
        maxTurns: opts.maxTurns,
        model: opts.model,
        variationId,
        batchId,
        runId: `run-${randomUUID().slice(0, 8)}`,
      });
    }
  }

  console.log(`Batch ${batchId}: ${jobs.length} runs across ${opts.variationIds.length} variations`);

  // Run jobs with concurrency limit
  const running: Promise<void>[] = [];
  let jobIndex = 0;

  async function runNext(): Promise<void> {
    while (jobIndex < jobs.length) {
      const job = jobs[jobIndex++]!;
      console.log(`\nStarting ${job.runId} (${job.variationId})...`);
      try {
        const result = await runSimulation(job);
        results.push(result);
        console.log(`  Completed: ${result.outcome} (${result.turns.length} turns, ${Math.round(result.totalDurationMs / 1000)}s)`);
      } catch (err) {
        console.error(`  Failed ${job.runId}:`, err);
      }
    }
  }

  for (let i = 0; i < opts.parallel; i++) {
    running.push(runNext());
  }
  await Promise.all(running);

  return results;
}
