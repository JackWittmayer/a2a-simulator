<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { buildAgentColorMap } from '$lib/colors';
	import MessageCard from '$lib/components/MessageCard.svelte';
	import type { AgentMetadata, MessageType, ParsedMessage } from '$lib/types';

	let { data } = $props();

	let activeAgents = $state<Set<string>>(new Set());
	let activeTypes = $state<Set<MessageType>>(
		new Set(['thinking', 'text', 'tool_use', 'tool_result', 'result', 'error', 'message'])
	);
	let live = $state(true);
	let initialized = false;

	let run = $derived(data.run);
	let agentNames = $derived(run.metadata.agents.map((a: AgentMetadata) => a.name));
	let colorMap = $derived(buildAgentColorMap(agentNames));
	let modelMap = $derived(
		Object.fromEntries(run.metadata.agents.map((a: AgentMetadata) => [a.name, a.model]))
	);

	$effect(() => {
		if (!initialized && agentNames.length > 0) {
			activeAgents = new Set(agentNames);
			initialized = true;
		}
	});

	let filtered = $derived(
		(run.messages as ParsedMessage[]).filter(
			(m) => activeAgents.has(m.agent) && activeTypes.has(m.type)
		)
	);

	const typeLabels: { type: MessageType; label: string }[] = [
		{ type: 'thinking', label: 'Thinking' },
		{ type: 'text', label: 'Text' },
		{ type: 'message', label: 'Messages' },
		{ type: 'tool_use', label: 'Tool calls' },
		{ type: 'tool_result', label: 'Tool results' },
		{ type: 'error', label: 'Errors' },
		{ type: 'result', label: 'Final result' }
	];

	function toggleAgent(name: string) {
		const next = new Set(activeAgents);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		activeAgents = next;
	}

	function toggleType(type: MessageType) {
		const next = new Set(activeTypes);
		if (next.has(type)) next.delete(type);
		else next.add(type);
		activeTypes = next;
	}

	onMount(() => {
		const interval = setInterval(() => {
			if (live) invalidateAll();
		}, 2000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>{run.metadata.name} — A2A Viewer</title>
</svelte:head>

<div class="flex h-screen flex-col">
	<div class="shrink-0 border-b border-zinc-800 bg-zinc-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<a href="/" class="text-zinc-500 hover:text-zinc-300">← Runs</a>
			<h1 class="text-lg font-bold text-zinc-100">{run.metadata.name}</h1>
			<button
				class="ml-auto rounded px-2 py-0.5 text-xs transition-colors {live
					? 'bg-emerald-500/20 text-emerald-300'
					: 'bg-zinc-800 text-zinc-500'}"
				onclick={() => (live = !live)}
			>
				{live ? '● Live' : '○ Paused'}
			</button>
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-1">
				<span class="mr-1 text-xs text-zinc-500">Agents:</span>
				{#each agentNames as name}
					{@const color = colorMap[name]}
					{@const active = activeAgents.has(name)}
					<button
						class="rounded px-2 py-0.5 text-xs font-medium transition-colors {active
							? `${color.bg} ${color.text}`
							: 'bg-zinc-800/50 text-zinc-600 line-through'}"
						onclick={() => toggleAgent(name)}
					>
						{name}
					</button>
				{/each}
			</div>

			<div class="h-4 w-px bg-zinc-700"></div>

			<div class="flex items-center gap-1">
				<span class="mr-1 text-xs text-zinc-500">Show:</span>
				{#each typeLabels as { type, label }}
					{@const active = activeTypes.has(type)}
					<button
						class="rounded px-2 py-0.5 text-xs transition-colors {active
							? 'bg-zinc-700 text-zinc-200'
							: 'bg-zinc-800/50 text-zinc-600 line-through'}"
						onclick={() => toggleType(type)}
					>
						{label}
					</button>
				{/each}
			</div>

			<span class="text-xs text-zinc-600">{filtered.length} messages</span>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-auto">
		<div class="mx-auto max-w-3xl space-y-2 p-4">
			{#each filtered as message (message.uuid)}
				{@const color = colorMap[message.agent] ?? { bg: 'bg-zinc-800', text: 'text-zinc-300', border: 'border-zinc-700' }}
				<div class="flex gap-3">
					<div class="mt-1 flex w-36 shrink-0 flex-col items-end gap-0.5">
						<span
							class="truncate rounded px-2 py-0.5 text-xs font-medium {color.bg} {color.text}"
						>
							{message.agent}
						</span>
						<span class="text-[10px] text-zinc-600">
							{modelMap[message.agent]?.replace('claude-', '') ?? ''}
						</span>
						{#if message.timestamp}
							<span class="font-mono text-[10px] text-zinc-600">
								{new Date(message.timestamp).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles' })}
							</span>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<MessageCard {message} />
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
