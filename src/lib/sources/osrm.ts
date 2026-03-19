/**
 * Routing service — TomTom Routing API (traffic-aware) with OSRM fallback
 *
 * TomTom provides real-time traffic consideration.
 * OSRM public server is used as fallback.
 */

import { TOMTOM_API_KEY } from '$lib/config';

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

export interface RouteOptions {
	avoidHighways?: boolean;
}

// ── TomTom Routing ──

const TOMTOM_MANEUVER_MAP: Record<string, { maneuver: string; modifier: string | null }> = {
	'DEPART': { maneuver: 'depart', modifier: null },
	'ARRIVE': { maneuver: 'arrive', modifier: null },
	'ARRIVE_LEFT': { maneuver: 'arrive', modifier: 'left' },
	'ARRIVE_RIGHT': { maneuver: 'arrive', modifier: 'right' },
	'TURN_LEFT': { maneuver: 'turn', modifier: 'left' },
	'TURN_RIGHT': { maneuver: 'turn', modifier: 'right' },
	'SHARP_LEFT': { maneuver: 'turn', modifier: 'sharp left' },
	'SHARP_RIGHT': { maneuver: 'turn', modifier: 'sharp right' },
	'BEAR_LEFT': { maneuver: 'turn', modifier: 'slight left' },
	'BEAR_RIGHT': { maneuver: 'turn', modifier: 'slight right' },
	'KEEP_LEFT': { maneuver: 'fork', modifier: 'slight left' },
	'KEEP_RIGHT': { maneuver: 'fork', modifier: 'slight right' },
	'STRAIGHT': { maneuver: 'continue', modifier: 'straight' },
	'FOLLOW': { maneuver: 'new name', modifier: 'straight' },
	'ENTER_MOTORWAY': { maneuver: 'on ramp', modifier: null },
	'EXIT_MOTORWAY': { maneuver: 'off ramp', modifier: null },
	'MOTORWAY_EXIT_LEFT': { maneuver: 'off ramp', modifier: 'left' },
	'MOTORWAY_EXIT_RIGHT': { maneuver: 'off ramp', modifier: 'right' },
	'TAKE_EXIT': { maneuver: 'off ramp', modifier: null },
	'ROUNDABOUT_CROSS': { maneuver: 'roundabout', modifier: 'straight' },
	'ROUNDABOUT_LEFT': { maneuver: 'roundabout', modifier: 'left' },
	'ROUNDABOUT_RIGHT': { maneuver: 'roundabout', modifier: 'right' },
	'ROUNDABOUT_BACK': { maneuver: 'roundabout', modifier: 'uturn' },
	'TRY_MAKE_UTURN': { maneuver: 'turn', modifier: 'uturn' },
	'MAKE_UTURN': { maneuver: 'turn', modifier: 'uturn' },
	'ENTER_FREEWAY': { maneuver: 'on ramp', modifier: null },
	'ENTER_HIGHWAY': { maneuver: 'on ramp', modifier: null },
	'WAYPOINT_LEFT': { maneuver: 'continue', modifier: 'left' },
	'WAYPOINT_RIGHT': { maneuver: 'continue', modifier: 'right' },
	'WAYPOINT_REACHED': { maneuver: 'continue', modifier: 'straight' },
};

async function calculateTomTomRoute(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
	options: RouteOptions
): Promise<Route> {
	let url = `https://api.tomtom.com/routing/1/calculateRoute/${fromLat},${fromLng}:${toLat},${toLng}/json` +
		`?key=${TOMTOM_API_KEY}` +
		`&traffic=true` +
		`&travelMode=car` +
		`&routeType=fastest` +
		`&instructionsType=text` +
		`&language=fr-FR` +
		`&computeTravelTimeFor=all`;

	if (options.avoidHighways) {
		url += '&avoid=motorways';
	}

	const res = await fetch(url);
	if (!res.ok) throw new Error(`TomTom Routing ${res.status}`);

	const data = await res.json();
	if (!data.routes?.length) throw new Error('TomTom: no route');

	const route = data.routes[0];
	const summary = route.summary;

	// Build geometry from leg points
	const geometry: [number, number][] = [];
	for (const leg of route.legs) {
		for (const pt of leg.points) {
			geometry.push([pt.longitude, pt.latitude]);
		}
	}

	// Build steps from guidance instructions
	const steps: RouteStep[] = [];
	const instructions = route.guidance?.instructions || [];

	for (let i = 0; i < instructions.length; i++) {
		const inst = instructions[i];
		const mapped = TOMTOM_MANEUVER_MAP[inst.maneuver] || { maneuver: 'continue', modifier: 'straight' };

		// Distance for this step = offset to next instruction - offset of this one
		const nextOffset = instructions[i + 1]?.routeOffsetInMeters ?? summary.lengthInMeters;
		const stepDistance = nextOffset - (inst.routeOffsetInMeters || 0);

		// Duration estimate proportional to distance
		const ratio = summary.lengthInMeters > 0 ? stepDistance / summary.lengthInMeters : 0;
		const stepDuration = summary.travelTimeInSeconds * ratio;

		steps.push({
			instruction: inst.message || inst.street || 'Continuer',
			maneuver: mapped.maneuver,
			modifier: mapped.modifier,
			distanceM: stepDistance,
			durationS: stepDuration,
			name: inst.street || '',
			location: [inst.point.longitude, inst.point.latitude]
		});
	}

	// Ensure at least a depart step
	if (steps.length === 0) {
		steps.push({
			instruction: 'Départ',
			maneuver: 'depart',
			modifier: null,
			distanceM: summary.lengthInMeters,
			durationS: summary.travelTimeInSeconds,
			name: '',
			location: geometry[0] || [fromLng, fromLat]
		});
	}

	return {
		geometry,
		distanceM: summary.lengthInMeters,
		durationS: summary.travelTimeInSeconds,
		steps
	};
}

// ── OSRM Fallback ──

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

async function calculateOsrmRoute(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
	options: RouteOptions
): Promise<Route> {
	let url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}` +
		`?overview=full&geometries=polyline6&steps=true&annotations=false`;

	if (options.avoidHighways) {
		url += '&exclude=motorway';
	}

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

// ── Public API ──

/**
 * Calculate a route with traffic awareness.
 * Uses TomTom (traffic-aware) with OSRM as fallback.
 */
export async function calculateRoute(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
	options: RouteOptions = {}
): Promise<Route> {
	// Try TomTom first (traffic-aware)
	try {
		return await calculateTomTomRoute(fromLat, fromLng, toLat, toLng, options);
	} catch (e) {
		console.warn('[routing] TomTom failed, falling back to OSRM:', e);
	}

	// Fallback to OSRM (no traffic)
	return calculateOsrmRoute(fromLat, fromLng, toLat, toLng, options);
}
