<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Map from '$lib/components/Map.svelte';
	import GpsIndicator from '$lib/components/GpsIndicator.svelte';
	import RadarAlert from '$lib/components/RadarAlert.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { requestWakeLock, releaseWakeLock } from '$lib/stores/wakelock';
	import { unlockAudio } from '$lib/stores/audio';
	import type { SheetState } from '$lib/components/BottomSheet.svelte';

	let audioUnlocked = false;
	let sheetState: SheetState = 'closed';
	let bottomSheet: BottomSheet;

	function handleInteraction() {
		if (!audioUnlocked) {
			unlockAudio();
			audioUnlocked = true;
		}
	}

	function onSearchFocus() {
		bottomSheet?.open();
	}

	function onSearchSelect() {
		bottomSheet?.close();
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
	<Map />
	<GpsIndicator />
	<RadarAlert />
	<BottomSheet bind:this={bottomSheet} bind:state={sheetState}>
		<SearchBar on:focus={onSearchFocus} on:select={onSearchSelect} />
	</BottomSheet>
</div>
