import * as fs from "node:fs";
import * as path from "node:path";

interface OrchestratorOptions {
  seedPrompt?: string;
  configPath?: string;
}

function loadPromptTemplate(): string {
  const candidates = [
    path.join(__dirname, "prompts", "orchestrate-simulation.md"),
    path.join(__dirname, "..", "src", "prompts", "orchestrate-simulation.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }
  throw new Error("Could not find orchestrate-simulation.md prompt template");
}

function logAssistantMessage(message: { message: { content: unknown[] } }): void {
  for (const block of message.message.content) {
    if (typeof block === "object" && block !== null) {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") {
        console.log(`\n🔬 Orchestrator:\n${b.text}`);
      } else if (b.type === "tool_use") {
        const name = b.name as string;
        const input = b.input as Record<string, unknown>;
        if (name === "Bash" && typeof input.command === "string") {
          console.log(`\n⚡ ${input.command}`);
        } else if (name === "Write" && typeof input.file_path === "string") {
          console.log(`\n📝 Writing ${input.file_path}`);
        } else if (name === "Read" && typeof input.file_path === "string") {
          console.log(`\n📖 Reading ${input.file_path}`);
        } else if (name === "Edit" && typeof input.file_path === "string") {
          console.log(`\n✏️  Editing ${input.file_path}`);
        } else {
          console.log(`\n🔧 ${name}`);
        }
      }
    }
  }
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<void> {
  const { seedPrompt, configPath } = options;

  if (!seedPrompt && !configPath) {
    throw new Error("Provide either a seed prompt or a config file path");
  }

  const systemPrompt = loadPromptTemplate();

  let userPrompt: string;
  if (configPath) {
    const absPath = path.resolve(configPath);
    console.log(`Starting orchestrator with config: ${absPath}`);
    userPrompt = `Your initial config is at ${absPath}. Read it, then start the experiment.`;
  } else {
    console.log(`Starting orchestrator with seed prompt: "${seedPrompt}"`);
    userPrompt = `Generate a simulation config for the following scenario, save it to examples/, then run the experiment:\n\n${seedPrompt}`;
  }

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CLAUDECODE;

  console.log("Launching orchestrator agent...\n");

  for await (const message of query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      maxTurns: 50,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env,
    },
  })) {
    if (message.type === "assistant") {
      logAssistantMessage(message as { message: { content: unknown[] } });
    } else if ("result" in message) {
      const result = message as { result: string; is_error: boolean };
      console.log("\n--- Orchestrator finished ---");
      console.log(result.result);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: orchestrate <seed-prompt | config.yaml>");
    process.exit(1);
  }

  let input = "";
  for (let i = 0; i < args.length; i++) {
    input = args[i];
  }

  const options: OrchestratorOptions = {};
  if (input.endsWith(".yaml") || input.endsWith(".yml")) {
    options.configPath = input;
  } else {
    options.seedPrompt = input;
  }

  await runOrchestrator(options);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
