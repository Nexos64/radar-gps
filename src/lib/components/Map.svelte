<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { PROTOMAPS_API_KEY, TOMTOM_API_KEY, MAP_CENTER, MAP_ZOOM, RADAR_VIEW_RADIUS_M, FREE_TILT_SPEED_MS, FREE_TILT_PITCH } from '$lib/config';
	import { position, startGps, stopGps, compassHeading } from '$lib/stores/gps';
	import { radars, loadStaticRadars, startWazePolling, stopWazePolling, setWazeBbox, loadRadarsForView, luftopStale, checkCountryExpansion } from '$lib/stores/radars';
	import { evaluateAlerts, resetAlerts } from '$lib/stores/alerts';
	import { destination } from '$lib/stores/destination';
	import { navInfo, navStartTick, updateNavPosition, isOffRoute, getRouteRadars, getRemainingGeometry, rerouteFromPosition } from '$lib/stores/navigation';
	import { updateSpeedLimit, resetSpeedLimit } from '$lib/stores/speedlimit';
	import { registerRadarIcons } from './radar-icons';
	import type { Radar } from '$lib/types';
	import type { Map as MLMap } from 'maplibre-gl';
	import type { GpsPosition } from '$lib/stores/gps';

	let container: HTMLDivElement;
	let map: MLMap;
	let followMode = true;
	let cleanupFns: (() => void)[] = [];
	let showStaleWarning = false;

	/** Whether the recenter button should be visible (exported for parent) */
	export let needsRecenter = false;

	// ── Navigation tilt ──
	const NAV_PITCH = 50;
	const NAV_ZOOM_OFFSET = 1;

	/**
	 * Offset en pixels pour déplacer la position utilisateur vers le bas de l'écran.
	 * Positive Y = le centre de la carte se déplace vers le bas = l'utilisateur apparaît plus bas.
	 * MapLibre offset: [x, y] where positive y = down on screen.
	 */
	const NAV_CENTER_OFFSET: [number, number] = [0, 150];
	const FREE_DRIVE_OFFSET: [number, number] = [0, 100];

	/** Types de radars de vitesse à afficher */
	const SPEED_RADAR_TYPES = new Set(['fixed', 'mobile', 'section_start', 'section_end', 'police', 'other']);

	function getPitch(speedMs: number | null, navigating: boolean): number {
		if (navigating) return NAV_PITCH;
		if (speedMs != null && speedMs >= FREE_TILT_SPEED_MS) return FREE_TILT_PITCH;
		return 0;
	}

	function zoomForSpeed(speedMs: number | null, navigating: boolean): number {
		let base: number;
		if (speedMs == null || speedMs < 1) base = 16;
		else {
			const kmh = speedMs * 3.6;
			if (kmh < 30) base = 16;
			else if (kmh < 60) base = 15;
			else if (kmh < 90) base = 14;
			else if (kmh < 120) base = 13;
			else base = 12;
		}
		return navigating ? base + NAV_ZOOM_OFFSET : base;
	}

	/** Get the appropriate center offset based on speed/navigation state */
	function getCenterOffset(speedMs: number | null, navigating: boolean): [number, number] {
		if (navigating) return NAV_CENTER_OFFSET;
		if (speedMs != null && speedMs >= FREE_TILT_SPEED_MS) return FREE_DRIVE_OFFSET;
		return [0, 0]; // no offset when stationary
	}

	function radarsToGeoJson(radarList: Radar[]): GeoJSON.FeatureCollection {
		// Filter to speed radar types only
		const speedRadars = radarList.filter((r) => SPEED_RADAR_TYPES.has(r.type));
		return {
			type: 'FeatureCollection',
			features: speedRadars.map((r) => ({
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
				properties: {
					id: r.id,
					type: r.type,
					speedLimit: r.speedLimit,
					source: r.source,
					icon: `radar-${r.type}`
				}
			}))
		};
	}

	function routeToGeoJson(geometry: [number, number][]): GeoJSON.Feature {
		return {
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: geometry
			},
			properties: {}
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

	/** Recenter on user — exposed for external use */
	export function recenter() {
		followMode = true;
		needsRecenter = false;
		const pos = get(position);
		if (pos && map) {
			const nav = get(navInfo);
			const navigating = nav.state === 'navigating';
			const hasHeading = pos.heading != null && pos.speed != null && pos.speed > 1;
			map.easeTo({
				center: [pos.lng, pos.lat],
				zoom: zoomForSpeed(pos.speed, navigating),
				bearing: hasHeading ? pos.heading! : map.getBearing(),
				pitch: getPitch(pos.speed, navigating),
				offset: getCenterOffset(pos.speed, navigating),
				duration: 800
			});
		}
	}

	onMount(async () => {
		try {
		const maplibregl = await import('maplibre-gl');
		const { Protocol } = await import('pmtiles');
		const { layersWithPartialCustomTheme } = await import('protomaps-themes-base');

		const protocol = new Protocol();
		maplibregl.addProtocol('pmtiles', protocol.tile);

		function scaleLineWidth(w: any, factor: number): any {
			if (typeof w === 'number') return w * factor;
			if (!Array.isArray(w)) return w;
			if (w[0] === 'interpolate' || w[0] === 'interpolate-hcl') {
				return w.map((v: any, i: number) => {
					if (i >= 4 && i % 2 === 0) return typeof v === 'number' ? v * factor : v;
					return v;
				});
			}
			return w;
		}

		const baseLayers = layersWithPartialCustomTheme('protomaps', 'dark', {
			city_label: '#777777',
			city_label_halo: '#1a1c20',
			state_label: '#666666',
			state_label_halo: '#1a1c20',
			country_label: '#777777',
			subplace_label: '#666666',
			subplace_label_halo: '#1a1c20',
			address_label: '#555555',
			address_label_halo: '#1a1c20',
			ocean_label: '#555555',
			peak_label: '#555555',
			waterway_label: '#555555',
			buildings: '#252830',
		}, 'fr');

		const mapLayers = baseLayers.map((layer: any) => {
			if (layer.type === 'line' && layer.paint && 'line-width' in layer.paint) {
				const isRoad = /highway|major|minor|link|other|service|bridges/.test(layer.id);
				if (isRoad) {
					layer = { ...layer, paint: { ...layer.paint, 'line-width': scaleLineWidth(layer.paint['line-width'], 1.4) } };
				}
			}
			return layer;
		});

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
				layers: mapLayers
			},
			center: MAP_CENTER,
			zoom: MAP_ZOOM,
			attributionControl: false,
			pitchWithRotate: false,
			dragRotate: false
		});

		map.on('load', () => {
			// ── TomTom Traffic Flow layer (15-min cache via epoch bucket) ──
			const trafficEpoch = Math.floor(Date.now() / (15 * 60 * 1000));
			map.addSource('tomtom-traffic', {
				type: 'raster',
				tiles: [
					`https://api.tomtom.com/traffic/map/4/tile/flow/relative-delay/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256&style=relative-delay-dark&thickness=2&t=${trafficEpoch}`
				],
				tileSize: 256,
				minzoom: 6,
				maxzoom: 18,
				attribution: '© <a href="https://www.tomtom.com">TomTom</a>'
			});

			map.addLayer({
				id: 'traffic-flow',
				type: 'raster',
				source: 'tomtom-traffic',
				paint: {
					'raster-opacity': 0.5
				}
			});

			// ── Register radar icons ──
			registerRadarIcons(map);

			// ── Navigation arrow icon (always used) — solid blue triangle ──
			{
				const s = 64;
				const c = document.createElement('canvas');
				c.width = s; c.height = s;
				const ctx = c.getContext('2d')!;
				const cx = s / 2;

				ctx.save();
				ctx.shadowColor = 'rgba(0,0,0,0.4)';
				ctx.shadowBlur = 6;
				ctx.shadowOffsetY = 2;

				ctx.beginPath();
				ctx.moveTo(cx, 6);
				ctx.lineTo(cx + 22, 54);
				ctx.lineTo(cx - 22, 54);
				ctx.closePath();
				ctx.fillStyle = '#0099FF';
				ctx.fill();
				ctx.restore();

				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = 2.5;
				ctx.lineJoin = 'round';
				ctx.beginPath();
				ctx.moveTo(cx, 6);
				ctx.lineTo(cx + 22, 54);
				ctx.lineTo(cx - 22, 54);
				ctx.closePath();
				ctx.stroke();

				map.addImage('nav-arrow', { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
			}

			// ── Route polyline ──
			map.addSource('route', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			map.addLayer({
				id: 'route-outline',
				type: 'line',
				source: 'route',
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {
					'line-color': '#005588',
					'line-width': 8,
					'line-opacity': 0.7
				}
			});

			map.addLayer({
				id: 'route-line',
				type: 'line',
				source: 'route',
				layout: { 'line-join': 'round', 'line-cap': 'round' },
				paint: {
					'line-color': '#0099FF',
					'line-width': 5,
					'line-opacity': 0.9
				}
			});

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
					'circle-color': '#0099FF',
					'circle-opacity': 0.15,
					'circle-stroke-color': '#0099FF',
					'circle-stroke-opacity': 0.3,
					'circle-stroke-width': 1,
					'circle-pitch-alignment': 'map'
				}
			});

			map.addLayer({
				id: 'user-marker',
				type: 'symbol',
				source: 'user-position',
				layout: {
					'icon-image': 'nav-arrow',
					'icon-size': 0.6,
					'icon-rotate': ['get', 'rotation'],
					'icon-rotation-alignment': 'map',
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			});

			// ── Radars ──
			map.addSource('radars', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			map.addLayer({
				id: 'radar-icons',
				type: 'symbol',
				source: 'radars',
				layout: {
					'icon-image': ['get', 'icon'],
					'icon-size': 0.7,
					'icon-allow-overlap': true,
					'icon-ignore-placement': true,
					'icon-rotation-alignment': 'map'
				}
			});

			// ── Destination marker ──
			map.addSource('destination', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			const pinSize = 48;
			const pinCanvas = document.createElement('canvas');
			pinCanvas.width = pinSize;
			pinCanvas.height = pinSize;
			const pinCtx = pinCanvas.getContext('2d')!;
			pinCtx.fillStyle = 'rgba(0,0,0,0.3)';
			pinCtx.beginPath();
			pinCtx.arc(pinSize / 2 + 1, pinSize * 0.38 + 2, 14, 0, Math.PI * 2);
			pinCtx.fill();
			pinCtx.fillStyle = '#0099FF';
			pinCtx.beginPath();
			pinCtx.arc(pinSize / 2, pinSize * 0.38, 14, 0, Math.PI * 2);
			pinCtx.fill();
			pinCtx.strokeStyle = '#ffffff';
			pinCtx.lineWidth = 2.5;
			pinCtx.stroke();
			pinCtx.fillStyle = '#0099FF';
			pinCtx.beginPath();
			pinCtx.moveTo(pinSize / 2 - 7, pinSize * 0.5);
			pinCtx.lineTo(pinSize / 2, pinSize - 4);
			pinCtx.lineTo(pinSize / 2 + 7, pinSize * 0.5);
			pinCtx.fill();
			pinCtx.fillStyle = '#ffffff';
			pinCtx.beginPath();
			pinCtx.arc(pinSize / 2, pinSize * 0.38, 5, 0, Math.PI * 2);
			pinCtx.fill();
			map.addImage('destination-pin', {
				width: pinSize,
				height: pinSize,
				data: new Uint8Array(pinCtx.getImageData(0, 0, pinSize, pinSize).data)
			});

			map.addLayer({
				id: 'destination-marker',
				type: 'symbol',
				source: 'destination',
				layout: {
					'icon-image': 'destination-pin',
					'icon-size': 0.9,
					'icon-anchor': 'bottom',
					'icon-allow-overlap': true,
					'icon-ignore-placement': true
				}
			});

			map.addLayer({
				id: 'destination-label',
				type: 'symbol',
				source: 'destination',
				layout: {
					'text-field': ['get', 'label'],
					'text-size': 13,
					'text-font': ['Noto Sans Bold'],
					'text-offset': [0, 0.8],
					'text-anchor': 'top',
					'text-allow-overlap': false,
					'text-max-width': 14
				},
				paint: {
					'text-color': '#ffffff',
					'text-halo-color': 'rgba(0,0,0,0.8)',
					'text-halo-width': 1.5
				}
			});

			// Lancer GPS + chargement des radars
			startGps();
			loadStaticRadars();
			updateWazeBbox();
			startWazePolling();
		});

		map.on('dragstart', () => { followMode = false; needsRecenter = true; });
		map.on('moveend', () => {
			updateWazeBbox();
			let currentPos: GpsPosition | null = null;
			const unsub = position.subscribe(p => { currentPos = p; });
			unsub();
			debouncedRefresh(currentPos);
		});

		// ── Souscription position GPS ──
		const unsubPosition = position.subscribe(($pos) => {
			if (!$pos || !map || !map.getSource('user-position')) return;

			const nav = get(navInfo);
			const navigating = nav.state === 'navigating';

			const metersPerPixel = getMetersPerPixel($pos.lat, map.getZoom());
			const accuracyRadius = Math.max($pos.accuracy / metersPerPixel, 4);
			const hasHeading = $pos.heading != null && $pos.speed != null && $pos.speed > 1;
			const compass = get(compassHeading);

			// Rotation: use GPS heading if moving, compass heading otherwise
			const rotation = hasHeading ? ($pos.heading ?? 0) : (compass ?? 0);

			const feature: GeoJSON.Feature = {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [$pos.lng, $pos.lat] },
				properties: {
					accuracyRadius,
					rotation
				}
			};

			(map.getSource('user-position') as any).setData({
				type: 'FeatureCollection',
				features: [feature]
			});

			if (followMode) {
				map.easeTo({
					center: [$pos.lng, $pos.lat],
					zoom: zoomForSpeed($pos.speed, navigating),
					bearing: hasHeading ? $pos.heading! : map.getBearing(),
					pitch: getPitch($pos.speed, navigating),
					offset: getCenterOffset($pos.speed, navigating),
					duration: 1000
				});
			}

			// Update speed limit
			updateSpeedLimit($pos.lat, $pos.lng);

			// Check if user crossed into a new country
			checkCountryExpansion($pos.lat, $pos.lng);

			// Refresh visible radars
			debouncedRefresh($pos);

			// Navigation tracking
			if (navigating) {
				updateNavPosition($pos);

				// Update route display with trimmed geometry
				const routeSrc = map.getSource('route');
				if (routeSrc) {
					const remaining = getRemainingGeometry();
					if (remaining.length >= 2) {
						(routeSrc as any).setData(routeToGeoJson(remaining));
					}
				}

				// Check off-route and trigger rerouting
				if (isOffRoute($pos)) {
					rerouteFromPosition($pos);
				}

				// Filter alerts to speed radars on route only
				const routeRadars = getRouteRadars().filter((r) => SPEED_RADAR_TYPES.has(r.type));
				evaluateAlerts($pos, routeRadars, true);
			} else {
				// Free mode: filter to speed radars only
				const allRadars = get(radars).filter((r) => SPEED_RADAR_TYPES.has(r.type));
				evaluateAlerts($pos, allRadars, false);
			}
		});
		cleanupFns.push(unsubPosition);

		// ── Souscription Luftop stale ──
		const unsubStale = luftopStale.subscribe((stale) => {
			showStaleWarning = stale;
		});
		cleanupFns.push(unsubStale);

		// ── Souscription destination ──
		const unsubDest = destination.subscribe(($dest) => {
			if (!map || !map.getSource('destination')) return;

			if ($dest) {
				(map.getSource('destination') as any).setData({
					type: 'FeatureCollection',
					features: [{
						type: 'Feature',
						geometry: { type: 'Point', coordinates: [$dest.lng, $dest.lat] },
						properties: { label: $dest.label }
					}]
				});
				map.flyTo({ center: [$dest.lng, $dest.lat], zoom: 14, duration: 1500 });
			} else {
				(map.getSource('destination') as any).setData({
					type: 'FeatureCollection',
					features: []
				});
			}
		});
		cleanupFns.push(unsubDest);

		// ── Souscription navigation (route polyline) ──
		const unsubNav = navInfo.subscribe(($nav) => {
			if (!map || !map.getSource('route')) return;

			if ($nav.route) {
				// In navigating mode, the route is updated via the position subscription (trimmed)
				// In preview mode, show the full route
				if ($nav.state === 'preview') {
					(map.getSource('route') as any).setData(routeToGeoJson($nav.route.geometry));
				}
			} else {
				(map.getSource('route') as any).setData({ type: 'FeatureCollection', features: [] });
				const pos = get(position);
				if (map.getPitch() > 0 && (!pos || !pos.speed || pos.speed < FREE_TILT_SPEED_MS)) {
					map.easeTo({ pitch: 0, duration: 500 });
				}
			}
		});
		cleanupFns.push(unsubNav);

		// ── Recenter on user when navigation starts ──
		let prevTick = get(navStartTick);
		const unsubNavStart = navStartTick.subscribe((tick) => {
			if (tick > prevTick) {
				prevTick = tick;
				followMode = true;
				needsRecenter = false;
				const pos = get(position);
				if (pos && map) {
					map.easeTo({
						center: [pos.lng, pos.lat],
						zoom: zoomForSpeed(pos.speed, true),
						bearing: (pos.heading != null && pos.speed != null && pos.speed > 1)
							? pos.heading : map.getBearing(),
						pitch: NAV_PITCH,
						offset: NAV_CENTER_OFFSET as [number, number],
						duration: 1000
					});
				}
			}
		});
		cleanupFns.push(unsubNavStart);
		} catch (e) {
			console.error('[Map] Fatal initialization error:', e);
		}
	});

	onDestroy(() => {
		for (const fn of cleanupFns) fn();
		cleanupFns = [];
		stopGps();
		stopWazePolling();
		resetAlerts();
		resetSpeedLimit();
		if (refreshDebounce) clearTimeout(refreshDebounce);
	});

	function getMetersPerPixel(lat: number, zoom: number): number {
		return (40075016.686 * Math.cos(lat * Math.PI / 180)) / (512 * Math.pow(2, zoom));
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
		background: rgba(255, 43, 43, 0.9);
		color: #fff;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 700;
		border-radius: 24px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		white-space: nowrap;
		pointer-events: none;
		box-shadow: 0 2px 12px rgba(255, 43, 43, 0.3);
	}
</style>
