import * as fs from "node:fs";
import { parse } from "yaml";
import { Agent, buildAgent } from "../agent/types/agent";
import { Skill } from "../agent/types/skill";
import { defaultSkills } from "../agent/types/default-skills";
import { SimulationConfig } from "../agent/types/simulation-config";

export function parseSimulationConfig(filePath: string): {
  config: SimulationConfig;
  agents: Agent[];
} {
  const raw = fs.readFileSync(filePath, "utf-8");
  const config = parse(raw);

  // Build the skill registry: default skills and config skills
  const registry = new Map<string, Skill>();

  for (const s of defaultSkills()) {
    registry.set(s.name, s);
  }

  for (const s of config.skills ?? []) {
    registry.set(s.name, new Skill(s.name, s.description, s.skillMd, s.files));
  }

  const agents: Agent[] = config.agents.map(
    (agentConfig: Record<string, any>) => buildAgent(agentConfig, config, registry),
  );

  return { config, agents };
}
