import * as fs from "node:fs";
import { parse } from "yaml";
import { Agent } from "../types/agent";
import { AgentFilesystem } from "../types/agent-filesystem";
import { Skill } from "../types/skill";

export function parseAgentConfig(filePath: string): Agent {
  const raw = fs.readFileSync(filePath, "utf-8");
  const config = parse(raw);

  const filesystem = new AgentFilesystem(
    config.filesystem?.rootDir ?? "/workspace",
    config.filesystem?.tree ?? [],
  );

  const skills = (config.skills ?? []).map(
    (s: any) => new Skill(s.name, s.description, s.skillMd, s.files),
  );

  return {
    name: config.name,
    skills,
    filesystem,
    model: config.model,
    systemPrompt: config.systemPrompt ?? "",
    container: config.container,
  };
}
