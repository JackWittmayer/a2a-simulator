import { spawn, ChildProcess, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
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

// Set up debug log directory
const logsDir = path.join("logs", config.name);
fs.mkdirSync(logsDir, { recursive: true });

console.log(`\nSimulation: ${config.name}`);
if (config.description) console.log(`  ${config.description}`);
console.log(`  Agents: ${agents.map((a) => a.name).join(", ")}`);
if (config.apis?.length) {
  console.log(`  APIs: ${config.apis.map((a) => `${a.method} ${a.path}`).join(", ")}`);
}
console.log(`  Debug logs: ${logsDir}/`);

// Start server with custom APIs
const app = createServer(config.apis);
const server = app.listen(port, host, () => {
  console.log(`\nServer listening on http://${host}:${port}`);
});

/**
 * Summarize a tool_use block for display.
 */
function formatToolCall(block: any): string {
  const name = block.name;
  const input = block.input ?? {};

  if (name === "Bash") {
    // Extract skill name from command if it's a skill invocation
    const cmd: string = input.command ?? "";
    const skillMatch = cmd.match(/skills\/([^/]+)\//);
    if (skillMatch) {
      return `[${skillMatch[1]}]`;
    }
    // For sleep+skill combos
    const sleepSkillMatch = cmd.match(/sleep\s+\d+\s*&&.*skills\/([^/]+)\//);
    if (sleepSkillMatch) {
      return `[${sleepSkillMatch[1]}] (polling)`;
    }
    return `[bash] ${input.description ?? cmd.slice(0, 80)}`;
  }

  if (name === "Skill") {
    return `[${input.skill ?? "skill"}]${input.args ? " " + input.args.slice(0, 80) : ""}`;
  }

  // Generic fallback
  const summary = JSON.stringify(input);
  return `[${name}] ${summary.length > 100 ? summary.slice(0, 100) + "…" : summary}`;
}

/**
 * Summarize a tool result for display.
 */
function formatToolResult(content: string): string | null {
  try {
    const data = JSON.parse(content);

    // Inbox messages response
    if (data.messages && Array.isArray(data.messages)) {
      const msgs = data.messages;
      if (msgs.length === 0) return "  → inbox: empty";
      const senders = [...new Set(msgs.map((m: any) => m.from))];
      return `  → inbox: ${msgs.length} message(s) from ${senders.join(", ")}`;
    }

    // Agent list response
    if (data.agents && Array.isArray(data.agents)) {
      const names = data.agents.map((a: any) => a.name).join(", ");
      return `  → agents: ${names}`;
    }

    // Sent message confirmation
    if (data.id && data.from && data.to) {
      return `  → sent to ${data.to}`;
    }

    // Ticket responses
    if (data.tickets && Array.isArray(data.tickets)) {
      const count = data.tickets.length;
      return `  → ${count} ticket(s)`;
    }

    // Status check
    if (data.status) {
      return `  → status: ${data.status}`;
    }

    // Empty result
    if (data.result === "" || Object.keys(data).length === 0) return null;

    // Fallback: truncated JSON
    const s = content.length > 120 ? content.slice(0, 120) + "…" : content;
    return `  → ${s}`;
  } catch {
    // Not JSON — show as-is if short, truncate if long
    if (!content.trim()) return null;
    const s = content.length > 120 ? content.slice(0, 120) + "…" : content;
    return `  → ${s}`;
  }
}

/**
 * Process a line of stream-json output from a claude agent.
 * Returns a display string for stdout, or null if only debug.
 */
function processStreamLine(agentName: string, line: string): string | null {
  try {
    const data = JSON.parse(line);
    const type = data.type;

    if (type === "assistant") {
      if (data.message?.content) {
        const parts: string[] = [];
        for (const block of data.message.content) {
          if (block.type === "text" && block.text) {
            parts.push(block.text);
          } else if (block.type === "tool_use") {
            parts.push(formatToolCall(block));
          }
        }
        if (parts.length) return parts.join("\n");
      }
    } else if (type === "user") {
      // Tool results
      if (data.message?.content) {
        const parts: string[] = [];
        for (const block of data.message.content) {
          if (block.type === "tool_result" && block.content) {
            const summary = formatToolResult(block.content);
            if (summary) parts.push(summary);
          }
        }
        if (parts.length) return parts.join("\n");
      }
    } else if (type === "result") {
      if (data.result) return data.result;
    }

    return null;
  } catch {
    // Not JSON — show as-is (e.g. stderr messages)
    return line;
  }
}

// Build and launch agents
const logProcesses: ChildProcess[] = [];
const debugStreams = new Map<string, fs.WriteStream>();

for (const agent of agents) {
  console.log(`\nBuilding image for ${agent.name}...`);
  buildAgentImage(agent);

  console.log(`Launching ${agent.name}...`);
  const containerId = launchAgent(agent);
  console.log(`  ${agent.name} running (${containerId.slice(0, 12)})`);

  // Open debug log file for this agent
  const debugFile = path.join(logsDir, `${agent.name}.debug.log`);
  const debugStream = fs.createWriteStream(debugFile, { flags: "a" });
  debugStreams.set(agent.name, debugStream);
  debugStream.write(`\n--- Session started at ${new Date().toISOString()} ---\n`);

  // Stream container logs
  const logProc = spawn("docker", ["logs", "-f", agent.name], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${agent.name}]`;

  logProc.stdout?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (!line) continue;

      // Always write to debug log
      debugStream.write(line + "\n");

      // Parse stream-json and only show meaningful output
      const display = processStreamLine(agent.name, line);
      if (display) {
        for (const displayLine of display.split("\n")) {
          if (displayLine) console.log(`${prefix} ${displayLine}`);
        }
      }
    }
  });

  logProc.stderr?.on("data", (data: Buffer) => {
    for (const line of data.toString().split("\n")) {
      if (!line) continue;
      debugStream.write(`[stderr] ${line}\n`);
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
  for (const [, stream] of debugStreams) {
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
