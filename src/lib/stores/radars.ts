import { writable } from 'svelte/store';
import { TTL } from '$lib/config';
import type { Radar } from '$lib/types';
import { getLastFetch, setLastFetch, storeRadars, getAllRadars } from './radardb';
import { fetchLuftopRadars } from '$lib/sources/luftop';
import { fetchOsmRadars } from '$lib/sources/overpass';
import { fetchWazeAlerts } from '$lib/sources/waze';

export const radars = writable<Radar[]>([]);
export const radarLoading = writable(false);

let wazeInterval: ReturnType<typeof setInterval> | null = null;
let mapBbox: { top: number; bottom: number; left: number; right: number } | null = null;

async function refreshSource(
	source: string,
	ttl: number,
	fetcher: () => Promise<Radar[]>
): Promise<boolean> {
	const last = await getLastFetch(source);
	if (Date.now() - last < ttl) return false;

	try {
		const data = await fetcher();
		await storeRadars(source, data);
		await setLastFetch(source);
		console.log(`[radars] ${source}: ${data.length} radars loaded`);
		return true;
	} catch (e) {
		console.warn(`[radars] ${source} fetch failed:`, e);
		return false;
	}
}

async function updateStore() {
	const all = await getAllRadars();
	radars.set(all);
}

/** Load Luftop + OSM from IndexedDB/network, then refresh the store */
export async function loadStaticRadars() {
	radarLoading.set(true);

	// Load cached data first
	await updateStore();

	// Refresh expired sources in parallel
	const [luftopChanged, osmChanged] = await Promise.all([
		refreshSource('luftop', TTL.LUFTOP, fetchLuftopRadars),
		refreshSource('osm', TTL.OSM, fetchOsmRadars)
	]);

	if (luftopChanged || osmChanged) {
		await updateStore();
	}

	radarLoading.set(false);
}

/** Start periodic Waze polling based on current map viewport */
export function startWazePolling() {
	if (wazeInterval) return;

	async function poll() {
		if (!mapBbox) return;
		const changed = await refreshSource('waze', 0, () => fetchWazeAlerts(mapBbox!));
		if (changed) await updateStore();
	}

	poll();
	wazeInterval = setInterval(poll, TTL.WAZE);
}

export function stopWazePolling() {
	if (wazeInterval) {
		clearInterval(wazeInterval);
		wazeInterval = null;
	}
}

/** Update the bbox used for Waze polling (call on map move) */
export function setWazeBbox(bbox: { top: number; bottom: number; left: number; right: number }) {
	mapBbox = bbox;
}
