import { spawn, ChildProcess, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { createServer } from "./server/server";
import { launchAgent } from "./launch/launch";
import { processStreamLine } from "./logging";
import { Agent } from "./agent/types/agent";
import { ApiEndpoint } from "./agent/types/api-endpoint";

export interface RunOptions {
  port: number;
  host: string;
  runIndex: number;
  logsDir: string;
  apis?: ApiEndpoint[];
  simName: string;
  multiRun: boolean;
}

export async function runSimulation(
  agents: Agent[],
  options: RunOptions,
): Promise<() => void> {
  const { port, host, runIndex, logsDir, apis, simName, multiRun } = options;
  const runLabel = multiRun ? `run-${runIndex}` : "";
  const containerSuffix = multiRun ? `-run-${runIndex}` : "";
  const serverUrl = `http://host.docker.internal:${port}`;

  const runLogsDir = multiRun ? path.join(logsDir, `run-${runIndex}`) : logsDir;
  fs.mkdirSync(runLogsDir, { recursive: true });

  const app = createServer(apis);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(port, host, () => {
      const label = runLabel ? ` (${runLabel})` : "";
      console.log(`Server listening on http://${host}:${port}${label}`);
      resolve(s);
    });
  });

  const combinedDebugStream = fs.createWriteStream(
    path.join(runLogsDir, "combined.debug.log"),
  );
  combinedDebugStream.write(
    `--- Session started at ${new Date().toISOString()} ---\n`,
  );

  const combinedReadableStream = fs.createWriteStream(
    path.join(runLogsDir, "combined.log"),
  );
  combinedReadableStream.write(
    `=== ${simName} — ${new Date().toISOString()} ===\n\n`,
  );

  const logProcesses: ChildProcess[] = [];
  const logStreams: fs.WriteStream[] = [
    combinedDebugStream,
    combinedReadableStream,
  ];
  const containerNames: string[] = [];

  for (const agent of agents) {
    const containerName = `${agent.name}${containerSuffix}`;
    containerNames.push(containerName);

    console.log(`Launching ${containerName}...`);
    const containerId = launchAgent(agent, { containerName, serverUrl });
    console.log(`  ${containerName} running (${containerId.slice(0, 12)})`);

    const debugStream = fs.createWriteStream(
      path.join(runLogsDir, `${agent.name}.debug.log`),
    );
    debugStream.write(
      `--- Session started at ${new Date().toISOString()} ---\n`,
    );

    const readableStream = fs.createWriteStream(
      path.join(runLogsDir, `${agent.name}.log`),
    );
    readableStream.write(
      `=== ${agent.name} — ${new Date().toISOString()} ===\n\n`,
    );

    logStreams.push(debugStream, readableStream);

    const logProc = spawn("docker", ["logs", "-f", containerName], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const prefix = runLabel
      ? `[${runLabel}] [${agent.name}]`
      : `[${agent.name}]`;

    logProc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        if (!line) continue;

        const ts = new Date().toISOString();
        debugStream.write(ts + "\t" + line + "\n");
        combinedDebugStream.write(
          ts + "\t" + agent.name + "\t" + line + "\n",
        );

        const display = processStreamLine(agent.name, line);
        if (display) {
          for (const displayLine of display.split("\n")) {
            if (displayLine) {
              readableStream.write(displayLine + "\n");
              combinedReadableStream.write(`[${agent.name}] ${displayLine}\n`);
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
        combinedDebugStream.write(`[stderr] [${agent.name}] ${line}\n`);
        combinedReadableStream.write(`[${agent.name}] [stderr] ${line}\n`);
        console.log(`${prefix} ${line}`);
      }
    });

    logProcesses.push(logProc);
  }

  return function shutdown() {
    for (const proc of logProcesses) {
      proc.kill();
    }
    for (const stream of logStreams) {
      stream.end();
    }
    for (const name of containerNames) {
      try {
        execSync(`docker kill ${name}`, { stdio: "ignore" });
      } catch {
        // container may already be stopped
      }
    }
    server.close();
  };
}
