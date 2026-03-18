<script lang="ts">
	import { onMount } from 'svelte';
	import { PROTOMAPS_API_KEY, MAP_CENTER, MAP_ZOOM } from '$lib/config';

	let container: HTMLDivElement;

	onMount(async () => {
		const maplibregl = await import('maplibre-gl');
		const { Protocol } = await import('pmtiles');
		const { layersWithCustomTheme, namedTheme } = await import('protomaps-themes-base');

		const protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);

		new maplibregl.Map({
			container,
			style: {
				version: 8,
				glyphs: 'https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf',
				sources: {
					protomaps: {
						type: 'vector',
						url: `https://api.protomaps.com/tiles/v4.json?key=${PROTOMAPS_API_KEY}`,
						attribution: '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>'
					}
				},
				layers: layersWithCustomTheme('protomaps', namedTheme('dark'))
			},
			center: MAP_CENTER,
			zoom: MAP_ZOOM,
			attributionControl: false
		});
	});
</script>

<div bind:this={container} class="map"></div>

<style>
	.map {
		width: 100vw;
		height: 100dvh;
	}
</style>
