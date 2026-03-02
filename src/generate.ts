import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

function loadPromptTemplate(): string {
  // Try dist location first (when running compiled), then src
  const candidates = [
    path.join(__dirname, "prompts", "generate-simulation.md"),
    path.join(__dirname, "..", "src", "prompts", "generate-simulation.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }
  throw new Error("Could not find generate-simulation.md prompt template");
}

export async function generateSimulation(
  seedPrompt: string,
  outputPath?: string,
): Promise<string> {
  const systemPrompt = loadPromptTemplate();
  const prompt = `Given the seed prompt below, output ONLY valid YAML for a simulation config. No explanation, no markdown fences, no preamble — just the raw YAML content.\n\nSeed prompt: ${seedPrompt}`;

  console.log("Generating simulation config from seed prompt...");
  console.log(`  Seed: "${seedPrompt}"`);

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  let result = "";

  // Remove CLAUDECODE env var to allow nested claude invocation
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CLAUDECODE;

  for await (const message of query({
    prompt,
    options: {
      systemPrompt,
      allowedTools: [],
      maxTurns: 1,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env,
    },
  })) {
    if ("result" in message) {
      result = message.result;
    }
  }

  // Strip any markdown fences the model might have added
  let yaml = result.trim();
  if (yaml.startsWith("```")) {
    yaml = yaml.replace(/^```(?:yaml)?\n?/, "").replace(/\n?```$/, "");
  }

  // Determine output path
  const outFile =
    outputPath ?? path.join("examples", `generated-${Date.now()}.yaml`);
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outFile, yaml + "\n");
  console.log(`\nGenerated simulation config: ${outFile}`);

  return outFile;
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: generate <seed-prompt> [--output <file.yaml>] [--run]",
    );
    process.exit(1);
  }

  let seedPrompt = "";
  let outputPath: string | undefined;
  let shouldRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      outputPath = args[++i];
    } else if (args[i] === "--run" || args[i] === "-r") {
      shouldRun = true;
    } else {
      seedPrompt = args[i];
    }
  }

  if (!seedPrompt) {
    console.error("Error: provide a seed prompt");
    process.exit(1);
  }

  const outFile = await generateSimulation(seedPrompt, outputPath);

  if (shouldRun) {
    console.log(`\nStarting simulation from ${outFile}...\n`);
    execSync(`node ${path.join(__dirname, "start.js")} "${outFile}"`, {
      stdio: "inherit",
    });
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
