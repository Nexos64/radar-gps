import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Waze proxy — fetches police alerts from Waze LiveMap.
 * Tries multiple endpoints for resilience.
 */

const ENDPOINTS = [
	'https://www.waze.com/live-map/api/georss',
	'https://www.waze.com/row-rtserver/web/TGeoRSS'
];

const HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
	'Referer': 'https://www.waze.com/live-map',
	'Accept': 'application/json',
	'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
};

export const GET: RequestHandler = async ({ url }) => {
	const top = url.searchParams.get('top');
	const bottom = url.searchParams.get('bottom');
	const left = url.searchParams.get('left');
	const right = url.searchParams.get('right');

	if (!top || !bottom || !left || !right) {
		return error(400, 'Missing bbox params: top, bottom, left, right');
	}

	let lastError = '';

	for (const endpoint of ENDPOINTS) {
		try {
			const params = endpoint.includes('georss')
				? `?top=${top}&bottom=${bottom}&left=${left}&right=${right}&env=row&types=alerts`
				: `?bottom=${bottom}&top=${top}&left=${left}&right=${right}&ma=600&mu=0&types=alerts`;

			const res = await fetch(`${endpoint}${params}`, { headers: HEADERS });

			if (!res.ok) {
				lastError = `${endpoint} returned ${res.status}`;
				continue;
			}

			const data = await res.json();
			const alerts = (data.alerts || [])
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
				.filter((r: any) => typeof r.lat === 'number' && typeof r.lng === 'number');

			return json(alerts, {
				headers: { 'Cache-Control': 'public, max-age=60' }
			});
		} catch (e) {
			lastError = e instanceof Error ? e.message : String(e);
		}
	}

	return error(502, `All Waze endpoints failed: ${lastError}`);
};
