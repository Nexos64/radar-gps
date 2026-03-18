import { writable } from 'svelte/store';
import { TTL } from '$lib/config';
import type { Radar } from '$lib/types';
import { getLastFetch, setLastFetch, storeRadars, getAllRadars, getRadarsInView } from './radardb';
import { fetchLuftopRadars } from '$lib/sources/luftop';
import { fetchOsmRadars } from '$lib/sources/overpass';
import { fetchWazeAlerts } from '$lib/sources/waze';

export const radars = writable<Radar[]>([]);
export const radarLoading = writable(false);
export const luftopStale = writable(false);

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

/** Check if Luftop data is stale (> TTL) */
async function checkLuftopStale() {
	const last = await getLastFetch('luftop');
	luftopStale.set(last === 0 || Date.now() - last > TTL.LUFTOP);
}

/** Load radars filtered by bbox and user position radius */
export async function loadRadarsForView(
	userLat: number,
	userLng: number,
	radiusM: number,
	bbox: { north: number; south: number; east: number; west: number }
): Promise<void> {
	const visible = await getRadarsInView(userLat, userLng, radiusM, bbox);
	radars.set(visible);
}

/** Load Luftop + OSM from IndexedDB/network, then refresh the store */
export async function loadStaticRadars() {
	radarLoading.set(true);

	// Load cached data first
	await updateStore();
	await checkLuftopStale();

	// Refresh expired sources in parallel
	const [luftopChanged, osmChanged] = await Promise.all([
		refreshSource('luftop', TTL.LUFTOP, fetchLuftopRadars),
		refreshSource('osm', TTL.OSM, fetchOsmRadars)
	]);

	if (luftopChanged || osmChanged) {
		await updateStore();
	}

	await checkLuftopStale();
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
