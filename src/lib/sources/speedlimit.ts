/**
 * Speed limit lookup — Overpass API with multi-server fallback + Swiss-standard defaults.
 * Cache: localStorage with 1-week TTL.
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const CACHE_PRECISION = 3; // decimal places (~111m)
const LS_KEY = 'speedlimit-cache';

const OVERPASS_SERVERS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

interface CacheEntry {
	limit: number | null;
	ts: number;
}

let memCache: Record<string, CacheEntry> = {};

function loadCache() {
	try {
		const raw = localStorage.getItem(LS_KEY);
		if (raw) {
			memCache = JSON.parse(raw);
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
		const keys = Object.keys(memCache);
		if (keys.length > 2000) {
			const sorted = keys.sort((a, b) => memCache[a].ts - memCache[b].ts);
			for (const k of sorted.slice(0, keys.length - 1500)) {
				delete memCache[k];
			}
		}
		localStorage.setItem(LS_KEY, JSON.stringify(memCache));
	} catch { /* ignore */ }
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
 * Query the nearest road's maxspeed and highway type from OSM.
 * Tries multiple Overpass servers.
 */
async function fetchRoadInfo(lat: number, lng: number): Promise<{ maxspeed: number | null; highway: string | null }> {
	const query = `[out:json][timeout:5];way(around:30,${lat},${lng})["highway"];out tags 1;`;

	for (const server of OVERPASS_SERVERS) {
		try {
			const res = await fetch(server, {
				method: 'POST',
				body: `data=${encodeURIComponent(query)}`,
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
			});
			if (res.status === 429) continue; // Rate limited — try next server
			if (!res.ok) continue;

			const data = await res.json();
			if (data.elements?.length > 0) {
				const tags = data.elements[0].tags || {};
				const highway = tags.highway || null;
				const maxspeedStr = tags.maxspeed || tags['maxspeed:forward'];
				let maxspeed: number | null = null;
				if (maxspeedStr) {
					const n = parseInt(maxspeedStr, 10);
					if (!isNaN(n)) maxspeed = n;
				}
				return { maxspeed, highway };
			}
			return { maxspeed: null, highway: null };
		} catch {
			continue;
		}
	}
	return { maxspeed: null, highway: null };
}

/**
 * Fetch speed limit for a position.
 * Uses OSM Overpass with multi-server fallback.
 * Falls back to Swiss standard limits based on road class.
 * Cache: 1 week in localStorage.
 */
export async function fetchSpeedLimit(lat: number, lng: number): Promise<number | null> {
	const key = cacheKey(lat, lng);
	const cached = getCached(key);
	if (cached !== undefined) return cached;

	try {
		const { maxspeed, highway } = await fetchRoadInfo(lat, lng);

		// Use explicit maxspeed if available
		if (maxspeed && maxspeed > 0) {
			setCache(key, maxspeed);
			return maxspeed;
		}

		// Fallback to default by road class
		if (highway && highway in FALLBACK_LIMITS) {
			const limit = FALLBACK_LIMITS[highway];
			setCache(key, limit);
			return limit;
		}
	} catch {
		// All servers failed
	}

	setCache(key, null);
	return null;
}

/** Clear the cache */
export function clearSpeedLimitCache() {
	memCache = {};
	try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
