import { BBOX } from '$lib/config';
import type { Radar } from '$lib/types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function buildQuery(): string {
	const { south, north, west, east } = BBOX;
	const bbox = `${south},${west},${north},${east}`;
	return `[out:json][timeout:60];
node["highway"="speed_camera"](${bbox});
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

	// Cardinal directions
	const cardinals: Record<string, number> = {
		N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
	};
	if (cardinals[dir.toUpperCase()] !== undefined) {
		return { angle: cardinals[dir.toUpperCase()], bidirectional: false };
	}

	return { angle: null, bidirectional: true };
}

export async function fetchOsmRadars(): Promise<Radar[]> {
	const query = buildQuery();
	const res = await fetch(OVERPASS_URL, {
		method: 'POST',
		body: `data=${encodeURIComponent(query)}`,
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
	});

	if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
	const data = await res.json();

	return data.elements.map((el: any) => {
		const { angle, bidirectional } = parseDirection(el.tags || {});
		return {
			id: `osm-${el.id}`,
			lat: el.lat,
			lng: el.lon,
			type: 'fixed' as const,
			speedLimit: parseSpeedLimit(el.tags || {}),
			angle,
			bidirectional,
			source: 'osm' as const
		};
	});
}
