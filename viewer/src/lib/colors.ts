const AGENT_COLORS = [
	{ bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
	{ bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
	{ bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
	{ bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
	{ bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
	{ bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' }
];

export function getAgentColor(agentIndex: number) {
	return AGENT_COLORS[agentIndex % AGENT_COLORS.length];
}

export function buildAgentColorMap(agentNames: string[]): Record<string, (typeof AGENT_COLORS)[0]> {
	const map: Record<string, (typeof AGENT_COLORS)[0]> = {};
	for (let i = 0; i < agentNames.length; i++) {
		map[agentNames[i]] = getAgentColor(i);
	}
	return map;
}
