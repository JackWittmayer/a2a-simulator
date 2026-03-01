import * as path from "node:path";
import { execSync } from "node:child_process";
import { parseAgentConfig } from "../../src/launch/parse_config";
import { buildAgentImage } from "../../src/launch/build";

const configPath = path.resolve(__dirname, "../../../examples/test-agent.yaml");
const agent = parseAgentConfig(configPath);

console.log(`Parsed agent: ${agent.name}`);

console.log("Building image...");
buildAgentImage(agent);
console.log("Image built successfully.");

console.log("Running container...");
const output = execSync(`docker run --rm ${agent.name}`, { encoding: "utf-8" }).trim();
console.log(`Container output: ${output}`);

if (output === "Hello from the test agent!") {
  console.log("E2E test passed!");
} else {
  console.error(`E2E test failed! Expected "Hello from the test agent!", got "${output}"`);
  process.exit(1);
}

console.log("Cleaning up image...");
execSync(`docker rmi ${agent.name}`, { stdio: "inherit" });
console.log("Done.");
