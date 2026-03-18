/**
 * Settings store — persisted in localStorage.
 *
 * - Home/Work addresses
 * - Avoid highways toggle
 * - Radar-free route toggle
 */

import { writable, get } from 'svelte/store';

export interface SavedAddress {
	label: string;
	detail: string;
	lat: number;
	lng: number;
}

export interface AppSettings {
	home: SavedAddress | null;
	work: SavedAddress | null;
	avoidHighways: boolean;
	radarFreeRoute: boolean;
}

const STORAGE_KEY = 'radar-gps-settings';

const DEFAULTS: AppSettings = {
	home: null,
	work: null,
	avoidHighways: false,
	radarFreeRoute: false
};

function loadFromStorage(): AppSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return { ...DEFAULTS, ...parsed };
		}
	} catch { /* ignore */ }
	return { ...DEFAULTS };
}

function saveToStorage(settings: AppSettings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch { /* ignore */ }
}

export const settings = writable<AppSettings>(loadFromStorage());

// Auto-save on change
settings.subscribe((val) => {
	saveToStorage(val);
});

// ── Helpers ──

export function setHome(addr: SavedAddress | null) {
	settings.update((s) => ({ ...s, home: addr }));
}

export function setWork(addr: SavedAddress | null) {
	settings.update((s) => ({ ...s, work: addr }));
}

export function toggleAvoidHighways() {
	settings.update((s) => ({ ...s, avoidHighways: !s.avoidHighways }));
}

export function toggleRadarFreeRoute() {
	settings.update((s) => ({ ...s, radarFreeRoute: !s.radarFreeRoute }));
}

export function getSettings(): AppSettings {
	return get(settings);
}
