import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { Agent } from "../agent/types/agent";
import { AgentFilesystem } from "../agent/types/agent-filesystem";
import { generateDockerfile } from "./generate_dockerfile";

export function buildAgentImage(agent: Agent): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `a2a-${agent.name}-`));

  try {
    const workspaceDir = path.join(tmpDir, "workspace");
    const fs_ = new AgentFilesystem(workspaceDir, agent.filesystem.tree);
    fs_.generate();

    for (const skill of agent.skills) {
      skill.generate(workspaceDir);
    }

    const dockerfile = generateDockerfile(agent);
    fs.writeFileSync(path.join(tmpDir, "Dockerfile"), dockerfile);

    execSync(`docker build -t ${agent.name} .`, {
      cwd: tmpDir,
      stdio: "inherit",
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
