<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { searchNominatim, type NominatimResult } from '$lib/sources/nominatim';
	import { destination, clearDestination } from '$lib/stores/destination';

	const dispatch = createEventDispatcher<{
		focus: void;
		select: NominatimResult;
	}>();

	let query = '';
	let results: NominatimResult[] = [];
	let loading = false;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let inputEl: HTMLInputElement;

	$: hasDestination = $destination !== null;

	function onInput() {
		if (debounceTimer) clearTimeout(debounceTimer);

		if (query.trim().length < 2) {
			results = [];
			return;
		}

		loading = true;
		debounceTimer = setTimeout(async () => {
			try {
				results = await searchNominatim(query);
			} catch (e) {
				console.warn('Nominatim search error:', e);
				results = [];
			} finally {
				loading = false;
			}
		}, 400); // 400ms debounce (respecte la limite Nominatim 1 req/s)
	}

	function selectResult(result: NominatimResult) {
		destination.set({
			lat: result.lat,
			lng: result.lng,
			label: result.label,
			detail: result.detail
		});
		query = result.label;
		results = [];
		dispatch('select', result);
		inputEl?.blur();
	}

	function onClear() {
		query = '';
		results = [];
		clearDestination();
		inputEl?.focus();
	}

	function onFocus() {
		dispatch('focus');
	}

	/** Type icons for Nominatim results */
	function resultIcon(type: string): string {
		if (type === 'house' || type === 'residential') return '🏠';
		if (type === 'city' || type === 'town' || type === 'village') return '🏙️';
		if (type === 'road' || type === 'street') return '🛣️';
		if (type === 'restaurant' || type === 'cafe') return '🍽️';
		if (type === 'fuel') return '⛽';
		if (type === 'parking') return '🅿️';
		return '📍';
	}
</script>

<div class="search-bar">
	<div class="input-row">
		<span class="search-icon">🔍</span>
		<input
			bind:this={inputEl}
			bind:value={query}
			on:input={onInput}
			on:focus={onFocus}
			type="text"
			placeholder="Où allez-vous ?"
			autocomplete="off"
			autocorrect="off"
			spellcheck="false"
		/>
		{#if query || hasDestination}
			<button class="clear-btn" on:click={onClear}>✕</button>
		{/if}
	</div>

	{#if hasDestination && !results.length && !query}
		<div class="current-dest">
			<span class="dest-icon">📍</span>
			<div class="dest-text">
				<div class="dest-label">{$destination?.label}</div>
				<div class="dest-detail">{$destination?.detail}</div>
			</div>
		</div>
	{/if}
</div>

{#if results.length > 0}
	<div class="search-results-scroll">
		{#each results as result (result.placeId)}
			<button class="result-item" on:click={() => selectResult(result)}>
				<span class="result-icon">{resultIcon(result.type)}</span>
				<div class="result-text">
					<div class="result-label">{result.label}</div>
					<div class="result-detail">{result.detail}</div>
				</div>
			</button>
		{/each}
	</div>
{/if}

{#if loading}
	<div class="search-loading">Recherche...</div>
{/if}

<style>
	.search-bar {
		flex-shrink: 0;
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 10px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 0 14px;
		height: 48px;
	}

	.search-icon {
		font-size: 16px;
		flex-shrink: 0;
		opacity: 0.6;
	}

	input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: #ffffff;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		min-width: 0;
	}

	input::placeholder {
		color: rgba(255, 255, 255, 0.4);
	}

	.clear-btn {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: rgba(255, 255, 255, 0.6);
		width: 24px;
		height: 24px;
		border-radius: 50%;
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.current-dest {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 4px;
	}

	.dest-icon {
		font-size: 18px;
		flex-shrink: 0;
	}

	.dest-text {
		min-width: 0;
	}

	.dest-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
	}

	.dest-detail {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-results-scroll {
		flex: 1;
		overflow-y: auto;
		margin-top: 8px;
		-webkit-overflow-scrolling: touch;
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 4px;
		background: none;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		cursor: pointer;
		text-align: left;
	}

	.result-item:active {
		background: rgba(255, 255, 255, 0.05);
	}

	.result-icon {
		font-size: 20px;
		flex-shrink: 0;
	}

	.result-text {
		min-width: 0;
		flex: 1;
	}

	.result-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: #ffffff;
	}

	.result-detail {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.45);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-loading {
		padding: 16px 4px;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.4);
	}
</style>
