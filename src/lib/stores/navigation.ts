/**
 * Navigation store — gère l'état de navigation
 *
 * - Calcul d'itinéraire via OSRM
 * - Comptage des radars dans un corridor autour de l'itinéraire
 * - Suivi turn-by-turn en temps réel
 * - Intégration avec le moteur d'alertes (radars sur le trajet uniquement)
 */

import { writable, derived, get } from 'svelte/store';
import type { Radar } from '$lib/types';
import type { GpsPosition } from '$lib/stores/gps';
import { calculateRoute, type Route, type RouteStep } from '$lib/sources/osrm';
import { getAllRadars } from '$lib/stores/radardb';
import { getSettings } from '$lib/stores/settings';
import { addToHistory } from '$lib/stores/history';
import { destination } from '$lib/stores/destination';

// ── Types ──

export type NavState = 'idle' | 'preview' | 'navigating';

export interface NavInfo {
	state: NavState;
	route: Route | null;
	/** Radars dans le corridor de l'itinéraire */
	radarsOnRoute: Radar[];
	/** Index de l'étape courante dans route.steps */
	currentStepIndex: number;
	/** Distance restante jusqu'à la prochaine manoeuvre (m) */
	distanceToNextStep: number;
	/** Distance totale restante (m) */
	distanceRemaining: number;
	/** Durée estimée restante (s) */
	durationRemaining: number;
	/** Heure d'arrivée estimée (timestamp ms) */
	etaTimestamp: number;
}

// ── Stores ──

const IDLE_NAV: NavInfo = {
	state: 'idle',
	route: null,
	radarsOnRoute: [],
	currentStepIndex: 0,
	distanceToNextStep: 0,
	distanceRemaining: 0,
	durationRemaining: 0,
	etaTimestamp: 0
};

export const navInfo = writable<NavInfo>(IDLE_NAV);

export const navLoading = writable(false);

// ── Derived ──

export const isNavigating = derived(navInfo, ($n) => $n.state === 'navigating');
export const isPreview = derived(navInfo, ($n) => $n.state === 'preview');
export const currentStep = derived(navInfo, ($n) => {
	if (!$n.route || $n.currentStepIndex >= $n.route.steps.length) return null;
	return $n.route.steps[$n.currentStepIndex];
});
export const nextStep = derived(navInfo, ($n) => {
	if (!$n.route || $n.currentStepIndex + 1 >= $n.route.steps.length) return null;
	return $n.route.steps[$n.currentStepIndex + 1];
});

// ── Constantes ──

/** Largeur du corridor pour compter les radars (mètres de chaque côté de l'itinéraire) */
const ROUTE_CORRIDOR_M = 100;

/** Distance seuil pour considérer qu'on a atteint un waypoint (m) */
const STEP_REACHED_M = 40;

/** Distance seuil pour considérer qu'on est hors route (m) */
const OFF_ROUTE_M = 100;

// ── Fonctions utilitaires ──

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6_371_000;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distance minimale d'un point à un segment de polyligne.
 * Retourne la distance en mètres depuis le point au segment le plus proche.
 */
function distanceToPolyline(lat: number, lng: number, polyline: [number, number][]): number {
	let minDist = Infinity;
	for (let i = 0; i < polyline.length - 1; i++) {
		const d = distanceToSegment(
			lat, lng,
			polyline[i][1], polyline[i][0],     // [lng,lat] → lat,lng
			polyline[i + 1][1], polyline[i + 1][0]
		);
		if (d < minDist) minDist = d;
	}
	return minDist;
}

/**
 * Distance from point P to line segment AB (approximate, flat-earth for short distances)
 */
function distanceToSegment(
	pLat: number, pLng: number,
	aLat: number, aLng: number,
	bLat: number, bLng: number
): number {
	// Convert to approximate meters (flat-earth)
	const cosLat = Math.cos(pLat * Math.PI / 180);
	const px = (pLng - aLng) * cosLat;
	const py = pLat - aLat;
	const bx = (bLng - aLng) * cosLat;
	const by = bLat - aLat;

	const lenSq = bx * bx + by * by;
	if (lenSq === 0) {
		return haversineM(pLat, pLng, aLat, aLng);
	}

	let t = (px * bx + py * by) / lenSq;
	t = Math.max(0, Math.min(1, t));

	const projLng = aLng + t * (bLng - aLng);
	const projLat = aLat + t * (bLat - aLat);

	return haversineM(pLat, pLng, projLat, projLng);
}

// ── Comptage des radars sur l'itinéraire ──

async function countRadarsOnRoute(route: Route): Promise<Radar[]> {
	const allRadars = await getAllRadars();
	return allRadars.filter((r) =>
		distanceToPolyline(r.lat, r.lng, route.geometry) <= ROUTE_CORRIDOR_M
	);
}

// ── Helpers ──

