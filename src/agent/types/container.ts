export interface ContainerConfig {
  baseImage: string;
  env?: Record<string, string>;
  ports?: number[];
  installCommands?: string[];
  entrypoint: string[];
}
