/**
 * Waze police reports — fetched via server-side proxy to avoid CORS.
 * Only police-type alerts are kept.
 */

import type { Radar } from '$lib/types';

/**
 * Fetch Waze police alerts for a bounding box.
 * Uses the server-side proxy at /api/waze which handles CORS and Waze API quirks.
 */
export async function fetchWazeAlerts(bbox: {
	top: number;
	bottom: number;
	left: number;
	right: number;
}): Promise<Radar[]> {
	const params = new URLSearchParams({
		top: String(bbox.top),
		bottom: String(bbox.bottom),
		left: String(bbox.left),
		right: String(bbox.right)
	});

	const res = await fetch(`/api/waze?${params}`);
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Waze proxy HTTP ${res.status}: ${text}`);
	}

	return res.json();
}
