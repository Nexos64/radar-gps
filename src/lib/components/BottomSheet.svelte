<script lang="ts" context="module">
	export type SheetState = 'closed' | 'half' | 'full';
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { settings } from '$lib/stores/settings';
	import { routeHistory, clearHistory } from '$lib/stores/history';
	import type { RouteHistoryEntry } from '$lib/stores/history';

	const dispatch = createEventDispatcher<{
		shortcut: { label: string; detail: string; lat: number; lng: number };
		history: RouteHistoryEntry;
	}>();

	/**
	 * Bottom sheet a 3 etats :
	 *   - closed : seul le handle + barre de recherche sont visibles (~80px)
	 *   - half   : mi-hauteur (~45% de l'ecran)
	 *   - full   : plein ecran (sauf safe area top)
	 *
	 * Glissement vertical (touch) pour changer d'etat.
	 */

	export let state: SheetState = 'closed';
	/** Actual top position in pixels (for external overlay positioning) */
	export let sheetTopPx = 0;

	let sheetEl: HTMLDivElement;
	let startY = 0;
	let startTranslate = 0;
	let currentTranslate = 0;
	let dragging = false;
	let windowHeight = 0;

	// Positions en px depuis le haut de l'ecran
	$: closedTop = windowHeight - 80;
	$: halfTop = windowHeight * 0.55;
	$: fullTop = 20; // safe area

	$: targetTop = state === 'full' ? fullTop : state === 'half' ? halfTop : closedTop;

	$: if (!dragging && sheetEl) {
		currentTranslate = targetTop;
	}

	// Export the current top position for overlay positioning
	$: sheetTopPx = currentTranslate;

	function onTouchStart(e: TouchEvent) {
		// Ne pas capturer si le touch est dans un input ou la liste scrollable
		const target = e.target as HTMLElement;
		if (target.closest('input') || target.closest('.search-results-scroll')) return;

		dragging = true;
		startY = e.touches[0].clientY;
		startTranslate = currentTranslate;
	}

	function onTouchMove(e: TouchEvent) {
		if (!dragging) return;
		const dy = e.touches[0].clientY - startY;
		const newY = startTranslate + dy;
		// Clamp entre fullTop et closedTop
		currentTranslate = Math.max(fullTop, Math.min(closedTop, newY));
	}

	function onTouchEnd() {
		if (!dragging) return;
		dragging = false;

		// Determiner l'etat le plus proche
		const distClosed = Math.abs(currentTranslate - closedTop);
		const distHalf = Math.abs(currentTranslate - halfTop);
		const distFull = Math.abs(currentTranslate - fullTop);

		const min = Math.min(distClosed, distHalf, distFull);
		if (min === distFull) state = 'full';
		else if (min === distHalf) state = 'half';
		else {
			state = 'closed';
			blurActiveInput();
		}
	}

	/** Ouvrir le sheet au tap sur la barre de recherche */
	export function open() {
		if (state === 'closed') state = 'half';
	}

	export function close() {
		state = 'closed';
		blurActiveInput();
	}

	/** Blur any focused input to dismiss the keyboard */
	function blurActiveInput() {
		const el = document.activeElement;
		if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
			el.blur();
		}
	}

	function selectShortcut(type: 'home' | 'work') {
		const addr = type === 'home' ? $settings.home : $settings.work;
		if (!addr) return;
		dispatch('shortcut', addr);
	}

	function selectHistory(entry: RouteHistoryEntry) {
		dispatch('history', entry);
	}

	function formatTimeAgo(timestamp: number): string {
		const diff = Date.now() - timestamp;
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `il y a ${mins} min`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `il y a ${hours}h`;
		const days = Math.floor(hours / 24);
		if (days === 1) return 'hier';
		return `il y a ${days}j`;
	}

	onMount(() => {
		windowHeight = window.innerHeight;
		currentTranslate = closedTop;

		const onResize = () => { windowHeight = window.innerHeight; };
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<!-- Overlay — ferme le sheet quand on clique en dehors -->
{#if state !== 'closed'}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="sheet-overlay"
		style="top: 0; height: {currentTranslate}px;"
		on:click={() => { state = 'closed'; blurActiveInput(); }}
		on:touchstart|preventDefault={() => { state = 'closed'; blurActiveInput(); }}
	></div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="bottom-sheet"
	bind:this={sheetEl}
	style="transform: translateY({currentTranslate}px); {dragging ? '' : 'transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);'}"
	on:touchstart={onTouchStart}
	on:touchmove={onTouchMove}
	on:touchend={onTouchEnd}
>
	<!-- Handle -->
	<div class="handle-area">
		<div class="handle"></div>
	</div>

	<!-- Contenu (slot = SearchBar) -->
	<div class="sheet-content">
		<slot />

		<!-- Shortcuts & History (visible en half/full) -->
		{#if state !== 'closed'}
			<!-- Home / Work shortcuts -->
			{#if $settings.home || $settings.work}
				<div class="shortcuts">
					{#if $settings.home}
						<button class="shortcut-btn" on:click={() => selectShortcut('home')}>
							<div class="shortcut-icon-wrap home">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
									<polyline points="9 22 9 12 15 12 15 22"/>
								</svg>
							</div>
							<div class="shortcut-info">
								<div class="shortcut-label">Maison</div>
								<div class="shortcut-detail">{$settings.home.label}</div>
							</div>
						</button>
					{/if}
					{#if $settings.work}
						<button class="shortcut-btn" on:click={() => selectShortcut('work')}>
							<div class="shortcut-icon-wrap work">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
									<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
								</svg>
							</div>
							<div class="shortcut-info">
								<div class="shortcut-label">Travail</div>
								<div class="shortcut-detail">{$settings.work.label}</div>
							</div>
						</button>
					{/if}
				</div>
			{/if}

			<!-- Recent routes -->
			{#if $routeHistory.length > 0}
				<div class="history-section">
					<div class="history-header">
						<span class="history-title">Recents</span>
						<button class="history-clear" on:click={clearHistory}>Effacer</button>
					</div>
					<div class="history-list">
						{#each $routeHistory as entry (entry.id)}
							<button class="history-item" on:click={() => selectHistory(entry)}>
								<div class="history-icon-wrap">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<circle cx="12" cy="12" r="10"/>
										<polyline points="12 6 12 12 16 14"/>
									</svg>
								</div>
								<div class="history-info">
									<div class="history-label">{entry.label}</div>
									<div class="history-detail">{entry.detail}</div>
								</div>
								<span class="history-time">{formatTimeAgo(entry.timestamp)}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.sheet-overlay {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 39;
	}

	.bottom-sheet {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		height: 100vh;
		z-index: 40;
		background: #242830;
		border-radius: 20px 20px 0 0;
		box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		touch-action: none;
		will-change: transform;
	}

	.handle-area {
		display: flex;
		justify-content: center;
		padding: 10px 0 6px;
		cursor: grab;
		flex-shrink: 0;
	}

	.handle {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.2);
	}

	.sheet-content {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		padding: 0 16px 16px;
		-webkit-overflow-scrolling: touch;
	}

	/* Shortcuts */
	.shortcuts {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}

	.shortcut-btn {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		background: rgba(255, 255, 255, 0.05);
		border: none;
		border-radius: 16px;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease;
	}

	.shortcut-btn:active {
		background: rgba(255, 255, 255, 0.1);
	}

	.shortcut-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.shortcut-icon-wrap.home {
		background: rgba(0, 153, 255, 0.15);
		color: #0099FF;
	}

	.shortcut-icon-wrap.work {
		background: rgba(240, 128, 0, 0.15);
		color: #F08000;
	}

	.shortcut-info {
		min-width: 0;
		flex: 1;
	}

	.shortcut-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
	}

	.shortcut-detail {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* History */
	.history-section {
		margin-top: 24px;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.history-title {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.35);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.history-clear {
		background: none;
		border: none;
		color: #0099FF;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		padding: 4px 8px;
	}

	.history-list {
		display: flex;
		flex-direction: column;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 0;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: none;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background 0.15s ease;
	}

	.history-item:active {
		background: rgba(255, 255, 255, 0.04);
	}

	.history-icon-wrap {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.history-info {
		flex: 1;
		min-width: 0;
	}

	.history-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
	}

	.history-detail {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history-time {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.25);
		flex-shrink: 0;
	}
</style>
