/**
 * OSM speed limit lookup via Overpass API.
 *
 * Queries the nearest road segment to the user's position
 * and returns the maxspeed tag if available.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/** Cache: "lat,lng" rounded to ~100m → speed limit */
const cache = new Map<string, { limit: number | null; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute
const CACHE_PRECISION = 3; // decimal places (~111m)

function cacheKey(lat: number, lng: number): string {
	return `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
}

/**
 * Fetch speed limit for a position from OSM.
 * Returns speed limit in km/h, or null if unavailable.
 */
export async function fetchSpeedLimit(lat: number, lng: number): Promise<number | null> {
	const key = cacheKey(lat, lng);
	const cached = cache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return cached.limit;
	}

	try {
		// Query: find the nearest road within 30m and get its maxspeed
		const query = `
[out:json][timeout:5];
way(around:30,${lat},${lng})["highway"]["maxspeed"];
out tags 1;
`.trim();

		const res = await fetch(OVERPASS_URL, {
			method: 'POST',
			body: `data=${encodeURIComponent(query)}`,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		});

		if (!res.ok) {
			cache.set(key, { limit: null, timestamp: Date.now() });
			return null;
		}

		const data = await res.json();
		let limit: number | null = null;

		if (data.elements?.length > 0) {
			const maxspeed = data.elements[0].tags?.maxspeed;
			if (maxspeed) {
				// Parse "50", "30 mph" etc.
				const parsed = parseInt(maxspeed, 10);
				if (!isNaN(parsed)) {
					// Convert mph if needed
					limit = maxspeed.includes('mph') ? Math.round(parsed * 1.60934) : parsed;
				}
			}
		}

		cache.set(key, { limit, timestamp: Date.now() });
		return limit;
	} catch {
		return null;
	}
}

/** Clear the cache */
export function clearSpeedLimitCache() {
	cache.clear();
}
