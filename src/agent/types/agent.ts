import { Skill } from "./skill";
import { AgentFilesystem } from "./agent-filesystem";
import { ContainerConfig } from "./container";
import { Model } from "./model";

export interface Agent {
  name: string;
  skills: Skill[];
  filesystem: AgentFilesystem;
  model: Model;
  systemPrompt: string;
  container: ContainerConfig;
}
