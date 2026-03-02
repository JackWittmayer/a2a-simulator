import { Skill } from "./skill";
import { AgentFilesystem } from "./agent-filesystem";
import { ContainerConfig } from "./container";
import { Model } from "./model";
import { defaultSkills } from "./default-skills";
import { SimulationConfig } from "./simulation-config";

export interface Agent {
  name: string;
  skills: Map<string, Skill>;
  filesystem: AgentFilesystem;
  model: Model;
  systemPrompt: string;
  container: ContainerConfig;
}

export function buildAgent(
  agentConfig: Record<string, any>,
  config: SimulationConfig,
  skillRegistry: Map<string, Skill>,
): Agent {
  const model = agentConfig.model ?? config.model;
  if (!model) {
    throw new Error(
      `Agent "${agentConfig.name}" has no model config and no top-level default`,
    );
  }

  const container = {
    baseImage:
      agentConfig.container?.baseImage ??
      config.container?.baseImage ??
      "node:22-slim",
    env: {
      ...config.container?.env,
      ...agentConfig.container?.env,
    },
    ports: agentConfig.container?.ports ?? config.container?.ports,
    installCommands:
      agentConfig.container?.installCommands ??
      config.container?.installCommands,
    entrypoint: agentConfig.container?.entrypoint ?? [
      "claude",
      "--print",
      "--verbose",
      "--output-format", "stream-json",
      "--dangerously-skip-permissions",
      agentConfig.systemPrompt,
    ],
  };

  const filesystem = new AgentFilesystem(
    agentConfig.filesystem?.rootDir ?? "/workspace",
    agentConfig.filesystem?.tree ?? [],
  );

  const skills = new Map<string, Skill>();
  for (const s of defaultSkills()) {
    skills.set(s.name, s);
  }
  for (const name of agentConfig.skills ?? []) {
    if (skills.has(name)) continue;
    const skill = skillRegistry.get(name);
    if (!skill) {
      throw new Error(
        `Agent "${agentConfig.name}" references unknown skill "${name}"`,
      );
    }
    skills.set(name, skill);
  }

  return {
    name: agentConfig.name,
    skills,
    filesystem,
    model,
    systemPrompt: (agentConfig.systemPrompt ?? "") +
      "\n\nYou are running non-interactively. Never ask questions — always take action autonomously. If uncertain, make your best judgment and proceed.",
    container,
  };
}
