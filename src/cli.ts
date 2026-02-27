import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { Variation } from './types.js';

const program = new Command();

function loadVariationIds(): string[] {
  const variations = JSON.parse(
    readFileSync(join(import.meta.dirname, 'prompts', 'variations.json'), 'utf-8'),
  ) as Variation[];
  return variations.map(v => v.id);
}

program
  .name('a2a-sim')
  .description('A2A interaction chaos tester / simulator')
  .version('0.1.0');

program
  .command('run')
  .description('Run a single simulation')
  .option('--variation <id>', 'Variation ID', 'baseline')
  .option('--turns <n>', 'Max turns per run', '20')
  .option('--model <model>', 'Claude model', 'sonnet')
  .action(async (opts: { variation: string; turns: string; model: string }) => {
    const { runSimulation } = await import('./simulator.js');
    const { formatTimestamp } = await import('./utils.js');
    const batchId = `single-${formatTimestamp(new Date())}`;
    const runId = `run-${randomUUID().slice(0, 8)}`;

    console.log(`Running simulation: ${opts.variation} variation, max ${opts.turns} turns`);
    const result = await runSimulation({
      maxTurns: parseInt(opts.turns),
      model: opts.model as 'sonnet' | 'opus' | 'sonnet',
      variationId: opts.variation,
      batchId,
      runId,
    });

    console.log(`\nResult: ${result.outcome}`);
    console.log(`Turns: ${result.turns.length}`);
    console.log(`Stopped by: ${result.stoppedBy}`);
    console.log(`Duration: ${Math.round(result.totalDurationMs / 1000)}s`);
    console.log(`Logs: logs/${batchId}/${runId}/`);
  });

program
  .command('batch')
  .description('Run a batch of simulations')
  .option('--count <n>', 'Runs per variation', '3')
  .option('--variations <ids>', 'Comma-separated variation IDs (default: all)')
  .option('--parallel <n>', 'Max parallel runs', '1')
  .option('--turns <n>', 'Max turns per run', '20')
  .option('--model <model>', 'Claude model', 'sonnet')
  .action(async (opts: { count: string; variations?: string; parallel: string; turns: string; model: string }) => {
    const { runBatch } = await import('./simulator.js');
    const { analyzeBatch } = await import('./analyzer.js');

    const variationIds = opts.variations
      ? opts.variations.split(',').map(s => s.trim())
      : loadVariationIds();

    const results = await runBatch({
      count: parseInt(opts.count),
      variationIds,
      maxTurns: parseInt(opts.turns),
      model: opts.model as 'sonnet' | 'opus' | 'sonnet',
      parallel: parseInt(opts.parallel),
    });

    if (results.length > 0) {
      const batchId = results[0].batchId;
      console.log(`\nAnalyzing batch ${batchId}...`);
      const summary = await analyzeBatch(batchId);

      console.log(`\n=== Batch Summary ===`);
      console.log(`Total runs: ${summary.completedRuns}/${summary.totalRuns}`);
      console.log(`Average turns: ${summary.averageTurns}`);
      console.log(`Echoing rate: ${Math.round(summary.echoingRate * 100)}%`);
      console.log(`\nOutcomes:`);
      for (const [outcome, count] of Object.entries(summary.outcomes)) {
        if (count > 0) console.log(`  ${outcome}: ${count}`);
      }
      console.log(`\nLogs: logs/${batchId}/`);
    }
  });

program
  .command('analyze')
  .description('Analyze a completed batch')
  .argument('<batch-id>', 'Batch ID to analyze')
  .action(async (batchId: string) => {
    const { analyzeBatch } = await import('./analyzer.js');
    console.log(`Analyzing batch ${batchId}...`);
    const summary = await analyzeBatch(batchId);

    console.log(`\n=== Batch Summary ===`);
    console.log(`Total runs: ${summary.completedRuns}/${summary.totalRuns}`);
    console.log(`Average turns: ${summary.averageTurns}`);
    console.log(`Echoing rate: ${Math.round(summary.echoingRate * 100)}%`);
    console.log(`Average duration: ${Math.round(summary.averageDurationMs / 1000)}s`);
    console.log(`\nOutcomes:`);
    for (const [outcome, count] of Object.entries(summary.outcomes)) {
      if (count > 0) console.log(`  ${outcome}: ${count}`);
    }
    console.log(`\nBy variation:`);
    for (const [varId, data] of Object.entries(summary.variations)) {
      const topOutcome = Object.entries(data.outcomes)
        .sort(([, a], [, b]) => b - a)
        .find(([, c]) => c > 0);
      console.log(`  ${varId}: ${data.count} runs, most common: ${topOutcome?.[0] ?? 'none'}`);
    }
  });

program
  .command('dashboard')
  .description('Open the results dashboard')
  .option('--port <n>', 'Dashboard port', '3460')
  .action(async (opts: { port: string }) => {
    const { startDashboard } = await import('./dashboard/server.js');
    startDashboard(parseInt(opts.port));
  });

program.parse();
