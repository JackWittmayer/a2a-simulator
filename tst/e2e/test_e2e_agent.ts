import * as path from "node:path";
import { execSync } from "node:child_process";
import { parseAgentConfig } from "../../src/launch/parse_config";
import { buildAgentImage } from "../../src/launch/build";
import { launchAgent } from "../../src/launch/launch";

const credentialsFile = process.argv[2];
if (!credentialsFile) {
  console.error("Usage: node test_e2e_agent.js <path-to-credentials.json>");
  process.exit(1);
}

const configPath = path.resolve(__dirname, "../../../examples/agent.yaml");
const agent = parseAgentConfig(configPath);
agent.model.credentialsFile = path.resolve(credentialsFile);

console.log(`Parsed agent: ${agent.name}`);

console.log("Building image...");
buildAgentImage(agent);
console.log("Image built successfully.");

console.log("Launching container...");
const containerId = launchAgent(agent);
console.log(`Container started: ${containerId}`);

console.log("Waiting for container to finish...");
try {
  execSync(`docker wait ${agent.name}`, { encoding: "utf-8", timeout: 60000 });
} catch {}

const logs = execSync(`docker logs ${agent.name}`, { encoding: "utf-8" });
console.log(`Container logs:\n${logs}`);

console.log("Cleaning up...");
execSync(`docker rm ${agent.name}`, { stdio: "inherit" });
execSync(`docker rmi ${agent.name}`, { stdio: "inherit" });
console.log("Done.");
