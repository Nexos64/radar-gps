<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Map from '$lib/components/Map.svelte';
	import GpsIndicator from '$lib/components/GpsIndicator.svelte';
	import { requestWakeLock, releaseWakeLock } from '$lib/stores/wakelock';

	onMount(() => { requestWakeLock(); });
	onDestroy(() => { releaseWakeLock(); });
</script>

<svelte:head>
	<title>Radar GPS</title>
</svelte:head>

<Map />
<GpsIndicator />
