<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { PROTOMAPS_API_KEY, MAP_CENTER, MAP_ZOOM, RADAR_VIEW_RADIUS_M } from '$lib/config';
	import { position, startGps, stopGps } from '$lib/stores/gps';
	import { radars, loadStaticRadars, startWazePolling, stopWazePolling, setWazeBbox, loadRadarsForView, luftopStale } from '$lib/stores/radars';
	import { evaluateAlerts, resetAlerts } from '$lib/stores/alerts';
	import { registerRadarIcons } from './radar-icons';
	import type { Radar } from '$lib/types';
	import type { Map as MLMap } from 'maplibre-gl';
	import type { GpsPosition } from '$lib/stores/gps';

	let container: HTMLDivElement;
	let map: MLMap;
	let followMode = true;
	let unsubPosition: (() => void) | null = null;
	let showStaleWarning = false;

	const RADAR_TYPES = ['fixed', 'mobile', 'traffic_light', 'section_start', 'section_end', 'police', 'other'];

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
					icon: `radar-${r.type}`
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

	/** Reload visible radars based on user position + map bounds */
	async function refreshVisibleRadars(pos: GpsPosition | null) {
		if (!map || !pos) return;
		const bounds = map.getBounds();
		await loadRadarsForView(pos.lat, pos.lng, RADAR_VIEW_RADIUS_M, {
			north: bounds.getNorth(),
			south: bounds.getSouth(),
			east: bounds.getEast(),
			west: bounds.getWest()
		});

		// Update the GeoJSON source
		const src = map.getSource('radars');
		if (src) {
			const currentRadars = get(radars);
			(src as any).setData(radarsToGeoJson(currentRadars));
		}
	}

	let refreshDebounce: ReturnType<typeof setTimeout> | null = null;
	function debouncedRefresh(pos: GpsPosition | null) {
		if (refreshDebounce) clearTimeout(refreshDebounce);
		refreshDebounce = setTimeout(() => refreshVisibleRadars(pos), 300);
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
				layers: layersWithCustomTheme('protomaps', namedTheme('dark'), 'fr')
			},
			center: MAP_CENTER,
			zoom: MAP_ZOOM,
			attributionControl: false,
			pitchWithRotate: false,
			dragRotate: false
		});

		map.on('load', () => {
			// ── Register radar icons ──
			registerRadarIcons(map);

			// ── User heading arrow icon ──
			const arrowSize = 32;
			const canvas = document.createElement('canvas');
			canvas.width = arrowSize;
			canvas.height = arrowSize;
			const ctx = canvas.getContext('2d')!;
			ctx.fillStyle = '#4285F4';
			ctx.beginPath();
			ctx.moveTo(arrowSize / 2, 0);
			ctx.lineTo(arrowSize, arrowSize);
			ctx.lineTo(arrowSize / 2, arrowSize * 0.7);
			ctx.lineTo(0, arrowSize);
			ctx.closePath();
			ctx.fill();
			map.addImage('heading-arrow', { width: arrowSize, height: arrowSize, data: new Uint8Array(ctx.getImageData(0, 0, arrowSize, arrowSize).data) });

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

			// ── Radars ──
			map.addSource('radars', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			// Radar icons — symbol layer with per-type image and rotation
			map.addLayer({
				id: 'radar-icons',
				type: 'symbol',
				source: 'radars',
				layout: {
					'icon-image': ['get', 'icon'],
					'icon-size': 0.7,
					'icon-allow-overlap': true,
					'icon-ignore-placement': true,
					// Rotate the icon if the radar has a direction and is not bidirectional
					'icon-rotate': [
						'case',
						['all', ['has', 'angle'], ['!', ['get', 'bidirectional']]],
						['get', 'angle'],
						0
					],
					'icon-rotation-alignment': 'map'
				}
			});

			// Speed limit label on top of the radar icon
			map.addLayer({
				id: 'radar-speed-labels',
				type: 'symbol',
				source: 'radars',
				filter: ['has', 'speedLimit'],
				layout: {
					'text-field': ['to-string', ['get', 'speedLimit']],
					'text-size': 11,
					'text-font': ['Noto Sans Bold'],
					'text-allow-overlap': true,
					'text-ignore-placement': true,
					'text-offset': [0, 2.2]
				},
				paint: {
					'text-color': '#ffffff',
					'text-halo-color': 'rgba(0,0,0,0.8)',
					'text-halo-width': 1.5
				}
			});

			// Direction arrow for unidirectional radars
			map.addLayer({
				id: 'radar-direction',
				type: 'symbol',
				source: 'radars',
				filter: ['all', ['has', 'angle'], ['!', ['get', 'bidirectional']]],
				layout: {
					'icon-image': 'radar-direction-arrow',
					'icon-size': 0.5,
					'icon-rotate': ['get', 'angle'],
					'icon-rotation-alignment': 'map',
					'icon-allow-overlap': true,
					'icon-ignore-placement': true,
					'icon-offset': [0, -35]
				}
			});

			// Lancer GPS + chargement des radars
			startGps();
			loadStaticRadars();
			updateWazeBbox();
			startWazePolling();
		});

		map.on('dragstart', () => { followMode = false; });
		map.on('moveend', () => {
			updateWazeBbox();
			// Refresh visible radars on map move
			let currentPos: GpsPosition | null = null;
			const unsub = position.subscribe(p => { currentPos = p; });
			unsub();
			debouncedRefresh(currentPos);
		});

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

			// Refresh visible radars when position changes
			debouncedRefresh($pos);

			// Évaluer les alertes radar
			evaluateAlerts($pos, get(radars));
		});

		// ── Souscription Luftop stale ──
		const unsubStale = luftopStale.subscribe((stale) => {
			showStaleWarning = stale;
		});

		// Store unsub for cleanup
		const origDestroy = unsubPosition;
		unsubPosition = () => {
			origDestroy?.();
			unsubStale();
		};
	});

	onDestroy(() => {
		unsubPosition?.();
		stopGps();
		stopWazePolling();
		resetAlerts();
		if (refreshDebounce) clearTimeout(refreshDebounce);
	});

	function getMetersPerPixel(lat: number, zoom: number): number {
		return (40075016.686 * Math.cos(lat * Math.PI / 180)) / (512 * Math.pow(2, zoom));
	}

	export function recenter() {
		followMode = true;
	}
</script>

<div bind:this={container} class="map"></div>

{#if showStaleWarning}
	<div class="stale-banner">
		Données radars Luftop périmées — relancer le script d'import
	</div>
{/if}

<style>
	.map {
		width: 100vw;
		height: 100dvh;
	}

	.stale-banner {
		position: fixed;
		bottom: env(safe-area-inset-bottom, 16px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		padding: 10px 20px;
		background: rgba(229, 57, 53, 0.9);
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		border-radius: 24px;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		white-space: nowrap;
		pointer-events: none;
	}
</style>
