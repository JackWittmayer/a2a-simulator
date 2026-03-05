import * as fs from "node:fs";
import { parse } from "yaml";
import { Agent, buildAgent } from "../agent/types/agent";
import { Skill } from "../agent/types/skill";
import { defaultSkills } from "../agent/types/default-skills";
import { SimulationConfig, Variation } from "../agent/types/simulation-config";

export interface ParsedSimulation {
  config: SimulationConfig;
  agents: Agent[];
  variationName?: string;
}

function buildSkillRegistry(config: SimulationConfig): Map<string, Skill> {
  const registry = new Map<string, Skill>();
  for (const s of defaultSkills()) {
    registry.set(s.name, s);
  }
  for (const s of config.skills ?? []) {
    registry.set(s.name, new Skill(s.name, s.description, s.skillMd, s.files));
  }
  return registry;
}

function applyVariation(
  config: SimulationConfig,
  variation: Variation,
): SimulationConfig {
  let result = { ...config };

  if (variation.agents) {
    result.agents = config.agents.map((agent: any) => {
      const overrides = variation.agents![agent.name];
      if (!overrides) return agent;
      return {
        ...agent,
        ...(overrides.systemPrompt !== undefined && { systemPrompt: overrides.systemPrompt }),
        ...(overrides.initialPrompt !== undefined && { initialPrompt: overrides.initialPrompt }),
      };
    });
  }

  if (variation.apis && config.apis) {
    result.apis = config.apis.map((api) => {
      const overrides = variation.apis![api.name];
      if (!overrides) return api;
      return {
        ...api,
        ...(overrides.handler !== undefined && { handler: overrides.handler }),
      };
    });
  }

  return result;
}

export function parseSimulationConfig(filePath: string): ParsedSimulation[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const config: SimulationConfig = parse(raw);
  const registry = buildSkillRegistry(config);

  if (!config.variations?.length) {
    const agents = config.agents.map((agentConfig: Record<string, any>) =>
      buildAgent(agentConfig, config, registry),
    );
    return [{ config, agents }];
  }

  return config.variations.map((variation) => {
    const varConfig = applyVariation(config, variation);
    const agents = varConfig.agents.map((agentConfig: Record<string, any>) =>
      buildAgent(agentConfig, varConfig, registry),
    );
    return {
      config: varConfig,
      agents,
      variationName: variation.name,
    };
  });
}
