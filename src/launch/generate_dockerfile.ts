import { Agent } from "../types/agent";

export function generateDockerfile(agent: Agent): string {
  const lines: string[] = [
    `FROM ${agent.container.baseImage}`,
    "",
    "RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*",
    "RUN npm install -g @anthropic-ai/claude-code",
    "",
    "ENV HOME=/workspace",
    "WORKDIR /workspace",
  ];

  if (agent.container.installCommands?.length) {
    lines.push("");
    for (const cmd of agent.container.installCommands) {
      lines.push(`RUN ${cmd}`);
    }
  }

  lines.push("", "COPY workspace/ /workspace/");

  if (agent.container.ports?.length) {
    lines.push("");
    for (const port of agent.container.ports) {
      lines.push(`EXPOSE ${port}`);
    }
  }

  if (agent.container.env) {
    lines.push("");
    for (const [key, value] of Object.entries(agent.container.env)) {
      lines.push(`ENV ${key}=${value}`);
    }
  }

  lines.push("", `ENTRYPOINT ${JSON.stringify(agent.container.entrypoint)}`, "");

  return lines.join("\n");
}
