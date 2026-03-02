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

  const systemPrompt = (agentConfig.systemPrompt ?? "") +
    "\n\nFirst, register with the server using /register. Then loop forever: check inbox, reply, sleep 10s, repeat." +
    "\n\nYou are running non-interactively. Never ask questions — always take action autonomously. If uncertain, make your best judgment and proceed." +
    "\n\nIf the other agent has not replied after a reasonable wait, send a follow-up message to nudge them." +
    " Do not give up or stop — keep the conversation going by re-sending or rephrasing your last message if needed.";

  const baseEntrypoint = agentConfig.container?.entrypoint ?? [
    "claude",
    "--print",
    "--verbose",
    "--output-format", "stream-json",
    "--dangerously-skip-permissions",
    agentConfig.systemPrompt,
  ];

  // Inject --system-prompt and --no-session-persistence after "claude"
  const entrypoint = [
    baseEntrypoint[0],
    "--system-prompt", systemPrompt,
    "--no-session-persistence",
    "--disallowedTools", "AskUserQuestion,EnterPlanMode",
    ...baseEntrypoint.slice(1),
  ];

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
    entrypoint,
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
    systemPrompt,
    container,
  };
}
