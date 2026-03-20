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

	/** SVG icon paths for Nominatim result types */
	function resultIconType(type: string): string {
		if (type === 'house' || type === 'residential') return 'home';
		if (type === 'city' || type === 'town' || type === 'village') return 'city';
		if (type === 'road' || type === 'street') return 'road';
		if (type === 'restaurant' || type === 'cafe') return 'food';
		if (type === 'fuel') return 'fuel';
		if (type === 'parking') return 'parking';
		return 'pin';
	}
</script>

<div class="search-bar">
	<div class="input-row">
		<svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="11" cy="11" r="8"/>
			<line x1="21" y1="21" x2="16.65" y2="16.65"/>
		</svg>
		<input
			bind:this={inputEl}
			bind:value={query}
			on:input={onInput}
			on:focus={onFocus}
			type="text"
			placeholder="Ou allez-vous ?"
			autocomplete="off"
			autocorrect="off"
			spellcheck="false"
		/>
		{#if query || hasDestination}
			<button class="clear-btn" on:click={onClear}>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18"/>
					<line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		{/if}
	</div>

	{#if hasDestination && !results.length && !query}
		<div class="current-dest">
			<svg class="dest-icon" width="18" height="18" viewBox="0 0 24 24" fill="#0099FF" stroke="none">
				<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
			</svg>
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
				<div class="result-icon-wrap">
					{#if resultIconType(result.type) === 'home'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
					{:else if resultIconType(result.type) === 'city'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
					{:else if resultIconType(result.type) === 'road'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19L8 5"/><path d="M16 5l4 14"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="11" x2="12" y2="13"/><line x1="12" y1="16" x2="12" y2="18"/></svg>
					{:else if resultIconType(result.type) === 'food'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
					{:else if resultIconType(result.type) === 'fuel'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 4"/><line x1="3" y1="22" x2="15" y2="22"/><rect x="6" y="6" width="6" height="5" rx="1"/></svg>
					{:else if resultIconType(result.type) === 'parking'}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>
					{:else}
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					{/if}
				</div>
				<div class="result-text">
					<div class="result-label">{result.label}</div>
					<div class="result-detail">{result.detail}</div>
				</div>
			</button>
		{/each}
	</div>
{/if}

{#if loading}
	<div class="search-loading">
		<div class="loading-spinner"></div>
		Recherche...
	</div>
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
		border-radius: 28px;
		padding: 0 16px;
		height: 48px;
		transition: background 0.2s ease;
	}

	.input-row:focus-within {
		background: rgba(255, 255, 255, 0.12);
	}

	.search-icon {
		flex-shrink: 0;
		color: rgba(255, 255, 255, 0.45);
	}

	input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: #ffffff;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 600;
		min-width: 0;
	}

	input::placeholder {
		color: rgba(255, 255, 255, 0.35);
		font-weight: 500;
	}

	.clear-btn {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		color: rgba(255, 255, 255, 0.6);
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.clear-btn:active {
		background: rgba(255, 255, 255, 0.25);
	}

	.current-dest {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 6px;
	}

	.dest-icon {
		flex-shrink: 0;
	}

	.dest-text {
		min-width: 0;
	}

	.dest-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
	}

	.dest-detail {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.45);
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
		gap: 14px;
		width: 100%;
		padding: 14px 6px;
		background: none;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;
	}

	.result-item:active {
		background: rgba(255, 255, 255, 0.06);
		border-radius: 12px;
	}

	.result-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: rgba(0, 153, 255, 0.12);
		color: #0099FF;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.result-text {
		min-width: 0;
		flex: 1;
	}

	.result-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 700;
		color: #ffffff;
	}

	.result-detail {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-loading {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 6px;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 153, 255, 0.25);
		border-top-color: #0099FF;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
