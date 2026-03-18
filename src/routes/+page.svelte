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
	import { requestWakeLock, releaseWakeLock } from '$lib/stores/wakelock';
	import { unlockAudio } from '$lib/stores/audio';
	import { position } from '$lib/stores/gps';
	import { destination } from '$lib/stores/destination';
	import { computeRoute, navInfo, stopNavigation } from '$lib/stores/navigation';
	import type { SheetState } from '$lib/components/BottomSheet.svelte';
	import type { NominatimResult } from '$lib/sources/nominatim';

	let audioUnlocked = false;
	let sheetState: SheetState = 'closed';
	let bottomSheet: BottomSheet;
	let mapComponent: Map;
	let routeError = '';
	let mapNeedsRecenter = false;

	$: isNavActive = $navInfo.state === 'navigating';
	$: isPreviewActive = $navInfo.state === 'preview';
	$: hideSheet = isNavActive || isPreviewActive;

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

	<SpeedOverlay />
	<RadarAlert />
	<TurnByTurn />
	<RoutePreview />

	<RecenterButton visible={mapNeedsRecenter} on:recenter={handleRecenter} />

	{#if !hideSheet}
		<BottomSheet bind:this={bottomSheet} bind:state={sheetState}>
			<SearchBar on:focus={onSearchFocus} on:select={onSearchSelect} />
			{#if routeError}
				<div class="route-error">{routeError}</div>
			{/if}
		</BottomSheet>
	{/if}
</div>

<style>
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
