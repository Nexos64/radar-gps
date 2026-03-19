import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Waze proxy — fetches police alerts from Waze LiveMap.
 * Tries multiple endpoints and strategies for resilience.
 * Runs server-side on Cloudflare Pages Functions to bypass CORS.
 */

interface WazeEndpoint {
	url: (params: Record<string, string>) => string;
	parseAlerts: (data: any) => any[];
}

const ENDPOINTS: WazeEndpoint[] = [
	// Strategy 1: Waze LiveMap API v2
	{
		url: (p) => `https://www.waze.com/live-map/api/georss?top=${p.top}&bottom=${p.bottom}&left=${p.left}&right=${p.right}&env=row&types=alerts`,
		parseAlerts: (data) => data.alerts || []
	},
	// Strategy 2: Row GeoRSS server
	{
		url: (p) => `https://www.waze.com/row-rtserver/web/TGeoRSS?bottom=${p.bottom}&top=${p.top}&left=${p.left}&right=${p.right}&ma=600&mu=0&types=alerts`,
		parseAlerts: (data) => data.alerts || []
	},
	// Strategy 3: Row GeoRSS direct domain
	{
		url: (p) => `https://row-georss.waze.com/rtserver/web/TGeoRSS?bottom=${p.bottom}&top=${p.top}&left=${p.left}&right=${p.right}&ma=600&mu=0&types=alerts`,
		parseAlerts: (data) => data.alerts || []
	},
	// Strategy 4: World GeoRSS
	{
		url: (p) => `https://world-georss.waze.com/rtserver/web/TGeoRSS?bottom=${p.bottom}&top=${p.top}&left=${p.left}&right=${p.right}&ma=600&mu=0&types=alerts`,
		parseAlerts: (data) => data.alerts || []
	}
];

function getHeaders(): Record<string, string> {
	return {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
		'Referer': 'https://www.waze.com/live-map',
		'Origin': 'https://www.waze.com',
		'Accept': 'application/json, text/plain, */*',
		'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
		'X-Requested-With': 'XMLHttpRequest'
	};
}

function parsePoliceAlerts(rawAlerts: any[]): any[] {
	return rawAlerts
		.filter((a: any) => a.type === 'POLICE')
		.map((a: any) => ({
			id: `waze-${a.uuid || a.id || Math.random().toString(36).slice(2)}`,
			lat: a.location?.y ?? a.nThumbsUp != null ? a.location?.y : a.lat,
			lng: a.location?.x ?? a.lon ?? a.lng,
			type: 'police' as const,
			speedLimit: null,
			angle: null,
			bidirectional: true,
			source: 'waze' as const
		}))
		.filter((r: any) =>
			typeof r.lat === 'number' && typeof r.lng === 'number' &&
			!isNaN(r.lat) && !isNaN(r.lng)
		);
}

export const GET: RequestHandler = async ({ url }) => {
	const top = url.searchParams.get('top');
	const bottom = url.searchParams.get('bottom');
	const left = url.searchParams.get('left');
	const right = url.searchParams.get('right');

	if (!top || !bottom || !left || !right) {
		return error(400, 'Missing bbox params: top, bottom, left, right');
	}

	const params = { top, bottom, left, right };
	const headers = getHeaders();
	const errors: string[] = [];

	for (const endpoint of ENDPOINTS) {
		try {
			const fetchUrl = endpoint.url(params);
			const res = await fetch(fetchUrl, {
				headers,
				signal: AbortSignal.timeout(10000)
			});

			if (!res.ok) {
				errors.push(`${fetchUrl.split('?')[0]} → HTTP ${res.status}`);
				continue;
			}

			const data = await res.json();
			const rawAlerts = endpoint.parseAlerts(data);
			const alerts = parsePoliceAlerts(rawAlerts);

			console.log(`[Waze proxy] ${alerts.length} police alerts from ${fetchUrl.split('?')[0]}`);

			return json(alerts, {
				headers: {
					'Cache-Control': 'public, max-age=60',
					'Access-Control-Allow-Origin': '*'
				}
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push(`${endpoint.url(params).split('?')[0]} → ${msg}`);
		}
	}

	console.warn(`[Waze proxy] All endpoints failed:`, errors);

	// Return empty array instead of error to avoid flooding error logs
	return json([], {
		headers: {
			'Cache-Control': 'public, max-age=120',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
