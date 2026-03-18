<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PROTOMAPS_API_KEY, MAP_CENTER, MAP_ZOOM } from '$lib/config';
	import { position, startGps, stopGps } from '$lib/stores/gps';
	import type { Map as MLMap } from 'maplibre-gl';

	let container: HTMLDivElement;
	let map: MLMap;
	let followMode = true;
	let unsubscribe: (() => void) | null = null;

	// Zoom adaptatif : plus on va vite, plus on dézoome
	function zoomForSpeed(speedMs: number | null): number {
		if (speedMs == null || speedMs < 1) return 16;    // à l'arrêt
		const kmh = speedMs * 3.6;
		if (kmh < 30) return 16;
		if (kmh < 60) return 15;
		if (kmh < 90) return 14;
		if (kmh < 120) return 13;
		return 12;
	}

	onMount(async () => {
		const maplibregl = await import('maplibre-gl');
		const { Protocol } = await import('pmtiles');
		const { layersWithCustomTheme, namedTheme } = await import('protomaps-themes-base');

		const protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);

		map = new maplibregl.Map({
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
			attributionControl: false,
			pitchWithRotate: false,
			dragRotate: false
		});

		map.on('load', () => {
			// Source GeoJSON pour la position utilisateur
			map.addSource('user-position', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			// Cercle de précision
			map.addLayer({
				id: 'user-accuracy',
				type: 'circle',
				source: 'user-position',
				paint: {
					'circle-radius': ['get', 'accuracyRadius'],
					'circle-color': '#4285F4',
					'circle-opacity': 0.15,
					'circle-stroke-color': '#4285F4',
					'circle-stroke-opacity': 0.3,
					'circle-stroke-width': 1,
					'circle-pitch-alignment': 'map'
				}
			});

			// Point de position (dot bleu)
			map.addLayer({
				id: 'user-dot',
				type: 'circle',
				source: 'user-position',
				paint: {
					'circle-radius': 8,
					'circle-color': '#4285F4',
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2.5,
					'circle-pitch-alignment': 'map'
				}
			});

			// Flèche de direction (triangle)
			map.addLayer({
				id: 'user-heading',
				type: 'symbol',
				source: 'user-position',
				filter: ['has', 'heading'],
				layout: {
					'icon-image': 'heading-arrow',
					'icon-size': 0.5,
					'icon-rotate': ['get', 'heading'],
					'icon-rotation-alignment': 'map',
					'icon-allow-overlap': true,
					'icon-offset': [0, -30]
				}
			});

			// Créer l'image de flèche de direction
			const size = 32;
			const canvas = document.createElement('canvas');
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d')!;
			ctx.fillStyle = '#4285F4';
			ctx.beginPath();
			ctx.moveTo(size / 2, 0);
			ctx.lineTo(size, size);
			ctx.lineTo(size / 2, size * 0.7);
			ctx.lineTo(0, size);
			ctx.closePath();
			ctx.fill();
			map.addImage('heading-arrow', { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });

			startGps();
		});

		// Désactiver le follow quand l'utilisateur drag
		map.on('dragstart', () => { followMode = false; });

		// Souscrire aux updates de position
		unsubscribe = position.subscribe(($pos) => {
			if (!$pos || !map || !map.getSource('user-position')) return;

			// Convertir la précision en mètres → pixels pour le cercle
			const metersPerPixel = getMetersPerPixel($pos.lat, map.getZoom());
			const accuracyRadius = Math.max($pos.accuracy / metersPerPixel, 4);

			const feature: GeoJSON.Feature = {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [$pos.lng, $pos.lat]
				},
				properties: {
					accuracyRadius,
					...(($pos.heading != null && $pos.speed != null && $pos.speed > 1)
						? { heading: $pos.heading }
						: {})
				}
			};

			(map.getSource('user-position') as any).setData({
				type: 'FeatureCollection',
				features: [feature]
			});

			if (followMode) {
				const targetZoom = zoomForSpeed($pos.speed);

				map.easeTo({
					center: [$pos.lng, $pos.lat],
					zoom: targetZoom,
					bearing: ($pos.heading != null && $pos.speed != null && $pos.speed > 1)
						? $pos.heading
						: map.getBearing(),
					duration: 1000
				});
			}
		});
	});

	onDestroy(() => {
		unsubscribe?.();
		stopGps();
	});

	function getMetersPerPixel(lat: number, zoom: number): number {
		return (40075016.686 * Math.cos(lat * Math.PI / 180)) / (512 * Math.pow(2, zoom));
	}

	export function recenter() {
		followMode = true;
	}
</script>

<div bind:this={container} class="map"></div>

<style>
	.map {
		width: 100vw;
		height: 100dvh;
	}
</style>
