import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ROW (Rest Of World) real-time server — works for Europe (FR/CH/DE)
const WAZE_URL = 'https://www.waze.com/row-rtserver/web/TGeoRSS';
const ALLOWED_TYPES = new Set(['POLICE', 'HAZARD']);

export const GET: RequestHandler = async ({ url }) => {
	const top = url.searchParams.get('top');
	const bottom = url.searchParams.get('bottom');
	const left = url.searchParams.get('left');
	const right = url.searchParams.get('right');

	if (!top || !bottom || !left || !right) {
		return error(400, 'Missing bbox params: top, bottom, left, right');
	}

	const wazeUrl = `${WAZE_URL}?bottom=${bottom}&top=${top}&left=${left}&right=${right}&ma=600&mu=0&types=alerts`;

	const res = await fetch(wazeUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Referer': 'https://www.waze.com/live-map',
			'Accept': 'application/json',
			'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
		}
	});

	if (!res.ok) {
		return error(502, `Waze returned ${res.status}`);
	}

	const data = await res.json();
	const alerts = (data.alerts || [])
		.filter((a: any) => ALLOWED_TYPES.has(a.type))
		.map((a: any) => ({
			id: `waze-${a.uuid}`,
			lat: a.location.y,
			lng: a.location.x,
			type: a.type === 'POLICE' ? 'police' : 'other',
			subtype: a.subtype || null,
			speedLimit: null,
			angle: null,
			bidirectional: true,
			source: 'waze' as const,
			confidence: a.confidence ?? 0,
			nThumbsUp: a.nThumbsUp ?? 0,
			reportedAt: a.pubMillis
		}));

	return json(alerts, {
		headers: {
			'Cache-Control': 'public, max-age=60'
		}
	});
};
