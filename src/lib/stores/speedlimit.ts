/**
 * Speed limit store — queries OSM for the current road's speed limit.
 * Debounced to avoid spamming Overpass.
 */

import { writable } from 'svelte/store';
import { fetchSpeedLimit } from '$lib/sources/speedlimit';
import { logError } from './errorlog';

/** Current speed limit in km/h, or null if unknown */
export const currentSpeedLimit = writable<number | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastQueryKey = '';
const DEBOUNCE_MS = 3000; // query at most every 3s
const KEY_PRECISION = 3; // ~111m grid

/**
 * Update speed limit based on current position.
 * Call on each GPS tick — internally debounced.
 */
export function updateSpeedLimit(lat: number, lng: number) {
	const key = `${lat.toFixed(KEY_PRECISION)},${lng.toFixed(KEY_PRECISION)}`;
	if (key === lastQueryKey) return; // same grid cell

	lastQueryKey = key;

	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(async () => {
		try {
			const limit = await fetchSpeedLimit(lat, lng);
			currentSpeedLimit.set(limit);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			logError('speedlimit', msg);
		}
	}, DEBOUNCE_MS);
}

export function resetSpeedLimit() {
	currentSpeedLimit.set(null);
	lastQueryKey = '';
	if (debounceTimer) clearTimeout(debounceTimer);
}
