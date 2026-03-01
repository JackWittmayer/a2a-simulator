import { spawn, ChildProcess, execSync } from "node:child_process";
import { createServer } from "./server/server";
import { parseAgentConfig } from "./launch/parse_config";
import { buildAgentImage } from "./launch/build";
import { launchAgent } from "./launch/launch";
import { Agent } from "./agent/types/agent";

const configPaths = process.argv.slice(2);

if (configPaths.length === 0) {
  console.error("Usage: a2a-simulator <agent1.yaml> <agent2.yaml> ...");
  process.exit(1);
}

const port = parseInt(process.env.PORT || "3000");
const host = process.env.HOST || "0.0.0.0";

// Start server
const app = createServer();
const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

// Build and launch agents
const agents: Agent[] = [];
const logProcesses: ChildProcess[] = [];

for (const configPath of configPaths) {
  console.log(`\nParsing ${configPath}...`);
  const agent = parseAgentConfig(configPath);
  agents.push(agent);

  console.log(`Building image for ${agent.name}...`);
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
      // Use docker kill for immediate stop instead of graceful shutdown
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
