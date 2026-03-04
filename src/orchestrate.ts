import * as fs from "node:fs";
import * as path from "node:path";
import { resolveCredentials } from "./launch/credentials.js";
import { TabbedView } from "./ui/tabbed-view.js";
import { LogTailer } from "./ui/log-tailer.js";

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

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AssistantMessage {
  message: { content: ContentBlock[] };
}

type OutputFn = (line: string) => void;

function logAssistantMessage(message: AssistantMessage, output: OutputFn): void {
  for (const block of message.message.content) {
    if (block.type === "thinking" && block.thinking) {
      const thought = block.thinking.length > 300
        ? block.thinking.slice(0, 300) + "…"
        : block.thinking;
      output(`\n💭 ${thought}`);
    } else if (block.type === "text" && block.text) {
      output(`\n🔬 Orchestrator:\n${block.text}`);
    } else if (block.type === "tool_use" && block.name) {
      const input = block.input ?? {};
      if (block.name === "Bash" && typeof input.command === "string") {
        output(`\n⚡ ${input.command}`);
      } else if (block.name === "Write" && typeof input.file_path === "string") {
        output(`\n📝 Writing ${input.file_path}`);
      } else if (block.name === "Read" && typeof input.file_path === "string") {
        output(`\n📖 Reading ${input.file_path}`);
      } else if (block.name === "Edit" && typeof input.file_path === "string") {
        output(`\n✏️  Editing ${input.file_path}`);
      } else {
        output(`\n🔧 ${block.name}`);
      }
    }
  }
}

function isSkillCall(block: ContentBlock, skillName: string): boolean {
  if (block.type !== "tool_use" || block.name !== "Bash") return false;
  const cmd = block.input?.command;
  return typeof cmd === "string" && cmd.includes(skillName);
}

interface StreamDelta {
  type: string;
  text?: string;
  thinking?: string;
  partial_json?: string;
}

interface StreamEvent {
  type: string;
  index?: number;
  delta?: StreamDelta;
  content_block?: { type: string; name?: string };
}

function handleStreamEvent(event: StreamEvent, output: OutputFn): void {
  if (event.type === "content_block_start" && event.content_block) {
    const block = event.content_block;
    if (block.type === "thinking") {
      output("\n💭 ");
    } else if (block.type === "text") {
      output("\n🔬 ");
    } else if (block.type === "tool_use" && block.name) {
      output(`\n🔧 ${block.name}: `);
    }
  } else if (event.type === "content_block_delta" && event.delta) {
    const delta = event.delta;
    if (delta.type === "thinking_delta" && delta.thinking) {
      output(delta.thinking);
    } else if (delta.type === "text_delta" && delta.text) {
      output(delta.text);
    }
  }
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<void> {
  const { seedPrompt, configPath } = options;

  if (!seedPrompt && !configPath) {
    throw new Error("Provide either a seed prompt or a config file path");
  }

  const systemPrompt = loadPromptTemplate();
  const useTUI = process.stdout.isTTY === true;

  let userPrompt: string;
  if (configPath) {
    const absPath = path.resolve(configPath);
    if (!useTUI) {
      console.log(`Starting orchestrator with config: ${absPath}`);
    }
    userPrompt = `Your initial config is at ${absPath}. Read it, then start the experiment.`;
  } else {
    if (!useTUI) {
      console.log(`Starting orchestrator with seed prompt: "${seedPrompt}"`);
    }
    userPrompt = `Generate a simulation config for the following scenario, save it to examples/, then run the experiment:\n\n${seedPrompt}`;
  }

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CLAUDECODE;
  env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = env.CLAUDE_CODE_MAX_OUTPUT_TOKENS ?? "128000";

  let tabbedView: TabbedView | null = null;
  let logTailer: LogTailer | null = null;

  const output: OutputFn = useTUI
    ? (line) => tabbedView?.appendOrchestrator(line)
    : (line) => process.stdout.write(line);

  if (useTUI) {
    tabbedView = new TabbedView();
    tabbedView.appendOrchestrator("Launching orchestrator agent...\n");

    const logsDir = path.resolve("logs");
    logTailer = new LogTailer(logsDir, (line) => {
      tabbedView?.appendSimulation(line);
    });
    tabbedView.appendSimulation("Waiting for simulation to start...");
  } else {
    console.log("Launching orchestrator agent...\n");
  }

  try {
    for await (const message of query({
      prompt: userPrompt,
      options: {
        systemPrompt,
        maxTurns: 50,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        env,
      },
    })) {
      if (message.type === "stream_event") {
        const streamMsg = message as unknown as { event: StreamEvent };
        handleStreamEvent(streamMsg.event, output);
      } else if (message.type === "assistant") {
        const msg = message as unknown as AssistantMessage;

        // Only log full messages in non-TUI mode (TUI already got streaming updates)
        if (!useTUI) {
          logAssistantMessage(msg, (line) => console.log(line));
        }

        // Detect simulation lifecycle events
        if (tabbedView && logTailer) {
          for (const block of msg.message.content) {
            if (isSkillCall(block, "start-sim")) {
              logTailer.stop();
              tabbedView.appendSimulation("\n--- New simulation starting ---\n");
              setTimeout(() => logTailer?.start(), 2000);
            } else if (isSkillCall(block, "stop-sim")) {
              logTailer.stop();
              tabbedView.appendSimulation("\n--- Simulation stopped ---");
            }
          }
        }
      } else if ("result" in message) {
        const result = message as unknown as { result: string; is_error: boolean };
        output("\n--- Orchestrator finished ---\n");
        output(result.result);
      }
    }
  } finally {
    logTailer?.stop();
    tabbedView?.destroy();
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

  resolveCredentials();

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
