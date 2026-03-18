/**
 * OSRM routing service — calcul d'itinéraire
 *
 * Utilise le serveur public OSRM (router.project-osrm.org).
 * Retourne la géométrie, la durée, la distance et les instructions turn-by-turn.
 */

export interface RouteStep {
	/** Instruction textuelle */
	instruction: string;
	/** Manoeuvre type (turn, depart, arrive, etc.) */
	maneuver: string;
	/** Modificateur de direction (left, right, straight, etc.) */
	modifier: string | null;
	/** Distance de ce segment en mètres */
	distanceM: number;
	/** Durée de ce segment en secondes */
	durationS: number;
	/** Nom de la route */
	name: string;
	/** Coordonnée du point de manoeuvre [lng, lat] */
	location: [number, number];
}

export interface Route {
	/** Coordonnées du tracé [[lng,lat], ...] */
	geometry: [number, number][];
	/** Distance totale en mètres */
	distanceM: number;
	/** Durée totale en secondes */
	durationS: number;
	/** Instructions pas-à-pas */
	steps: RouteStep[];
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

function decodePolyline6(encoded: string): [number, number][] {
	const coords: [number, number][] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;

	while (index < encoded.length) {
		let shift = 0;
		let result = 0;
		let byte: number;

		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;

		shift = 0;
		result = 0;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;

		coords.push([lng / 1e6, lat / 1e6]);
	}

	return coords;
}

const MANEUVER_LABELS: Record<string, string> = {
	'depart': 'Départ',
	'arrive': 'Arrivée',
	'turn': 'Tourner',
	'new name': 'Continuer sur',
	'merge': 'Rejoindre',
	'on ramp': 'Prendre la bretelle',
	'off ramp': 'Sortir',
	'fork': 'Bifurquer',
	'end of road': 'Fin de route',
	'continue': 'Continuer',
	'roundabout': 'Rond-point',
	'rotary': 'Rond-point',
	'roundabout turn': 'Rond-point',
	'notification': '',
	'exit roundabout': 'Sortir du rond-point',
	'exit rotary': 'Sortir du rond-point'
};

const MODIFIER_LABELS: Record<string, string> = {
	'uturn': 'Demi-tour',
	'sharp right': 'à droite (serré)',
	'right': 'à droite',
	'slight right': 'légèrement à droite',
	'straight': 'tout droit',
	'slight left': 'légèrement à gauche',
	'left': 'à gauche',
	'sharp left': 'à gauche (serré)'
};

function buildInstruction(maneuver: string, modifier: string | null, name: string): string {
	if (maneuver === 'depart') return name ? `Départ sur ${name}` : 'Départ';
	if (maneuver === 'arrive') return 'Vous êtes arrivé';

	const action = MANEUVER_LABELS[maneuver] || 'Continuer';
	const dir = modifier ? MODIFIER_LABELS[modifier] || modifier : '';

	if (maneuver === 'new name' || maneuver === 'continue') {
		return name ? `${action} ${name}` : `${action} ${dir}`.trim();
	}

	if (maneuver === 'roundabout' || maneuver === 'rotary') {
		return name ? `Rond-point, sortir sur ${name}` : 'Rond-point';
	}

	const parts = [action, dir].filter(Boolean).join(' ');
	return name ? `${parts}, ${name}` : parts;
}

export async function calculateRoute(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number
): Promise<Route> {
	const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}` +
		`?overview=full&geometries=polyline6&steps=true&annotations=false`;

	const res = await fetch(url);
	if (!res.ok) throw new Error(`OSRM ${res.status}`);

	const data = await res.json();
	if (data.code !== 'Ok' || !data.routes?.length) {
		throw new Error(`OSRM: ${data.code || 'no route'}`);
	}

	const route = data.routes[0];
	const geometry = decodePolyline6(route.geometry);

	const steps: RouteStep[] = [];
	for (const leg of route.legs) {
		for (const step of leg.steps) {
			const m = step.maneuver;
			steps.push({
				instruction: buildInstruction(m.type, m.modifier || null, step.name || ''),
				maneuver: m.type,
				modifier: m.modifier || null,
				distanceM: step.distance,
				durationS: step.duration,
				name: step.name || '',
				location: [m.location[0], m.location[1]]
			});
		}
	}

	return {
		geometry,
		distanceM: route.distance,
		durationS: route.duration,
		steps
	};
}
