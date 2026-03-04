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
  initialPrompt: string;
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
    `You receive messages from other agents via a polling loop. Each message is formatted as "[from sender_name] message_content".` +
    `\nTo reply or send messages, use /send-message. Use /get-agents to discover available peers.` +
    `\nWhen your task is fully complete and you have nothing left to do, call /leave to exit. Do not leave prematurely — only after you have completed your objective and communicated your results.` +
    `\nYou are running non-interactively. Never ask questions — always take action autonomously. If uncertain, make your best judgment and proceed.` +
    `\nDo not produce summaries, status reports, or recaps. No human is reading your output — only your tool calls matter. Be concise.` +
    "\n\n---\n\n" + (agentConfig.systemPrompt ?? "");

  const entrypoint = ["node", "/workspace/agent-loop.js"];

  // Extract initial prompt: explicit field, or last arg of old-style claude entrypoint
  let initialPrompt = agentConfig.initialPrompt ?? "";
  if (!initialPrompt && agentConfig.container?.entrypoint) {
    const ep = agentConfig.container.entrypoint as string[];
    if (ep[0] === "claude" && ep.length > 1) {
      initialPrompt = ep[ep.length - 1];
    }
  }

  const container = {
    baseImage:
      agentConfig.container?.baseImage ??
      config.container?.baseImage ??
      "node:22-slim",
    env: {
      ...config.container?.env,
      ...agentConfig.container?.env,
      MODEL_NAME: model.name,
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
    initialPrompt,
    container,
  };
}
