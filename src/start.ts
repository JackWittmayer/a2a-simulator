import { spawn, ChildProcess, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { createServer } from "./server/server";
import { parseSimulationConfig } from "./launch/parse_simulation";
import { buildAgentImage } from "./launch/build";
import { launchAgent } from "./launch/launch";
import { processStreamLine } from "./logging";

const configPath = process.argv[2];

if (!configPath) {
  console.error("Usage: a2a-simulator <simulation.yaml>");
  process.exit(1);
}

console.log(`Parsing simulation config: ${configPath}...`);
const { config, agents } = parseSimulationConfig(configPath);

const port = config.server?.port ?? parseInt(process.env.PORT || "3000");
const host = config.server?.host ?? process.env.HOST ?? "0.0.0.0";

// Set up debug log directory with timestamp
const pad = (n: number) => String(n).padStart(2, "0");
function toPST(date: Date) {
  return new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
}
const pst = toPST(new Date());
const timestamp = `${pst.getFullYear()}-${pad(pst.getMonth() + 1)}-${pad(pst.getDate())}_${pad(pst.getHours())}h${pad(pst.getMinutes())}m${pad(pst.getSeconds())}s`;
const logsDir = path.join("logs", config.name, timestamp);
fs.mkdirSync(logsDir, { recursive: true });

console.log(`\nSimulation: ${config.name}`);
if (config.description) console.log(`  ${config.description}`);
console.log(`  Agents: ${agents.map((a) => a.name).join(", ")}`);
if (config.apis?.length) {
  console.log(`  APIs: ${config.apis.map((a) => `${a.method} ${a.path}`).join(", ")}`);
}
console.log(`  Debug logs: ${logsDir}/`);

// Start server and wait for it to be ready before launching agents
const app = createServer(config.apis);

let server: ReturnType<typeof app.listen>;

(async () => {
server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
  const s = app.listen(port, host, () => {
    console.log(`\nServer listening on http://${host}:${port}`);
    resolve(s);
  });
});

// Combined logs (all agents in one file)
const combinedDebugStream = fs.createWriteStream(
  path.join(logsDir, "combined.debug.log")
);
combinedDebugStream.write(`--- Session started at ${new Date().toISOString()} ---\n`);

const combinedReadableStream = fs.createWriteStream(
  path.join(logsDir, "combined.log")
);
combinedReadableStream.write(`=== ${config.name} — ${new Date().toISOString()} ===\n\n`);

// Build and launch agents
const logProcesses: ChildProcess[] = [];
const logStreams: fs.WriteStream[] = [combinedDebugStream, combinedReadableStream];

for (const agent of agents) {
  console.log(`\nBuilding image for ${agent.name}...`);
  buildAgentImage(agent);

  console.log(`Launching ${agent.name}...`);
  const containerId = launchAgent(agent);
  console.log(`  ${agent.name} running (${containerId.slice(0, 12)})`);

  // Raw JSONL log (everything)
  const debugStream = fs.createWriteStream(
    path.join(logsDir, `${agent.name}.debug.log`)
  );
  debugStream.write(`--- Session started at ${new Date().toISOString()} ---\n`);

  // Human-readable log
  const readableStream = fs.createWriteStream(
    path.join(logsDir, `${agent.name}.log`)
  );
  readableStream.write(`=== ${agent.name} — ${new Date().toISOString()} ===\n\n`);

  logStreams.push(debugStream, readableStream);

  // Stream container logs
  const logProc = spawn("docker", ["logs", "-f", agent.name], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${agent.name}]`;

  logProc.stdout?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (!line) continue;

      const ts = new Date().toISOString();
      debugStream.write(ts + "\t" + line + "\n");
      combinedDebugStream.write(ts + "\t" + agent.name + "\t" + line + "\n");

      const display = processStreamLine(agent.name, line);
      if (display) {
        for (const displayLine of display.split("\n")) {
          if (displayLine) {
            readableStream.write(displayLine + "\n");
            combinedReadableStream.write(`${prefix} ${displayLine}\n`);
            console.log(`${prefix} ${displayLine}`);
          }
        }
      }
    }
  });

  logProc.stderr?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (!line) continue;
      debugStream.write(`[stderr] ${line}\n`);
      readableStream.write(`[stderr] ${line}\n`);
      combinedDebugStream.write(`[stderr] ${prefix} ${line}\n`);
      combinedReadableStream.write(`${prefix} [stderr] ${line}\n`);
      console.log(`${prefix} ${line}`);
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
  for (const stream of logStreams) {
    stream.end();
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
})();
