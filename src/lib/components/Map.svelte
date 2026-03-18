<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PROTOMAPS_API_KEY, MAP_CENTER, MAP_ZOOM } from '$lib/config';
	import { position, startGps, stopGps } from '$lib/stores/gps';
	import { radars, loadStaticRadars, startWazePolling, stopWazePolling, setWazeBbox } from '$lib/stores/radars';
	import type { Radar } from '$lib/types';
	import type { Map as MLMap } from 'maplibre-gl';

	let container: HTMLDivElement;
	let map: MLMap;
	let followMode = true;
	let unsubPosition: (() => void) | null = null;
	let unsubRadars: (() => void) | null = null;

	const RADAR_COLORS: Record<string, string> = {
		fixed: '#e53935',
		mobile: '#f57c00',
		traffic_light: '#388e3c',
		section_start: '#ab47bc',
		section_end: '#ab47bc',
		police: '#1565c0',
		other: '#757575'
	};

	const RADAR_ICONS: Record<string, string> = {
		fixed: '📷',
		mobile: '🚗',
		traffic_light: '🚦',
		section_start: '⏱',
		section_end: '⏱',
		police: '👮',
		other: '⚠️'
	};

	function zoomForSpeed(speedMs: number | null): number {
		if (speedMs == null || speedMs < 1) return 16;
		const kmh = speedMs * 3.6;
		if (kmh < 30) return 16;
		if (kmh < 60) return 15;
		if (kmh < 90) return 14;
		if (kmh < 120) return 13;
		return 12;
	}

	function radarsToGeoJson(radarList: Radar[]): GeoJSON.FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: radarList.map((r) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
				properties: {
					id: r.id,
					type: r.type,
					speedLimit: r.speedLimit,
					angle: r.angle,
					bidirectional: r.bidirectional,
					source: r.source,
					color: RADAR_COLORS[r.type] || RADAR_COLORS.other,
					icon: RADAR_ICONS[r.type] || RADAR_ICONS.other
				}
			}))
		};
	}

	function updateWazeBbox() {
		if (!map) return;
		const bounds = map.getBounds();
		setWazeBbox({
			top: bounds.getNorth(),
			bottom: bounds.getSouth(),
			left: bounds.getWest(),
			right: bounds.getEast()
		});
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
			// ── Position utilisateur ──
			map.addSource('user-position', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

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

			// Image flèche de direction
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

			// ── Radars ──
			map.addSource('radars', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			// Cercle de fond du radar
			map.addLayer({
				id: 'radar-circles',
				type: 'circle',
				source: 'radars',
				paint: {
					'circle-radius': 12,
					'circle-color': ['get', 'color'],
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2,
					'circle-pitch-alignment': 'map'
				}
			});

			// Label vitesse sur le radar
			map.addLayer({
				id: 'radar-labels',
				type: 'symbol',
				source: 'radars',
				filter: ['has', 'speedLimit'],
				layout: {
					'text-field': ['to-string', ['get', 'speedLimit']],
					'text-size': 10,
					'text-font': ['Noto Sans Regular'],
					'text-allow-overlap': true
				},
				paint: {
					'text-color': '#ffffff',
					'text-halo-color': 'rgba(0,0,0,0.5)',
					'text-halo-width': 1
				}
			});

			// Flèche de direction du radar
			map.addLayer({
				id: 'radar-direction',
				type: 'symbol',
				source: 'radars',
				filter: ['all', ['has', 'angle'], ['!', ['get', 'bidirectional']]],
				layout: {
					'icon-image': 'heading-arrow',
					'icon-size': 0.35,
					'icon-rotate': ['get', 'angle'],
					'icon-rotation-alignment': 'map',
					'icon-allow-overlap': true,
					'icon-offset': [0, -40]
				}
			});

			// Lancer GPS + chargement des radars
			startGps();
			loadStaticRadars();
			updateWazeBbox();
			startWazePolling();
		});

		map.on('dragstart', () => { followMode = false; });
		map.on('moveend', updateWazeBbox);

		// ── Souscription position GPS ──
		unsubPosition = position.subscribe(($pos) => {
			if (!$pos || !map || !map.getSource('user-position')) return;

			const metersPerPixel = getMetersPerPixel($pos.lat, map.getZoom());
			const accuracyRadius = Math.max($pos.accuracy / metersPerPixel, 4);

			const feature: GeoJSON.Feature = {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [$pos.lng, $pos.lat] },
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
				map.easeTo({
					center: [$pos.lng, $pos.lat],
					zoom: zoomForSpeed($pos.speed),
					bearing: ($pos.heading != null && $pos.speed != null && $pos.speed > 1)
						? $pos.heading : map.getBearing(),
					duration: 1000
				});
			}
		});

		// ── Souscription radars ──
		unsubRadars = radars.subscribe(($radars) => {
			if (!map || !map.getSource('radars')) return;
			(map.getSource('radars') as any).setData(radarsToGeoJson($radars));
		});
	});

	onDestroy(() => {
		unsubPosition?.();
		unsubRadars?.();
		stopGps();
		stopWazePolling();
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
