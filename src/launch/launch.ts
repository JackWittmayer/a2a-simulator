import { execSync } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";
import { Agent } from "../agent/types/agent";

function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export interface LaunchOptions {
  containerName?: string;
  serverUrl?: string;
}

export function launchAgent(agent: Agent, options: LaunchOptions = {}): string {
  const containerName = options.containerName ?? agent.name;

  try {
    execSync(`docker rm -f ${containerName}`, { stdio: "ignore" });
  } catch {
    // no existing container
  }

  const args: string[] = [
    "docker", "run", "-d",
    "--name", containerName,
    "--add-host=host.docker.internal:host-gateway",
  ];

  // Run as host user so mounted credential files are readable
  // and Claude CLI allows --dangerously-skip-permissions (requires non-root)
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid !== undefined && gid !== undefined) {
    args.push("-u", `${uid}:${gid}`);
  }

  args.push("-e", "HOME=/workspace");

  if (agent.model.credentialsFile) {
    args.push("-v", `${expandHome(agent.model.credentialsFile)}:/workspace/.claude/.credentials.json:ro`);
  } else if (agent.model.apiKey) {
    args.push("-e", `ANTHROPIC_API_KEY=${agent.model.apiKey}`);
  }

  if (agent.container.ports?.length) {
    for (const port of agent.container.ports) {
      args.push("-p", `${port}:${port}`);
    }
  }

  if (agent.container.env) {
    for (const [key, value] of Object.entries(agent.container.env)) {
      args.push("-e", `${key}=${value}`);
    }
  }

  if (options.serverUrl) {
    args.push("-e", `SERVER_URL=${options.serverUrl}`);
  }

  args.push(agent.name);

  const containerId = execSync(args.join(" "), { encoding: "utf-8" }).trim();
  return containerId;
}

export function stopAgent(name: string): void {
  execSync(`docker stop ${name}`, { stdio: "inherit" });
}
