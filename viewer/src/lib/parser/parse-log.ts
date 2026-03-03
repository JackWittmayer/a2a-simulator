import type { AgentLog, AgentMetadata, ParsedMessage } from '$lib/types';

function formatToolCall(block: { name?: string; input?: Record<string, unknown> }): string {
	const name = block.name ?? 'unknown';
	const input = block.input ?? {};

	if (name === 'Bash') {
		const cmd = (input.command as string) ?? '';
		const skillMatch = cmd.match(/skills\/([^/]+)\//);
		if (skillMatch) return `[${skillMatch[1]}]`;
		return `[bash] ${(input.description as string) ?? cmd.slice(0, 80)}`;
	}

	if (name === 'Skill') {
		return `[${(input.skill as string) ?? 'skill'}]${input.args ? ' ' + String(input.args).slice(0, 80) : ''}`;
	}

	const summary = JSON.stringify(input);
	return `[${name}] ${summary.length > 100 ? summary.slice(0, 100) + '…' : summary}`;
}

interface A2AMessage {
	from: string;
	to: string;
	prompt: string;
	direction: 'sent' | 'received';
}

function extractA2AMessages(content: string): A2AMessage[] | null {
	try {
		const data = JSON.parse(content);
		// Sent message confirmation
		if (data.id && data.from && data.to && data.prompt) {
			return [{ from: data.from, to: data.to, prompt: data.prompt, direction: 'sent' }];
		}
		// Inbox with messages
		if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
			const msgs = data.messages.filter((m: Record<string, unknown>) => m.from && m.to && m.prompt);
			if (msgs.length > 0) {
				return msgs.map((m: Record<string, string>) => ({
					from: m.from, to: m.to, prompt: m.prompt, direction: 'received' as const
				}));
			}
		}
		return null;
	} catch {
		return null;
	}
}

function formatToolResult(content: string): string {
	try {
		const data = JSON.parse(content);
		if (data.messages && Array.isArray(data.messages)) {
			if (data.messages.length === 0) return 'inbox: empty';
			// Non-empty inbox handled by extractA2AMessages
			const senders = [...new Set(data.messages.map((m: { from: string }) => m.from))];
			return `inbox: ${data.messages.length} message(s) from ${senders.join(', ')}`;
		}
		if (data.agents && Array.isArray(data.agents)) {
			const entries = data.agents.map((a: { name: string; status?: string }) => {
				return a.status ? `${a.name} (${a.status})` : a.name;
			});
			return `agents: ${entries.join(', ')}`;
		}
		if (data.id && data.from && data.to) {
			return `sent to ${data.to}`;
		}
		if (data.registered) return `registered as "${data.registered}"`;
		if (data.name && data.status && data.statusUpdatedAt) return `status: ${data.status}`;
		if (data.tickets && Array.isArray(data.tickets)) {
			return `${data.tickets.length} ticket(s)`;
		}
		if (data.status) return `status: ${data.status}`;
		return content.length > 200 ? content.slice(0, 200) + '…' : content;
	} catch {
		return content.length > 200 ? content.slice(0, 200) + '…' : content;
	}
}

function parseLine(line: string): { timestamp: string; data: Record<string, unknown> } | null {
	// New format: "2026-03-02T23:04:14.123Z\t{...}"
	const tabIdx = line.indexOf('\t');
	if (tabIdx > 0) {
		const maybeTsAndJson = line.slice(0, tabIdx);
		if (maybeTsAndJson.match(/^\d{4}-\d{2}-\d{2}T/)) {
			try {
				return { timestamp: maybeTsAndJson, data: JSON.parse(line.slice(tabIdx + 1)) };
			} catch {
				// fall through
			}
		}
	}

	// Old format: raw JSON per line
	try {
		return { timestamp: '', data: JSON.parse(line) };
	} catch {
		return null;
	}
}

export function parseLog(agentName: string, text: string): AgentLog {
	const lines = text.split('\n');
	let metadata: AgentMetadata = { name: agentName, model: 'unknown', sessionId: '' };
	const messages: ParsedMessage[] = [];
	const seenUuids = new Set<string>();
	let index = 0;

	for (const line of lines) {
		if (!line || line.startsWith('---')) continue;

		const parsed = parseLine(line);
		if (!parsed) continue;
		const { timestamp, data } = parsed;

		const uuid = data.uuid as string | undefined;
		if (uuid && seenUuids.has(uuid)) continue;
		if (uuid) seenUuids.add(uuid);

		if (data.type === 'system' && data.subtype === 'init') {
			metadata = {
				name: agentName,
				model: (data.model as string) ?? 'unknown',
				sessionId: (data.session_id as string) ?? ''
			};
			continue;
		}

		const msg = data.message as { id?: string; content?: Record<string, unknown>[] } | undefined;

		if (data.type === 'assistant' && msg?.content) {
			for (const block of msg.content) {
				if (block.type === 'thinking' && block.thinking) {
					messages.push({
						uuid: uuid ?? `${agentName}-${index}`,
						type: 'thinking',
						agent: agentName,
						index: index++,
						timestamp,
						content: block.thinking as string,
						messageId: msg.id
					});
				} else if (block.type === 'text' && block.text) {
					messages.push({
						uuid: uuid ?? `${agentName}-${index}`,
						type: 'text',
						agent: agentName,
						index: index++,
						timestamp,
						content: block.text as string,
						messageId: msg.id
					});
				} else if (block.type === 'tool_use') {
					messages.push({
						uuid: uuid ?? `${agentName}-${index}`,
						type: 'tool_use',
						agent: agentName,
						index: index++,
						timestamp,
						content: formatToolCall(block as { name?: string; input?: Record<string, unknown> }),
						toolName: block.name as string,
						toolInput: block.input as Record<string, unknown>,
						messageId: msg.id
					});
				}
			}
			continue;
		}

		if (data.type === 'user' && msg?.content) {
			for (const block of msg.content) {
				if (block.type === 'tool_result') {
					const contentStr =
						typeof block.content === 'string'
							? block.content
							: block.content
								? JSON.stringify(block.content)
								: '';
					const isError = block.is_error === true;

					// Extract A2A messages (sent confirmations / received inbox)
					if (!isError) {
						const a2aMessages = extractA2AMessages(contentStr);
						if (a2aMessages) {
							for (const a2a of a2aMessages) {
								messages.push({
									uuid: uuid ?? `${agentName}-${index}`,
									type: 'message',
									agent: agentName,
									index: index++,
									timestamp,
									content: a2a.prompt,
									messageFrom: a2a.from,
									messageTo: a2a.to,
									messageDirection: a2a.direction,
									messageId: msg?.id
								});
							}
							continue;
						}
					}

					// Skip "Launching skill:" noise
					if (!isError && contentStr.startsWith('Launching skill:')) {
						continue;
					}

					messages.push({
						uuid: uuid ?? `${agentName}-${index}`,
						type: isError ? 'error' : 'tool_result',
						agent: agentName,
						index: index++,
						timestamp,
						content: isError ? contentStr : formatToolResult(contentStr),
						toolResultContent: contentStr,
						messageId: msg?.id
					});
				}
			}
			continue;
		}

		if (data.type === 'result') {
			const isError = data.is_error === true;
			messages.push({
				uuid: uuid ?? `${agentName}-${index}`,
				type: isError ? 'error' : 'result',
				agent: agentName,
				index: index++,
				timestamp,
				content: (data.result as string) ?? (data.error as string) ?? '',
				durationMs: data.duration_ms as number | undefined,
				costUsd: data.total_cost_usd as number | undefined
			});
			continue;
		}
	}

	return { metadata, messages };
}
