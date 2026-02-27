delete (process.env as Record<string, string | undefined>).CLAUDECODE;

import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod/v4';
import { mkdirSync } from 'fs';

export interface AgentSession {
  sessionId?: string;
  systemPrompt: string;
  model: string;
  cwd: string;
  firstMessage: boolean;
}

export function createAgent(opts: {
  systemPrompt: string;
  model: string;
  runId: string;
  role: 'customer' | 'merchant';
}): AgentSession {
  const cwd = `/tmp/a2a-sim/${opts.runId}/${opts.role}`;
  mkdirSync(cwd, { recursive: true });
  return {
    systemPrompt: opts.systemPrompt,
    model: opts.model,
    cwd,
    firstMessage: true,
  };
}

export async function sendMessage(
  agent: AgentSession,
  message: string,
): Promise<{ response: string; reasoning: string; durationMs: number }> {
  const start = Date.now();

  let capturedMessage = '';
  const thinkingBlocks: string[] = [];

  const mcpServer = createSdkMcpServer({
    name: 'a2a-channel',
    version: '1.0.0',
    tools: [
      tool(
        'send_message',
        'Send a message to the other agent. This is how you communicate — use this tool every time you want to say something. Only the content passed to this tool will be seen by the other party.',
        { message: z.string().describe('The message to send to the other agent') },
        async (args) => {
          capturedMessage = args.message;
          return { content: [{ type: 'text' as const, text: 'Message sent successfully.' }] };
        },
      ),
    ],
  });

  const prompt = agent.firstMessage
    ? `${agent.systemPrompt}\n\n---\n\n${message}`
    : message;

  let newSessionId: string | undefined;
  let resultText = '';

  for await (const msg of query({
    prompt,
    options: {
      cwd: agent.cwd,
      resume: agent.sessionId,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      model: agent.model,
      tools: [],
      mcpServers: { 'a2a-channel': mcpServer },
      settingSources: ['user'],
      persistSession: true,
    },
  })) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      newSessionId = msg.session_id;
    }
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'thinking' && block.thinking) {
          thinkingBlocks.push(block.thinking);
        }
      }
    }
    if (msg.type === 'result') {
      if (msg.subtype === 'success') {
        resultText = msg.result;
      } else {
        resultText = `[ERROR: ${msg.subtype}] ${msg.errors?.join(', ') ?? 'unknown error'}`;
      }
    }
  }

  if (newSessionId) {
    agent.sessionId = newSessionId;
  }
  agent.firstMessage = false;

  // Prefer the tool-captured message; fall back to result text if agent didn't use the tool
  const response = capturedMessage || resultText;

  return {
    response,
    reasoning: thinkingBlocks.join('\n\n'),
    durationMs: Date.now() - start,
  };
}
