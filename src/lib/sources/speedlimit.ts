/**
 * Speed limit lookup — TomTom Snap to Roads API with Swiss-standard fallback.
 * Cache: localStorage with 1-week TTL for speed limits.
 */

import { TOMTOM_API_KEY } from '$lib/config';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const CACHE_PRECISION = 3; // decimal places (~111m)
const LS_KEY = 'speedlimit-cache';

interface CacheEntry {
	limit: number | null;
	ts: number;
}

// In-memory mirror of localStorage
let memCache: Record<string, CacheEntry> = {};

function loadCache() {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (raw) {
			memCache = JSON.parse(raw);
			// Purge expired entries
			const now = Date.now();
			let changed = false;
			for (const key of Object.keys(memCache)) {
				if (now - memCache[key].ts > CACHE_TTL_MS) {
					delete memCache[key];
					changed = true;
				}
			}
			if (changed) saveCache();
		}
	} catch {
		memCache = {};
	}
}

function saveCache() {
	try {
		// Keep cache size reasonable (max ~2000 entries)
		const keys = Object.keys(memCache);
		if (keys.length > 2000) {
			const sorted = keys.sort((a, b) => memCache[a].ts - memCache[b].ts);
			for (const k of sorted.slice(0, keys.length - 1500)) {
				delete memCache[k];
			}
		}
		localStorage.setItem(LS_KEY, JSON.stringify(memCache));
	} catch {
		// localStorage full — ignore
	}
}

function cacheKey(lat: number, lng: number): string {
	return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
}

function getCached(key: string): number | null | undefined {
	const entry = memCache[key];
	if (!entry) return undefined;
	if (Date.now() - entry.ts > CACHE_TTL_MS) {
		delete memCache[key];
		return undefined;
	}
	return entry.limit;
}

function setCache(key: string, limit: number | null) {
	memCache[key] = { limit, ts: Date.now() };
	saveCache();
}

// Load cache on module init
if (typeof window !== 'undefined') {
	loadCache();
}

/** Swiss/European default speed limits by road class */
const FALLBACK_LIMITS: Record<string, number> = {
	motorway: 120,
	motorway_link: 120,
	trunk: 100,
	trunk_link: 80,
	primary: 80,
	primary_link: 80,
	secondary: 80,
	secondary_link: 80,
	tertiary: 60,
	tertiary_link: 60,
	residential: 50,
	living_street: 20,
	unclassified: 80,
	service: 30
};

/**
 * Query the nearest road class from OSM Overpass (for fallback purposes).
 */
async function fetchRoadClass(lat: number, lng: number): Promise<string | null> {
	try {
		const query = `[out:json][timeout:5];way(around:30,${lat},${lng})["highway"];out tags 1;`;
		const res = await fetch('https://overpass-api.de/api/interpreter', {
			method: 'POST',
			body: `data=${encodeURIComponent(query)}`,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		});
		if (!res.ok) return null;
		const data = await res.json();
		if (data.elements?.length > 0) {
			return data.elements[0].tags?.highway || null;
		}
	} catch {
		// ignore
	}
	return null;
}

/**
 * Fetch speed limit for a position from TomTom Snap to Roads API.
 * Falls back to Swiss standard limits based on OSM road class.
 * Cache: 1 week in localStorage.
 */
export async function fetchSpeedLimit(lat: number, lng: number): Promise<number | null> {
	const key = cacheKey(lat, lng);
	const cached = getCached(key);
	if (cached !== undefined) return cached;

	try {
		const url = `https://api.tomtom.com/snap-to-roads/1/snap-to-roads?key=${TOMTOM_API_KEY}`;
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				points: [{ latitude: lat, longitude: lng }],
				fields: '{snappedPoints{speedLimit}}'
			})
		});

		if (res.ok) {
			const data = await res.json();
			const speedLimit = data?.snappedPoints?.[0]?.speedLimit;
			if (speedLimit && typeof speedLimit === 'number' && speedLimit > 0) {
				setCache(key, speedLimit);
				return speedLimit;
			}
		}
	} catch {
		// TomTom failed, fall through to fallback
	}

	// Fallback: get road class from OSM and use Swiss defaults
	try {
		const roadClass = await fetchRoadClass(lat, lng);
		if (roadClass && roadClass in FALLBACK_LIMITS) {
			const limit = FALLBACK_LIMITS[roadClass];
			setCache(key, limit);
			return limit;
		}
	} catch {
		// ignore
	}

	setCache(key, null);
	return null;
}

/** Clear the cache */
export function clearSpeedLimitCache() {
	memCache = {};
	try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
