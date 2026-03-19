import type { Radar } from '$lib/types';

const OVERPASS_SERVERS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

/** Country bounding boxes */
export const COUNTRY_BBOXES: Record<string, { south: number; north: number; west: number; east: number }> = {
	fr: { south: 41.3, north: 51.1, west: -5.2, east: 9.6 },
	ch: { south: 45.8, north: 47.9, west: 5.9, east: 10.5 },
	de: { south: 47.3, north: 55.1, west: 5.9, east: 15.1 }
};

/**
 * Detect which countries the user is currently in based on GPS coordinates.
 * Returns an array of country codes.
 */
export function detectCountries(lat: number, lng: number): string[] {
	const countries: string[] = [];
	for (const [code, bbox] of Object.entries(COUNTRY_BBOXES)) {
		if (lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east) {
			countries.push(code);
		}
	}
	// Default: FR + CH if not in any known country
	return countries.length > 0 ? countries : ['fr', 'ch'];
}

function buildQuery(bbox: string): string {
	return `[out:json][timeout:90];
(
  node["highway"="speed_camera"](${bbox});
  node["enforcement"="maxspeed"](${bbox});
  node["enforcement"="speed"](${bbox});
);
out body;`;
}

function parseSpeedLimit(tags: Record<string, string>): number | null {
	const v = tags['maxspeed'] || tags['maxspeed:forward'];
	if (!v) return null;
	const n = parseInt(v, 10);
	return isNaN(n) ? null : n;
}

function parseDirection(tags: Record<string, string>): { angle: number | null; bidirectional: boolean } {
	const dir = tags['direction'];
	if (!dir) return { angle: null, bidirectional: true };

	const n = parseFloat(dir);
	if (!isNaN(n)) return { angle: n, bidirectional: false };

	const cardinals: Record<string, number> = {
		N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
	};
	if (cardinals[dir.toUpperCase()] !== undefined) {
		return { angle: cardinals[dir.toUpperCase()], bidirectional: false };
	}

	return { angle: null, bidirectional: true };
}

/**
 * Try fetching from multiple Overpass servers with retry.
 */
async function queryOverpass(query: string): Promise<any> {
	let lastError = '';

	for (const server of OVERPASS_SERVERS) {
		try {
			const res = await fetch(server, {
				method: 'POST',
				body: `data=${encodeURIComponent(query)}`,
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
			});

			if (res.status === 429 || res.status === 504) {
				lastError = `${server} returned ${res.status}`;
				continue;
			}

			if (!res.ok) {
				lastError = `${server} returned ${res.status}`;
				continue;
			}

			return await res.json();
		} catch (e) {
			lastError = e instanceof Error ? e.message : String(e);
			continue;
		}
	}

	throw new Error(`All Overpass servers failed: ${lastError}`);
}

/**
 * Fetch OSM radars for specific countries.
 * @param countries Array of country codes (e.g. ['fr', 'ch'])
 */
export async function fetchOsmRadars(countries?: string[]): Promise<Radar[]> {
	const countriesToLoad = countries ?? ['fr', 'ch'];
	const seenIds = new Set<string>();
	const allRadars: Radar[] = [];

	for (const country of countriesToLoad) {
		const bbox = COUNTRY_BBOXES[country];
		if (!bbox) continue;

		try {
			const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
			const query = buildQuery(bboxStr);
			const data = await queryOverpass(query);

			if (!data.elements) continue;

			for (const el of data.elements) {
				const id = `osm-${el.id}`;
				if (seenIds.has(id)) continue;
				seenIds.add(id);

				const { angle, bidirectional } = parseDirection(el.tags || {});
				allRadars.push({
					id,
					lat: el.lat,
					lng: el.lon,
					type: 'fixed' as const,
					speedLimit: parseSpeedLimit(el.tags || {}),
					angle,
					bidirectional,
					source: 'osm' as const
				});
			}

			// Small delay between countries to be polite to the server
			if (countriesToLoad.indexOf(country) < countriesToLoad.length - 1) {
				await new Promise((r) => setTimeout(r, 2000));
			}
		} catch (e) {
			console.warn(`[OSM] Failed to fetch ${country}:`, e);
		}
	}

	console.log(`[OSM] Total radars fetched for [${countriesToLoad.join(',')}]: ${allRadars.length}`);
	return allRadars;
}
