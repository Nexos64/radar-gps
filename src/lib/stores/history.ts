/**
 * Route history store — saves routes that were actually navigated.
 * Persisted in localStorage. Max 20 entries.
 */

import { writable, get } from 'svelte/store';

export interface RouteHistoryEntry {
	id: string;
	label: string;
	detail: string;
	lat: number;
	lng: number;
	timestamp: number;
}

const STORAGE_KEY = 'radar-gps-history';
const MAX_ENTRIES = 20;

function loadHistory(): RouteHistoryEntry[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch { /* ignore */ }
	return [];
}

function saveHistory(entries: RouteHistoryEntry[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch { /* ignore */ }
}

export const routeHistory = writable<RouteHistoryEntry[]>(loadHistory());

routeHistory.subscribe((val) => {
	saveHistory(val);
});

/**
 * Add a route to history. Call when navigation actually starts (not on preview).
 * Deduplicates by proximity (< 200m from existing entry → update timestamp).
 */
export function addToHistory(label: string, detail: string, lat: number, lng: number) {
	routeHistory.update((entries) => {
		// Check if we already have a similar destination
		const existing = entries.findIndex((e) => {
			const dLat = e.lat - lat;
			const dLng = e.lng - lng;
			return Math.sqrt(dLat * dLat + dLng * dLng) < 0.002; // ~200m
		});

		const entry: RouteHistoryEntry = {
			id: `${lat.toFixed(5)},${lng.toFixed(5)}`,
			label,
			detail,
			lat,
			lng,
			timestamp: Date.now()
		};

		let updated: RouteHistoryEntry[];
		if (existing >= 0) {
			// Move to top, update
			updated = [entry, ...entries.filter((_, i) => i !== existing)];
		} else {
			updated = [entry, ...entries];
		}

		return updated.slice(0, MAX_ENTRIES);
	});
}

export function clearHistory() {
	routeHistory.set([]);
}
