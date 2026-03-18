<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Map from '$lib/components/Map.svelte';
	import GpsIndicator from '$lib/components/GpsIndicator.svelte';
	import RadarAlert from '$lib/components/RadarAlert.svelte';
	import { requestWakeLock, releaseWakeLock } from '$lib/stores/wakelock';
	import { unlockAudio } from '$lib/stores/audio';

	let audioUnlocked = false;

	function handleInteraction() {
		if (!audioUnlocked) {
			unlockAudio();
			audioUnlocked = true;
		}
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
</div>
