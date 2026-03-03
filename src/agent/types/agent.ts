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

  const systemPrompt =
    `YOUR VERY FIRST ACTION must be: run /start-listener in the background (run_in_background=true). Do this BEFORE anything else — do not think about your task first. The SERVER_URL environment variable is already set.` +
    "\n\nUse /check-inbox to read new messages. Use /send-message to reply. Use /get-agents to see who's available." +
    "\n\nUse /update-status before and after doing work (e.g. 'thinking', 'coding', 'idle')." +
    "\n\nUse /leave when you have finished your task and the conversation is complete." +
    "\n\nAfter every action, run /check-inbox to see if new messages have arrived. NEVER stop working — keep checking your inbox and responding." +
    "\n\nYou are running non-interactively. Never ask questions — always take action autonomously. If uncertain, make your best judgment and proceed." +
    "\n\n---\n\n" + (agentConfig.systemPrompt ?? "");

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
    "--model", model.name,
    "--system-prompt", systemPrompt,
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
