import { BBOX } from '$lib/config';
import type { Radar } from '$lib/types';

const OVERPASS_SERVERS = [
	'https://overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

/**
 * Split the big FR+CH+DE bbox into smaller regional chunks
 * to avoid Overpass timeout on large queries.
 */
function getRegionalBboxes(): string[] {
	// Split into ~6 regions to keep each query manageable
	const { south, north, west, east } = BBOX;
	const midLat = (south + north) / 2;
	const thirds = [west, (west + east) / 3, (2 * (west + east)) / 3, east];

	const bboxes: string[] = [];
	for (let i = 0; i < thirds.length - 1; i++) {
		// Bottom half
		bboxes.push(`${south},${thirds[i]},${midLat},${thirds[i + 1]}`);
		// Top half
		bboxes.push(`${midLat},${thirds[i]},${north},${thirds[i + 1]}`);
	}
	return bboxes;
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
				continue; // Try next server
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

export async function fetchOsmRadars(): Promise<Radar[]> {
	const bboxes = getRegionalBboxes();
	const seenIds = new Set<string>();
	const allRadars: Radar[] = [];

	// Fetch each regional chunk (sequentially to avoid rate limits)
	for (const bbox of bboxes) {
		try {
			const query = buildQuery(bbox);
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

			// Small delay between chunks to be polite to the server
			if (bboxes.indexOf(bbox) < bboxes.length - 1) {
				await new Promise((r) => setTimeout(r, 2000));
			}
		} catch (e) {
			console.warn(`[OSM] Failed to fetch bbox ${bbox}:`, e);
			// Continue with other chunks even if one fails
		}
	}

	console.log(`[OSM] Total radars fetched: ${allRadars.length}`);
	return allRadars;
}
