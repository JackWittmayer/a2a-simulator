import * as fs from "node:fs";
import * as path from "node:path";
import { parseSimulationConfig } from "./launch/parse_simulation";
import { buildAgentImage } from "./launch/build";
import { runSimulation, SimulationHandle } from "./run";

const DASHBOARD_PORT = 3001;

function parseArgs(argv: string[]): { configPath: string; runs: number; repeat: number } {
  let configPath = "";
  let runs = 1;
  let repeat = 1;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--runs" && argv[i + 1]) {
      runs = parseInt(argv[i + 1], 10);
      if (isNaN(runs) || runs < 1) {
        console.error("Error: --runs must be a positive integer");
        process.exit(1);
      }
      i++;
    } else if (argv[i] === "--repeat" && argv[i + 1]) {
      repeat = parseInt(argv[i + 1], 10);
      if (isNaN(repeat) || repeat < 1) {
        console.error("Error: --repeat must be a positive integer");
        process.exit(1);
      }
      i++;
    } else if (!configPath) {
      configPath = argv[i];
    }
  }

  if (!configPath) {
    console.error("Usage: a2a-simulator <simulation.yaml> [--runs <N>] [--repeat <N>]");
    process.exit(1);
  }

  return { configPath, runs, repeat };
}

function allocatePorts(basePort: number, count: number): number[] {
  const ports: number[] = [];
  let port = basePort;
  while (ports.length < count) {
    if (port !== DASHBOARD_PORT) {
      ports.push(port);
    }
    port++;
  }
  return ports;
}

const { configPath, runs, repeat } = parseArgs(process.argv);

console.log(`Parsing simulation config: ${configPath}...`);
const simulations = parseSimulationConfig(configPath);
const hasVariations = simulations.length > 1;
const config = simulations[0].config;

const basePort = config.server?.port ?? parseInt(process.env.PORT || "3000");
const host = config.server?.host ?? process.env.HOST ?? "0.0.0.0";

const pad = (n: number) => String(n).padStart(2, "0");
function toPST(date: Date) {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
  );
}
const pst = toPST(new Date());
const timestamp = `${pst.getFullYear()}-${pad(pst.getMonth() + 1)}-${pad(pst.getDate())}_${pad(pst.getHours())}h${pad(pst.getMinutes())}m${pad(pst.getSeconds())}s`;
const logsDir = path.join("logs", config.name, timestamp);
fs.mkdirSync(logsDir, { recursive: true });

console.log(`\nSimulation: ${config.name}`);
if (config.description) console.log(`  ${config.description}`);
console.log(`  Agents: ${simulations[0].agents.map((a) => a.name).join(", ")}`);
if (config.apis?.length) {
  console.log(
    `  APIs: ${config.apis.map((a) => `${a.method} ${a.path}`).join(", ")}`,
  );
}
if (hasVariations) {
  console.log(`  Variations: ${simulations.length}`);
  for (const sim of simulations) {
    console.log(`    - ${sim.variationName}`);
  }
  if (repeat > 1) {
    console.log(`  Repeat: ${repeat}x each`);
  }
}
console.log(`  Debug logs: ${logsDir}/`);

// Build Docker images — one per agent per variation (prompts are baked in)
if (hasVariations) {
  for (const sim of simulations) {
    const varLabel = sim.variationName!;
    for (const agent of sim.agents) {
      const imageName = `${agent.name}-${varLabel}`;
      console.log(`\nBuilding image for ${agent.name} (${varLabel})...`);
      buildAgentImage({ ...agent, name: imageName });
    }
  }
} else {
  for (const agent of simulations[0].agents) {
    console.log(`\nBuilding image for ${agent.name}...`);
    buildAgentImage(agent);
  }
}

// Expand variations by repeat count
interface ExpandedRun {
  sim: (typeof simulations)[0];
  repeatIndex: number;
  label: string;
}

const expandedRuns: ExpandedRun[] = [];
if (hasVariations) {
  for (const sim of simulations) {
    for (let r = 0; r < repeat; r++) {
      const label = repeat > 1
        ? `${sim.variationName}-${r + 1}`
        : sim.variationName!;
      expandedRuns.push({ sim, repeatIndex: r, label });
    }
  }
} else {
  for (let r = 0; r < runs; r++) {
    expandedRuns.push({ sim: simulations[0], repeatIndex: r, label: `run-${r + 1}` });
  }
}

