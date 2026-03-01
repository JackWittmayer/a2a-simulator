import * as fs from "node:fs";
import { parse } from "yaml";
import { Agent } from "../agent/types/agent";
import { AgentFilesystem } from "../agent/types/agent-filesystem";
import { Skill } from "../agent/types/skill";
import { defaultSkills } from "../agent/types/default-skills";
import { apiSkills } from "../agent/types/api-skills";
import { SimulationConfig } from "../agent/types/simulation-config";

export function parseSimulationConfig(filePath: string): {
  config: SimulationConfig;
  agents: Agent[];
} {
  const raw = fs.readFileSync(filePath, "utf-8");
  const config = parse(raw);

  // Build the skill registry: top-level skills + api-derived skills + defaults
  const registry = new Map<string, Skill>();

  for (const s of defaultSkills()) {
    registry.set(s.name, s);
  }

  for (const s of apiSkills(config.apis ?? [])) {
    registry.set(s.name, s);
  }

  for (const s of config.skills ?? []) {
    registry.set(s.name, new Skill(s.name, s.description, s.skillMd, s.files));
  }

  const agents: Agent[] = config.agents.map((rawAgentConfig: Record<string, any>) => {
    const model = rawAgentConfig.model ?? config.model;
    if (!model) {
      throw new Error(
        `Agent "${rawAgentConfig.name}" has no model config and no top-level default`,
      );
    }

    const container = {
      baseImage:
        rawAgentConfig.container?.baseImage ??
        config.container?.baseImage ??
        "node:22-slim",
      env: {
        ...config.container?.env,
        ...rawAgentConfig.container?.env,
      },
      ports: rawAgentConfig.container?.ports ?? config.container?.ports,
      installCommands:
        rawAgentConfig.container?.installCommands ??
        config.container?.installCommands,
      entrypoint: rawAgentConfig.container?.entrypoint ?? [
        "claude",
        "--print",
        "--verbose",
        "--output-format", "stream-json",
        "--dangerously-skip-permissions",
        rawAgentConfig.systemPrompt,
      ],
    };

    const filesystem = new AgentFilesystem(
      rawAgentConfig.filesystem?.rootDir ?? "/workspace",
      rawAgentConfig.filesystem?.tree ?? [],
    );

    // Resolve agent skill references to Skill instances
    // Default skills (get-agents, ping) are always included
    const defaults = defaultSkills();
    const skillRefs: string[] = rawAgentConfig.skills ?? [];
    const seen = new Set<string>();
    const resolvedSkills: Skill[] = [];

    // Add all default skills first
    for (const s of defaults) {
      if (!seen.has(s.name)) {
        resolvedSkills.push(s);
        seen.add(s.name);
      }
    }

    // Then add explicitly referenced skills
    for (const name of skillRefs) {
      if (seen.has(name)) continue;
      const skill = registry.get(name);
      if (!skill) {
        throw new Error(
          `Agent "${rawAgentConfig.name}" references unknown skill "${name}"`,
        );
      }
      resolvedSkills.push(skill);
      seen.add(name);
    }

    return {
      name: rawAgentConfig.name,
      skills: resolvedSkills,
      filesystem,
      model,
      systemPrompt: (rawAgentConfig.systemPrompt ?? "") +
        "\n\nYou are running non-interactively. Never ask questions — always take action autonomously. If uncertain, make your best judgment and proceed.",
      container,
    };
  });

  return { config, agents };
}
