import * as fs from "node:fs";
import * as path from "node:path";
import { parseSimulationConfig } from "./launch/parse_simulation";
import { buildAgentImage } from "./launch/build";
import { resolveCredentials } from "./launch/credentials";
import { runSimulation } from "./run";

const DASHBOARD_PORT = 3001;

function parseArgs(argv: string[]): { configPath: string; runs: number } {
  let configPath = "";
  let runs = 1;

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--runs" && argv[i + 1]) {
      runs = parseInt(argv[i + 1], 10);
      if (isNaN(runs) || runs < 1) {
        console.error("Error: --runs must be a positive integer");
        process.exit(1);
      }
      i++;
    } else if (!configPath) {
      configPath = argv[i];
    }
  }

  if (!configPath) {
    console.error("Usage: a2a-simulator <simulation.yaml> [--runs <N>]");
    process.exit(1);
  }

  return { configPath, runs };
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

const { configPath, runs } = parseArgs(process.argv);

resolveCredentials();

console.log(`Parsing simulation config: ${configPath}...`);
const { config, agents } = parseSimulationConfig(configPath);

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
console.log(`  Agents: ${agents.map((a) => a.name).join(", ")}`);
if (config.apis?.length) {
  console.log(
    `  APIs: ${config.apis.map((a) => `${a.method} ${a.path}`).join(", ")}`,
  );
}
console.log(`  Debug logs: ${logsDir}/`);

// Build images once — reused across all runs
for (const agent of agents) {
  console.log(`\nBuilding image for ${agent.name}...`);
  buildAgentImage(agent);
}

const ports = allocatePorts(basePort, runs);
const multiRun = runs > 1;

if (multiRun) {
  console.log(
    `\nStarting ${runs} parallel runs on ports ${ports.join(", ")}`,
  );
}

(async () => {
  const cleanups: (() => void)[] = [];

  const runPromises = ports.map((port, i) =>
    runSimulation(agents, {
      port,
      host,
      runIndex: i + 1,
      logsDir,
      apis: config.apis,
      simName: config.name,
      multiRun,
    }).then((cleanup) => {
      cleanups.push(cleanup);
    }),
  );

  await Promise.all(runPromises);

  const totalAgents = agents.length * runs;
  console.log(
    `\n${totalAgents} agent(s) running across ${runs} run(s). Ctrl+C to stop.\n`,
  );

  function shutdown() {
    console.log("\nShutting down...");
    for (const cleanup of cleanups) {
      cleanup();
    }
    process.exit(0);
  }

  let shuttingDown = false;
  function handleSignal() {
    if (shuttingDown) {
      console.log("\nForce exiting...");
      process.exit(1);
    }
    shuttingDown = true;
    shutdown();
  }

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);
})();
