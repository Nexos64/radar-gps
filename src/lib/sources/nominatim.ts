/**
 * Nominatim geocoding service — autocomplétion d'adresses
 *
 * Respecte les conditions d'utilisation :
 * - max 1 requête/seconde (debounce géré côté composant)
 * - User-Agent identifié
 * - Résultats limités à FR + CH + DE
 */

export interface NominatimResult {
	placeId: number;
	lat: number;
	lng: number;
	displayName: string;
	type: string;
	/** Nom court (première partie de display_name) */
	label: string;
	/** Détail (le reste de display_name) */
	detail: string;
}

const BASE_URL = 'https://nominatim.openstreetmap.org';
const COUNTRY_CODES = 'fr,ch,de';

export async function searchNominatim(query: string, limit = 5): Promise<NominatimResult[]> {
	if (!query || query.trim().length < 2) return [];

	const params = new URLSearchParams({
		q: query.trim(),
		format: 'jsonv2',
		addressdetails: '1',
		limit: String(limit),
		countrycodes: COUNTRY_CODES,
		'accept-language': 'fr'
	});

	const res = await fetch(`${BASE_URL}/search?${params}`, {
		headers: {
			'User-Agent': 'RadarGPS-PWA/1.0 (https://github.com/Nexos64/radar-gps)'
		}
	});

	if (!res.ok) throw new Error(`Nominatim ${res.status}`);

	const data = await res.json();

	return data.map((item: any) => {
		const parts = (item.display_name as string).split(', ');
		const label = parts[0] || item.display_name;
		const detail = parts.slice(1, 4).join(', ');

		return {
			placeId: item.place_id,
			lat: parseFloat(item.lat),
			lng: parseFloat(item.lon),
			displayName: item.display_name,
			type: item.type,
			label,
			detail
		};
	});
}
