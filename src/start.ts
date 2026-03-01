import { spawn, ChildProcess, execSync } from "node:child_process";
import { createServer } from "./server/server";
import { parseSimulationConfig } from "./launch/parse_simulation";
import { buildAgentImage } from "./launch/build";
import { launchAgent } from "./launch/launch";

const configPath = process.argv[2];

if (!configPath) {
  console.error("Usage: a2a-simulator <simulation.yaml>");
  process.exit(1);
}

console.log(`Parsing simulation config: ${configPath}...`);
const { config, agents } = parseSimulationConfig(configPath);

const port = config.server?.port ?? parseInt(process.env.PORT || "3000");
const host = config.server?.host ?? process.env.HOST ?? "0.0.0.0";

console.log(`\nSimulation: ${config.name}`);
if (config.description) console.log(`  ${config.description}`);
console.log(`  Agents: ${agents.map((a) => a.name).join(", ")}`);
if (config.apis?.length) {
  console.log(`  APIs: ${config.apis.map((a) => `${a.method} ${a.path}`).join(", ")}`);
}

// Start server with custom APIs
const app = createServer(config.apis);
const server = app.listen(port, host, () => {
  console.log(`\nServer listening on http://${host}:${port}`);
});

// Build and launch agents
const logProcesses: ChildProcess[] = [];

for (const agent of agents) {
  console.log(`\nBuilding image for ${agent.name}...`);
  buildAgentImage(agent);

  console.log(`Launching ${agent.name}...`);
  const containerId = launchAgent(agent);
  console.log(`  ${agent.name} running (${containerId.slice(0, 12)})`);

  // Stream container logs with agent name prefix
  const logProc = spawn("docker", ["logs", "-f", agent.name], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${agent.name}]`;
  logProc.stdout?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (line) console.log(`${prefix} ${line}`);
    }
  });
  logProc.stderr?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (line) console.log(`${prefix} ${line}`);
    }
  });
  logProcesses.push(logProc);
}

console.log(`\n${agents.length} agent(s) running. Ctrl+C to stop.\n`);

// Cleanup on exit
function shutdown() {
  console.log("\nShutting down...");
  for (const proc of logProcesses) {
    proc.kill();
  }
  for (const agent of agents) {
    try {
      console.log(`Stopping ${agent.name}...`);
      execSync(`docker kill ${agent.name}`, { stdio: "ignore" });
    } catch {
      // container may already be stopped
    }
  }
  server.close();
  process.exit(0);
}

// Force exit on second Ctrl+C
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
