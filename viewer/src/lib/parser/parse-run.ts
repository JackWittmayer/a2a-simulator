import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParsedRun, RunSummary } from '$lib/types';
import { parseLog } from './parse-log';

export function parseRun(dirPath: string): ParsedRun {
	const runName = path.basename(dirPath);
	const files = fs
		.readdirSync(dirPath)
		.filter((f) => f.endsWith('.debug.log'))
		.sort();

	const agentMessages: Record<string, ReturnType<typeof parseLog>['messages']> = {};
	const agentMetas: ReturnType<typeof parseLog>['metadata'][] = [];

	for (const file of files) {
		const agentName = file.replace('.debug.log', '');
		const text = fs.readFileSync(path.join(dirPath, file), 'utf-8');
		const log = parseLog(agentName, text);
		agentMetas.push(log.metadata);
		agentMessages[agentName] = log.messages;
	}

	const allMessages = Object.values(agentMessages)
		.flat()
		.sort((a, b) => {
			// Sort by timestamp if available, fall back to agent-name + index
			if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
			if (a.timestamp) return -1;
			if (b.timestamp) return 1;
			return a.agent.localeCompare(b.agent) || a.index - b.index;
		});

	// Re-index after sorting
	allMessages.forEach((m, i) => (m.index = i));

	const startedAt =
		files.length > 0
			? fs.statSync(path.join(dirPath, files[0])).mtime.toISOString()
			: new Date().toISOString();

	return {
		metadata: {
			name: runName,
			agents: agentMetas,
			startedAt
		},
		messages: allMessages,
		agentMessages
	};
}

function hasLogFiles(dirPath: string): boolean {
	try {
		return fs.readdirSync(dirPath).some((f) => f.endsWith('.debug.log'));
	} catch {
		return false;
	}
}

function extractRunSummary(dirPath: string, name: string): RunSummary | null {
	const logFiles = fs.readdirSync(dirPath).filter((f) => f.endsWith('.debug.log'));
	if (logFiles.length === 0) return null;

	const agentNames = logFiles.map((f) => f.replace('.debug.log', ''));

	let model = 'unknown';
	let startedAt = '';
	try {
		const firstFile = fs.readFileSync(path.join(dirPath, logFiles[0]), 'utf-8');
		for (const line of firstFile.split('\n')) {
			if (!line || line.startsWith('---')) continue;
			try {
				const data = JSON.parse(line);
				if (data.type === 'system' && data.subtype === 'init') {
					model = data.model ?? 'unknown';
					break;
				}
			} catch {
				continue;
			}
		}
		startedAt = fs.statSync(path.join(dirPath, logFiles[0])).mtime.toISOString();
	} catch {
		// skip
	}

	return { name, agentCount: logFiles.length, agentNames, model, startedAt };
}

export function scanRuns(logsDir: string): RunSummary[] {
	if (!fs.existsSync(logsDir)) return [];

	const entries = fs.readdirSync(logsDir, { withFileTypes: true });
	const runs: RunSummary[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const dirPath = path.join(logsDir, entry.name);

		// Flat structure: logs/<name>/*.debug.log
		if (hasLogFiles(dirPath)) {
			const summary = extractRunSummary(dirPath, entry.name);
			if (summary) runs.push(summary);
		}

		// Nested structure: logs/<sim-name>/<timestamp>/*.debug.log
		// or three levels deep: logs/<sim-name>/<timestamp>/run-N/*.debug.log
		const subEntries = fs.readdirSync(dirPath, { withFileTypes: true });
		for (const sub of subEntries) {
			if (!sub.isDirectory()) continue;
			const subPath = path.join(dirPath, sub.name);
			if (hasLogFiles(subPath)) {
				const summary = extractRunSummary(subPath, `${entry.name}/${sub.name}`);
				if (summary) runs.push(summary);
			}

			// Check one more level for multi-run: <timestamp>/run-N/
			try {
				const subSubEntries = fs.readdirSync(subPath, { withFileTypes: true });
				for (const subSub of subSubEntries) {
					if (!subSub.isDirectory()) continue;
					const subSubPath = path.join(subPath, subSub.name);
					const summary = extractRunSummary(subSubPath, `${entry.name}/${sub.name}/${subSub.name}`);
					if (summary) runs.push(summary);
				}
			} catch {
				// skip if not readable
			}
		}
	}

	return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function resolveRunDir(logsDir: string, name: string): string {
	return path.join(logsDir, name);
}
