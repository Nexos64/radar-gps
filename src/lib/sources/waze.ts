import type { Radar } from '$lib/types';

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
	if (!res.ok) throw new Error(`Waze proxy HTTP ${res.status}`);
	return res.json();
}
