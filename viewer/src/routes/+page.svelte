<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props();

	onMount(() => {
		const interval = setInterval(() => invalidateAll(), 5000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>A2A Simulator — Runs</title>
</svelte:head>

<div class="mx-auto max-w-5xl p-6">
	<h1 class="mb-6 text-2xl font-bold text-zinc-100">Simulation Runs</h1>

	{#if data.runs.length === 0}
		<p class="text-zinc-400">No runs found. Start a simulation to see logs here.</p>
	{:else}
		<div class="overflow-hidden rounded-lg border border-zinc-800">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
					<tr>
						<th class="px-4 py-3 font-medium">Run</th>
						<th class="px-4 py-3 font-medium">Agents</th>
						<th class="px-4 py-3 font-medium">Model</th>
						<th class="px-4 py-3 font-medium">Date</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-800">
					{#each data.runs as run}
						<tr class="transition-colors hover:bg-zinc-900/50">
							<td class="px-4 py-3">
								<a
									href="/run/{run.name}"
									class="font-medium text-blue-400 hover:text-blue-300 hover:underline"
								>
									{run.name}
								</a>
							</td>
							<td class="px-4 py-3">
								<span class="text-zinc-300">{run.agentCount}</span>
								<span class="ml-1 text-zinc-500">({run.agentNames.join(', ')})</span>
							</td>
							<td class="px-4 py-3">
								<span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
									{run.model}
								</span>
							</td>
							<td class="px-4 py-3 text-zinc-400">
								{run.startedAt ? new Date(run.startedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }) : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
