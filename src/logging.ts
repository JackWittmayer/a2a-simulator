/**
 * Summarize a tool_use block for display.
 */
export function formatToolCall(block: any): string {
  const name = block.name;
  const input = block.input ?? {};

  if (name === "Bash") {
    const cmd: string = input.command ?? "";
    const skillMatch = cmd.match(/skills\/([^/]+)\//);
    if (skillMatch) {
      return `[${skillMatch[1]}]`;
    }
    const sleepSkillMatch = cmd.match(/sleep\s+\d+\s*&&.*skills\/([^/]+)\//);
    if (sleepSkillMatch) {
      return `[${sleepSkillMatch[1]}] (polling)`;
    }
    return `[bash] ${input.description ?? cmd.slice(0, 80)}`;
  }

  if (name === "Skill") {
    const skill = input.skill ?? "skill";
    return `[${skill}]${input.args ? " " + input.args.slice(0, 80) : ""}`;
  }

  // Generic fallback
  const summary = JSON.stringify(input);
  return `[${name}] ${summary.length > 100 ? summary.slice(0, 100) + "…" : summary}`;
}

/**
 * Summarize a tool result for display.
 */
export function formatToolResult(content: string): string | null {
  try {
    const data = JSON.parse(content);

    // Inbox messages response
    if (data.messages && Array.isArray(data.messages)) {
      const msgs = data.messages;
      if (msgs.length === 0) return "  → inbox: empty";
      return msgs.map((m: any) =>
        `  📨 ${m.from}: ${m.prompt ?? "(no content)"}`
      ).join("\n");
    }

    // Agent list response
    if (data.agents && Array.isArray(data.agents)) {
      const entries = data.agents.map((a: any) => {
        const parts = [a.name];
        if (a.status) parts.push(`(${a.status})`);
        return parts.join(" ");
      });
      return `  → agents: ${entries.join(", ")}`;
    }

    // Sent message confirmation — show the full message
    if (data.id && data.from && data.to && data.prompt) {
      return `  📤 → ${data.to}: ${data.prompt}`;
    }
    if (data.id && data.from && data.to) {
      return `  → sent to ${data.to}`;
    }

    // Registration
    if (data.registered) {
      return `  → registered as "${data.registered}"`;
    }

    // Ticket responses
    if (data.tickets && Array.isArray(data.tickets)) {
      const count = data.tickets.length;
      return `  → ${count} ticket(s)`;
    }

    // Status update
    if (data.name && data.status && data.statusUpdatedAt) {
      return `  → status: ${data.status}`;
    }

    // Empty result
    if (data.result === "" || Object.keys(data).length === 0) return null;

    // Fallback: truncated JSON
    const s = content.length > 120 ? content.slice(0, 120) + "…" : content;
    return `  → ${s}`;
  } catch {
    // Not JSON — show as-is if short, truncate if long
    if (!content.trim()) return null;
    const s = content.length > 120 ? content.slice(0, 120) + "…" : content;
    return `  → ${s}`;
  }
}

/**
 * Process a line of stream-json output from a claude agent.
 * Returns a display string for stdout, or null if only debug.
 */
export function processStreamLine(agentName: string, line: string): string | null {
  try {
    const data = JSON.parse(line);
    const type = data.type;

    if (type === "assistant") {
      if (data.message?.content) {
        const parts: string[] = [];
        for (const block of data.message.content) {
          if (block.type === "thinking" && block.thinking) {
            const thought = block.thinking.length > 200
              ? block.thinking.slice(0, 200) + "…"
              : block.thinking;
            parts.push(`  💭 ${thought}`);
          } else if (block.type === "text" && block.text) {
            parts.push(block.text);
          } else if (block.type === "tool_use") {
            parts.push(formatToolCall(block));
          }
        }
        if (parts.length) return parts.join("\n");
      }
    } else if (type === "user") {
      // Suppress "Launching skill:" messages — they're noise
      if (data.message?.content) {
        const parts: string[] = [];
        for (const block of data.message.content) {
          if (block.type === "tool_result") {
            if (block.is_error) {
              parts.push(`  ✗ ERROR: ${block.content}`);
            } else if (block.content) {
              // Skip "Launching skill: X" messages
              if (typeof block.content === "string" && block.content.startsWith("Launching skill:")) {
                continue;
              }
              const summary = formatToolResult(block.content);
              if (summary) parts.push(summary);
            }
          }
        }
        if (parts.length) return parts.join("\n");
      }
    } else if (type === "result") {
      if (data.is_error) return `✗ ERROR: ${data.result ?? data.error ?? "unknown error"}`;
      if (data.result) return data.result;
    }

    return null;
  } catch {
    // Not JSON — show as-is (e.g. stderr messages)
    return line;
  }
}