const concurrency = runs;
const totalRuns = expandedRuns.length;
const ports = allocatePorts(basePort, totalRuns);
const multiRun = totalRuns > 1;

if (hasVariations) {
  console.log(
    `\nRunning ${totalRuns} run(s) (${simulations.length} variation(s) x ${repeat}), ${concurrency} at a time`,
  );
} else if (multiRun) {
  console.log(
    `\nStarting ${runs} parallel runs on ports ${ports.join(", ")}`,
  );
}

function printSummary(logsDir: string, runs: ExpandedRun[]) {
  const outcomes: { label: string; variation: string; outcome: Record<string, any> }[] = [];

  for (const run of runs) {
    const outcomePath = path.join(logsDir, run.label, "outcome.json");
    if (!fs.existsSync(outcomePath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(outcomePath, "utf-8"));
      outcomes.push({ label: run.label, variation: run.sim.variationName ?? "default", outcome: data });
    } catch {}
  }

  if (outcomes.length === 0) {
    console.log("\nNo outcomes to summarize.");
    return;
  }

  // Group by variation
  const groups = new Map<string, Record<string, any>[]>();
  for (const o of outcomes) {
    const list = groups.get(o.variation) ?? [];
    list.push(o.outcome);
    groups.set(o.variation, list);
  }

  console.log("\n=== Summary ===\n");

  // Write summary JSON
  const summaryData: Record<string, any> = {};

  for (const [variation, outcomeList] of groups) {
    console.log(`${variation} (${outcomeList.length} run${outcomeList.length > 1 ? "s" : ""}):`);

    // Extract numeric values from outcomes for aggregation
    const numericFields = new Map<string, number[]>();
    for (const outcome of outcomeList) {
      extractNumbers(outcome, "", numericFields);
    }

    const stats: Record<string, any> = {};
    for (const [field, values] of numericFields) {
      if (values.length === 0) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

      stats[field] = { avg, min, max, median, count: values.length };
      console.log(`  ${field}: avg=${avg.toFixed(2)}, min=${min}, max=${max}, median=${median} (n=${values.length})`);
    }

    summaryData[variation] = { runs: outcomeList.length, stats, outcomes: outcomeList };
  }

  const summaryPath = path.join(logsDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2) + "\n");
  console.log(`\nSummary saved: ${summaryPath}`);
}

function extractNumbers(obj: any, prefix: string, result: Map<string, number[]>) {
  if (obj == null) return;
  if (typeof obj === "number") {
    const list = result.get(prefix) ?? [];
    list.push(obj);
    result.set(prefix, list);
    return;
  }
  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj)) {
      extractNumbers(val, prefix ? `${prefix}.${key}` : key, result);
    }
  }
}

(async () => {
  const handles: SimulationHandle[] = [];

  let shuttingDown = false;
  function handleSignal() {
    if (shuttingDown) {
      console.log("\nForce exiting...");
      process.exit(1);
    }
    shuttingDown = true;
    console.log("\nShutting down...");
    for (const handle of handles) {
      handle.shutdown();
    }
    process.exit(0);
  }
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  // Run all expanded runs with concurrency limit
  let completed = 0;
  let nextIndex = 0;
  const active = new Set<Promise<void>>();

  async function launchRun(index: number) {
    const { sim, label } = expandedRuns[index];
    const port = ports[index];
    const imagePrefix = sim.variationName ?? undefined;

    console.log(`\nStarting: ${label} (port ${port})`);

    const handle = await runSimulation(sim.agents, {
      port,
      host,
      runIndex: index + 1,
      logsDir,
      apis: sim.config.apis,
      simName: config.name,
      multiRun: true,
      runLabel: label,
      imagePrefix,
    });
    handles.push(handle);

    await handle.done;
    completed++;
    console.log(`\n"${label}" complete (${completed}/${totalRuns})`);
  }

  while (nextIndex < totalRuns || active.size > 0) {
    while (active.size < concurrency && nextIndex < totalRuns) {
      const idx = nextIndex++;
      const p = launchRun(idx).then(() => {
        active.delete(p);
      });
      active.add(p);
    }
    if (active.size > 0) {
      await Promise.race(active);
    }
  }

  console.log("\nAll runs complete.");

  // Aggregate outcomes
  printSummary(logsDir, expandedRuns);

  for (const handle of handles) {
    handle.shutdown();
  }
  process.exit(0);
})();
