<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import Map from '$lib/components/Map.svelte';
	import GpsIndicator from '$lib/components/GpsIndicator.svelte';
	import RadarAlert from '$lib/components/RadarAlert.svelte';
	import SpeedOverlay from '$lib/components/SpeedOverlay.svelte';
	import RecenterButton from '$lib/components/RecenterButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import RoutePreview from '$lib/components/RoutePreview.svelte';
	import TurnByTurn from '$lib/components/TurnByTurn.svelte';
	import SettingsPage from '$lib/components/SettingsPage.svelte';
	import AdminPage from '$lib/components/AdminPage.svelte';
	import { requestWakeLock, releaseWakeLock } from '$lib/stores/wakelock';
	import { unlockAudio } from '$lib/stores/audio';
	import { position } from '$lib/stores/gps';
	import { destination } from '$lib/stores/destination';
	import { computeRoute, navInfo, stopNavigation } from '$lib/stores/navigation';
	import type { SheetState } from '$lib/components/BottomSheet.svelte';
	import type { NominatimResult } from '$lib/sources/nominatim';
	import type { RouteHistoryEntry } from '$lib/stores/history';

	let audioUnlocked = false;
	let sheetState: SheetState = 'closed';
	let sheetTopPx = 0;
	let bottomSheet: BottomSheet;
	let mapComponent: Map;
	let routeError = '';
	let mapNeedsRecenter = false;
	let showSettings = false;
	let showAdmin = false;
	let windowHeight = 0;

	$: isNavActive = $navInfo.state === 'navigating';
	$: isPreviewActive = $navInfo.state === 'preview';
	$: hideSheet = isNavActive || isPreviewActive;

	// Overlay positioning based on bottom sheet state
	$: sheetHeightFromBottom = windowHeight > 0 ? windowHeight - sheetTopPx : 80;
	$: overlayBottom = hideSheet ? 96 : Math.max(sheetHeightFromBottom + 12, 96);
	$: overlayVisible = hideSheet || sheetState !== 'full';

	function handleInteraction() {
		if (!audioUnlocked) {
			unlockAudio();
			audioUnlocked = true;
		}
	}

	function onSearchFocus() {
		bottomSheet?.open();
	}

	async function onSearchSelect(e: CustomEvent<NominatimResult>) {
		bottomSheet?.close();
		routeError = '';

		const result = e.detail;
		const pos = get(position);
		if (!pos) {
			routeError = 'Position GPS non disponible';
			return;
		}

		try {
			await computeRoute(pos.lat, pos.lng, result.lat, result.lng);
		} catch (err) {
			console.error('Route error:', err);
			routeError = 'Impossible de calculer l\'itinéraire';
		}
	}

	async function onShortcut(e: CustomEvent<{ label: string; detail: string; lat: number; lng: number }>) {
		bottomSheet?.close();
		routeError = '';

		const addr = e.detail;
		const pos = get(position);
		if (!pos) {
			routeError = 'Position GPS non disponible';
			return;
		}

		// Set destination
		destination.set({ label: addr.label, detail: addr.detail, lat: addr.lat, lng: addr.lng });

		try {
			await computeRoute(pos.lat, pos.lng, addr.lat, addr.lng);
		} catch (err) {
			console.error('Route error:', err);
			routeError = 'Impossible de calculer l\'itinéraire';
		}
	}

	async function onHistorySelect(e: CustomEvent<RouteHistoryEntry>) {
		bottomSheet?.close();
		routeError = '';

		const entry = e.detail;
		const pos = get(position);
		if (!pos) {
			routeError = 'Position GPS non disponible';
			return;
		}

		destination.set({ label: entry.label, detail: entry.detail, lat: entry.lat, lng: entry.lng });

		try {
			await computeRoute(pos.lat, pos.lng, entry.lat, entry.lng);
		} catch (err) {
			console.error('Route error:', err);
			routeError = 'Impossible de calculer l\'itinéraire';
		}
	}

	function handleRecenter() {
		mapComponent?.recenter();
	}

	// When navigation stops, clear destination too
	$: if ($navInfo.state === 'idle' && get(destination) !== null) {
		// Don't clear on first mount — only when returning from nav/preview
	}

	onMount(() => { requestWakeLock(); });
	onDestroy(() => { releaseWakeLock(); });
</script>

<svelte:window bind:innerHeight={windowHeight} />

<svelte:head>
	<title>Radar GPS</title>
</svelte:head>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div on:click={handleInteraction} on:touchstart={handleInteraction}>
	<Map bind:this={mapComponent} bind:needsRecenter={mapNeedsRecenter} />

	{#if !isNavActive}
		<GpsIndicator />
	{/if}

	<SpeedOverlay bottomPx={overlayBottom} visible={overlayVisible} />
	<RadarAlert />
	<TurnByTurn />
	<RoutePreview />

	<RecenterButton visible={mapNeedsRecenter} bottomPx={overlayBottom} on:recenter={handleRecenter} />

	<!-- Hamburger menu button (hidden during navigation/preview) -->
	{#if !hideSheet}
		<button class="hamburger-btn" on:click={() => { showSettings = true; }}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<line x1="3" y1="6" x2="21" y2="6"/>
				<line x1="3" y1="12" x2="21" y2="12"/>
				<line x1="3" y1="18" x2="21" y2="18"/>
			</svg>
		</button>
	{/if}

	{#if !hideSheet}
		<BottomSheet bind:this={bottomSheet} bind:state={sheetState} bind:sheetTopPx={sheetTopPx} on:shortcut={onShortcut} on:history={onHistorySelect}>
			<SearchBar on:focus={onSearchFocus} on:select={onSearchSelect} />
			{#if routeError}
				<div class="route-error">{routeError}</div>
			{/if}
		</BottomSheet>
	{/if}

	{#if showSettings}
		<SettingsPage on:close={() => { showSettings = false; }} on:admin={() => { showSettings = false; showAdmin = true; }} />
	{/if}

	{#if showAdmin}
		<AdminPage on:close={() => { showAdmin = false; }} />
	{/if}
</div>

<style>
	.hamburger-btn {
		position: fixed;
		top: calc(env(safe-area-inset-top, 16px) + 12px);
		left: 16px;
		z-index: 30;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(30, 30, 46, 0.85);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
	}

	.hamburger-btn:active {
		background: rgba(30, 30, 46, 0.95);
		transform: scale(0.95);
	}

	.route-error {
		margin-top: 12px;
		padding: 10px 14px;
		background: rgba(229, 57, 53, 0.15);
		border: 1px solid rgba(229, 57, 53, 0.4);
		border-radius: 10px;
		color: #ff5252;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 500;
	}
</style>
