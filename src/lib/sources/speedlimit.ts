/**
 * Speed limit lookup — TomTom Snap to Roads API with Swiss-standard fallback.
 */

import { TOMTOM_API_KEY } from '$lib/config';

/** Cache: "lat,lng" rounded to ~100m → speed limit */
const cache = new Map<string, { limit: number | null; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute
const CACHE_PRECISION = 3; // decimal places (~111m)

function cacheKey(lat: number, lng: number): string {
	return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
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
 * Returns the highway type or null.
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
 * Returns speed limit in km/h, or null if unavailable.
 */
export async function fetchSpeedLimit(lat: number, lng: number): Promise<number | null> {
	const key = cacheKey(lat, lng);
	const cached = cache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return cached.limit;
	}

	try {
		// TomTom Snap to Roads — gives speed limit for the nearest road segment
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
				cache.set(key, { limit: speedLimit, timestamp: Date.now() });
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
			cache.set(key, { limit, timestamp: Date.now() });
			return limit;
		}
	} catch {
		// ignore
	}

	cache.set(key, { limit: null, timestamp: Date.now() });
	return null;
}

/** Clear the cache */
export function clearSpeedLimitCache() {
	cache.clear();
}
