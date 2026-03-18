/**
 * Waze police reports — fetched via multiple strategies.
 *
 * 1. Direct Waze LiveMap georss endpoint
 * 2. Direct Waze row-rtserver endpoint
 * 3. Server-side proxy (/api/waze) as fallback
 *
 * Only police-type alerts are kept.
 */

import type { Radar } from '$lib/types';

/**
 * Fetch Waze police alerts for a bounding box.
 * Tries direct endpoints first, falls back to server proxy.
 */
export async function fetchWazeAlerts(bbox: {
	top: number;
	bottom: number;
	left: number;
	right: number;
}): Promise<Radar[]> {
	// Strategy 1: Direct georss
	try {
		const params = new URLSearchParams({
			top: String(bbox.top),
			bottom: String(bbox.bottom),
			left: String(bbox.left),
			right: String(bbox.right),
			env: 'row',
			types: 'alerts'
		});
		const res = await fetch(`https://www.waze.com/live-map/api/georss?${params}`, {
			headers: { 'Accept': 'application/json' }
		});
		if (res.ok) {
			const data = await res.json();
			return parseWazeAlerts(data.alerts || []);
		}
	} catch { /* try next */ }

	// Strategy 2: Direct rtserver
	try {
		const res = await fetch(
			`https://www.waze.com/row-rtserver/web/TGeoRSS?bottom=${bbox.bottom}&top=${bbox.top}&left=${bbox.left}&right=${bbox.right}&ma=600&mu=0&types=alerts`,
			{ headers: { 'Accept': 'application/json' } }
		);
		if (res.ok) {
			const data = await res.json();
			return parseWazeAlerts(data.alerts || []);
		}
	} catch { /* try next */ }

	// Strategy 3: Server-side proxy (handles CORS)
	const params = new URLSearchParams({
		top: String(bbox.top),
		bottom: String(bbox.bottom),
		left: String(bbox.left),
		right: String(bbox.right)
	});
	const res = await fetch(`/api/waze?${params}`);
	if (!res.ok) throw new Error(`Waze proxy HTTP ${res.status}`);
	return res.json();
}

function parseWazeAlerts(alerts: any[]): Radar[] {
	return alerts
		.filter((a: any) => a.type === 'POLICE')
		.map((a: any) => ({
			id: `waze-${a.uuid}`,
			lat: a.location?.y ?? a.lat,
			lng: a.location?.x ?? a.lon ?? a.lng,
			type: 'police' as const,
			speedLimit: null,
			angle: null,
			bidirectional: true,
			source: 'waze' as const
		}))
		.filter((r: Radar) =>
			typeof r.lat === 'number' && typeof r.lng === 'number' &&
			!isNaN(r.lat) && !isNaN(r.lng)
		);
}
