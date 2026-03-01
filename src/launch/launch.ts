import { execSync } from "node:child_process";
import { Agent } from "../types/agent";

export function launchAgent(agent: Agent): string {
  const args: string[] = ["docker", "run", "-d", "--name", agent.name];

  if (agent.model.credentialsFile) {
    args.push("-v", `${agent.model.credentialsFile}:/workspace/.claude/.credentials.json:ro`);
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

  args.push(agent.name);

  const containerId = execSync(args.join(" "), { encoding: "utf-8" }).trim();
  return containerId;
}

export function stopAgent(name: string): void {
  execSync(`docker stop ${name}`, { stdio: "inherit" });
}