function computeRouteWithData(route: Route, radarsOnRoute: Radar[]) {
	navInfo.set({
		state: 'preview',
		route,
		radarsOnRoute,
		currentStepIndex: 0,
		distanceToNextStep: route.steps[0]?.distanceM ?? 0,
		distanceRemaining: route.distanceM,
		durationRemaining: route.durationS,
		etaTimestamp: Date.now() + route.durationS * 1000
	});
	console.log(`[nav] Route: ${(route.distanceM / 1000).toFixed(1)} km, ${route.steps.length} steps, ${radarsOnRoute.length} radars`);
}

// ── API publique ──

/**
 * Calculer l'itinéraire et passer en mode preview.
 * Charge les radars le long de l'itinéraire.
 * Respecte les paramètres (avoid highways, radar-free) depuis settings.
 */
export async function computeRoute(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number
): Promise<void> {
	navLoading.set(true);

	try {
		const appSettings = getSettings();
		const route = await calculateRoute(fromLat, fromLng, toLat, toLng, {
			avoidHighways: appSettings.avoidHighways
		});

		let radarsOnRoute = await countRadarsOnRoute(route);

		// If radar-free route is enabled, try to find a route that avoids radars
		// For now, just flag the radars — full re-routing would need waypoints
		if (appSettings.radarFreeRoute && radarsOnRoute.length > 0) {
			// Try alternate route without highways (often avoids fixed radars)
			try {
				const altRoute = await calculateRoute(fromLat, fromLng, toLat, toLng, { avoidHighways: true });
				const altRadars = await countRadarsOnRoute(altRoute);
				if (altRadars.length < radarsOnRoute.length) {
					// Use the route with fewer radars
					console.log(`[nav] Radar-free: switching to alt route (${altRadars.length} vs ${radarsOnRoute.length} radars)`);
					return computeRouteWithData(altRoute, altRadars);
				}
			} catch {
				// Fallback to original route
			}
		}

		computeRouteWithData(route, radarsOnRoute);
	} catch (e) {
		console.error('[nav] Route calculation failed:', e);
		throw e;
	} finally {
		navLoading.set(false);
	}
}

/** Increments each time nav starts — Map.svelte watches this to recenter */
export const navStartTick = writable(0);

/** Passer du mode preview au mode navigation */
export function startNavigation(): void {
	const current = get(navInfo);
	if (current.state !== 'preview' || !current.route) return;

	// Save to route history
	const dest = get(destination);
	if (dest) {
		addToHistory(dest.label, dest.detail, dest.lat, dest.lng);
	}

	navInfo.update((n) => ({ ...n, state: 'navigating' }));
	// Signal Map to recenter on user position
	navStartTick.update((n) => n + 1);
}

/** Arrêter la navigation et revenir à idle */
export function stopNavigation(): void {
	navInfo.set(IDLE_NAV);
}

/**
 * Mise à jour de la position GPS pendant la navigation.
 * Calcule la distance au prochain step et avance les steps.
 */
export function updateNavPosition(pos: GpsPosition): void {
	const current = get(navInfo);
	if (current.state !== 'navigating' || !current.route) return;

	const { route } = current;
	let stepIdx = current.currentStepIndex;

	// Vérifier si on a atteint le step courant
	while (stepIdx < route.steps.length - 1) {
		const step = route.steps[stepIdx + 1]; // prochain waypoint
		const distToStep = haversineM(pos.lat, pos.lng, step.location[1], step.location[0]);

		if (distToStep < STEP_REACHED_M) {
			stepIdx++;
		} else {
			break;
		}
	}

	// Distance au prochain step
	let distToNext = 0;
	if (stepIdx < route.steps.length - 1) {
		const next = route.steps[stepIdx + 1];
		distToNext = haversineM(pos.lat, pos.lng, next.location[1], next.location[0]);
	}

	// Distance restante (approximation : somme des distances des steps restants)
	let distRemaining = distToNext;
	for (let i = stepIdx + 1; i < route.steps.length; i++) {
		distRemaining += route.steps[i].distanceM;
	}

	// Durée restante (approximation proportionnelle)
	const ratio = route.distanceM > 0 ? distRemaining / route.distanceM : 0;
	const durRemaining = route.durationS * ratio;

	// Arrivée ?
	if (stepIdx >= route.steps.length - 1 && distToNext < STEP_REACHED_M) {
		stopNavigation();
		return;
	}

	navInfo.set({
		state: 'navigating',
		route,
		radarsOnRoute: current.radarsOnRoute,
		currentStepIndex: stepIdx,
		distanceToNextStep: distToNext,
		distanceRemaining: distRemaining,
		durationRemaining: durRemaining,
		etaTimestamp: Date.now() + durRemaining * 1000
	});
}

/**
 * Obtenir les radars sur l'itinéraire (pour le moteur d'alertes).
 * En mode navigation, on filtre les alertes aux radars du trajet uniquement.
 */
export function getRouteRadars(): Radar[] {
	return get(navInfo).radarsOnRoute;
}

/** Vérifie si l'utilisateur est hors route */
export function isOffRoute(pos: GpsPosition): boolean {
	const current = get(navInfo);
	if (!current.route) return false;
	return distanceToPolyline(pos.lat, pos.lng, current.route.geometry) > OFF_ROUTE_M;
}
