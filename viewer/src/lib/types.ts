export interface RunMetadata {
	name: string;
	agents: AgentMetadata[];
	startedAt: string;
}

export interface AgentMetadata {
	name: string;
	model: string;
	sessionId: string;
}

export type MessageType = 'thinking' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'message';

export interface ParsedMessage {
	uuid: string;
	type: MessageType;
	agent: string;
	index: number;
	timestamp: string;
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
	toolResultContent?: string;
	messageId?: string;
	durationMs?: number;
	costUsd?: number;
	messageFrom?: string;
	messageTo?: string;
	messageDirection?: 'sent' | 'received';
}

export interface AgentLog {
	metadata: AgentMetadata;
	messages: ParsedMessage[];
}

export interface ParsedRun {
	metadata: RunMetadata;
	messages: ParsedMessage[];
	agentMessages: Record<string, ParsedMessage[]>;
}

export interface RunSummary {
	name: string;
	agentCount: number;
	agentNames: string[];
	model: string;
	startedAt: string;
}
