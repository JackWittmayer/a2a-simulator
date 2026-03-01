import * as fs from "node:fs";
import { parse } from "yaml";
import { Agent } from "../agent/types/agent";
import { AgentFilesystem } from "../agent/types/agent-filesystem";
import { Skill } from "../agent/types/skill";
import { defaultSkills } from "../agent/types/default-skills";

export function parseAgentConfig(filePath: string): Agent {
  const raw = fs.readFileSync(filePath, "utf-8");
  const config = parse(raw);

  const filesystem = new AgentFilesystem(
    config.filesystem?.rootDir ?? "/workspace",
    config.filesystem?.tree ?? [],
  );

  const userSkills = (config.skills ?? []).map(
    (s: any) => new Skill(s.name, s.description, s.skillMd, s.files),
  );

  // Merge default skills (send-message, receive-messages) with user-defined skills.
  // User skills with the same name override defaults.
  const userSkillNames = new Set(userSkills.map((s: Skill) => s.name));
  const mergedSkills = [
    ...defaultSkills().filter((s) => !userSkillNames.has(s.name)),
    ...userSkills,
  ];

  return {
    name: config.name,
    skills: mergedSkills,
    filesystem,
    model: config.model,
    systemPrompt: config.systemPrompt ?? "",
    container: config.container,
  };
}
