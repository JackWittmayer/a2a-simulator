import { Model } from "./model";
import { ApiEndpoint } from "./api-endpoint";
import { Agent } from "./agent";
import { Skill } from "./skill";

export interface SimulationConfig {
  name: string;
  description?: string;
  server?: {
    port?: number;
    host?: string;
  };
  model?: Model;
  container?: {
    baseImage?: string;
    env?: Record<string, string>;
    ports?: number[];
    installCommands?: string[];
  };
  apis?: ApiEndpoint[];
  skills?: Skill[];
  agents: Agent[];
}
