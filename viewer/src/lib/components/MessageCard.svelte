<script lang="ts">
	import type { ParsedMessage } from '$lib/types';

	let { message }: { message: ParsedMessage } = $props();
	let expanded = $state(false);
</script>

{#if message.type === 'thinking'}
	<div class="group rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
		<button
			class="flex w-full cursor-pointer items-start gap-2 text-left text-xs text-zinc-500"
			onclick={() => (expanded = !expanded)}
		>
			<span class="font-mono shrink-0">{expanded ? '▾' : '▸'}</span>
			<span class="italic truncate">{expanded ? 'thinking' : message.content.slice(0, 120) + (message.content.length > 120 ? '…' : '')}</span>
		</button>
		{#if expanded}
			<p class="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400 italic">
				{message.content}
			</p>
		{/if}
	</div>
{:else if message.type === 'text'}
	<div class="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
		{message.content}
	</div>
{:else if message.type === 'tool_use'}
	<div class="rounded border border-zinc-700 bg-zinc-900/50 px-3 py-2">
		<button
			class="flex w-full cursor-pointer items-center gap-2 text-left"
			onclick={() => (expanded = !expanded)}
		>
			<span class="font-mono text-xs text-zinc-500">{expanded ? '▾' : '▸'}</span>
			<span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-yellow-300">
				{message.toolName ?? 'tool'}
			</span>
			<span class="truncate text-xs text-zinc-400">{message.content}</span>
		</button>
		{#if expanded && message.toolInput}
			<pre class="mt-2 overflow-x-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">{JSON.stringify(message.toolInput, null, 2)}</pre>
		{/if}
	</div>
{:else if message.type === 'tool_result'}
	<div class="rounded border border-zinc-800 bg-zinc-900/30 px-3 py-2">
		<button
			class="flex w-full cursor-pointer items-center gap-2 text-left text-xs text-zinc-500"
			onclick={() => (expanded = !expanded)}
		>
			<span class="font-mono">{expanded ? '▾' : '▸'}</span>
			<span>→ {message.content}</span>
		</button>
		{#if expanded && message.toolResultContent}
			<pre class="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">{message.toolResultContent}</pre>
		{/if}
	</div>
{:else if message.type === 'message'}
	<div class="rounded-lg border px-4 py-3 {message.messageDirection === 'sent'
		? 'border-blue-500/30 bg-blue-500/10'
		: 'border-violet-500/30 bg-violet-500/10'}">
		<div class="mb-1 flex items-center gap-2 text-xs">
			{#if message.messageDirection === 'sent'}
				<span class="font-semibold text-blue-300">→ {message.messageTo}</span>
			{:else}
				<span class="font-semibold text-violet-300">← {message.messageFrom}</span>
			{/if}
		</div>
		<div class="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
			{message.content}
		</div>
	</div>
{:else if message.type === 'error'}
	<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
		<span class="text-xs font-semibold text-red-400">Error</span>
		<div class="mt-1 whitespace-pre-wrap font-mono text-xs text-red-300">
			{message.content}
		</div>
	</div>
{:else if message.type === 'result'}
	<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
		<div class="mb-2 flex items-center gap-3 text-xs text-zinc-400">
			<span class="font-semibold text-emerald-300">Final Result</span>
			{#if message.durationMs}
				<span>{(message.durationMs / 1000).toFixed(1)}s</span>
			{/if}
			{#if message.costUsd}
				<span>${message.costUsd.toFixed(4)}</span>
			{/if}
		</div>
		<div class="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
			{message.content}
		</div>
	</div>
{/if}
