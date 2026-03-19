/**
 * Navigation store — gère l'état de navigation
 *
 * - Calcul d'itinéraire via TomTom (traffic-aware) + fallback OSRM
 * - Comptage des radars dans un corridor autour de l'itinéraire
 * - Suivi turn-by-turn en temps réel
 * - Effacement progressif du tracé derrière l'utilisateur
 * - Recalcul automatique si hors route
 */

import { writable, derived, get } from 'svelte/store';
import type { Radar } from '$lib/types';
import type { GpsPosition } from '$lib/stores/gps';
import { calculateRoute, type Route, type RouteStep } from '$lib/sources/osrm';
import { getAllRadars } from '$lib/stores/radardb';
import { getSettings } from '$lib/stores/settings';
import { addToHistory } from '$lib/stores/history';
import { destination } from '$lib/stores/destination';
import { logError } from '$lib/stores/errorlog';

// ── Types ──

/** Types de radars de vitesse (excluant les radars feu rouge) */
const SPEED_RADAR_TYPES = new Set(['fixed', 'mobile', 'section_start', 'section_end', 'police', 'other']);

export type NavState = 'idle' | 'preview' | 'navigating';

export interface NavInfo {
	state: NavState;
	route: Route | null;
	/** Radars de vitesse dans le corridor de l'itinéraire */
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
	/** Index dans route.geometry du point le plus proche de l'utilisateur */
	trimIndex: number;
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
	etaTimestamp: 0,
	trimIndex: 0
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

const ROUTE_CORRIDOR_M = 100;
const STEP_REACHED_M = 40;
const OFF_ROUTE_M = 100;

// Reroute cooldown to avoid spam
let lastRerouteTime = 0;
const REROUTE_COOLDOWN_MS = 15_000;
let isRerouting = false;

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

function distanceToPolyline(lat: number, lng: number, polyline: [number, number][]): number {
	let minDist = Infinity;
	for (let i = 0; i < polyline.length - 1; i++) {
		const d = distanceToSegment(
			lat, lng,
			polyline[i][1], polyline[i][0],
			polyline[i + 1][1], polyline[i + 1][0]
		);
		if (d < minDist) minDist = d;
	}
	return minDist;
}

function distanceToSegment(
	pLat: number, pLng: number,
	aLat: number, aLng: number,
	bLat: number, bLng: number
): number {
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

/**
 * Find the index of the closest point in the geometry to the user position.
 */
function findClosestGeometryIndex(lat: number, lng: number, geometry: [number, number][], startFrom: number = 0): number {
	let minDist = Infinity;
	let minIdx = startFrom;

	// Search forward from current position (+ some lookback for tolerance)
	const searchStart = Math.max(0, startFrom - 5);
	const searchEnd = Math.min(geometry.length, startFrom + 200); // Don't search too far ahead

	for (let i = searchStart; i < searchEnd; i++) {
		const d = haversineM(lat, lng, geometry[i][1], geometry[i][0]);
		if (d < minDist) {
			minDist = d;
			minIdx = i;
		}
	}
	return minIdx;
}

// ── Comptage des radars sur l'itinéraire ──

async function countRadarsOnRoute(route: Route): Promise<Radar[]> {
	const allRadars = await getAllRadars();
	return allRadars.filter((r) =>
		SPEED_RADAR_TYPES.has(r.type) &&
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
		etaTimestamp: Date.now() + route.durationS * 1000,
		trimIndex: 0
	});
	console.log(`[nav] Route: ${(route.distanceM / 1000).toFixed(1)} km, ${route.steps.length} steps, ${radarsOnRoute.length} radars`);
}

// ── API publique ──

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

		if (appSettings.radarFreeRoute && radarsOnRoute.length > 0) {
			try {
				const altRoute = await calculateRoute(fromLat, fromLng, toLat, toLng, { avoidHighways: true });
				const altRadars = await countRadarsOnRoute(altRoute);
				if (altRadars.length < radarsOnRoute.length) {
					console.log(`[nav] Radar-free: switching to alt route (${altRadars.length} vs ${radarsOnRoute.length} radars)`);
					return computeRouteWithData(altRoute, altRadars);
				}
			} catch {
				// Fallback to original route
			}
		}

		computeRouteWithData(route, radarsOnRoute);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[nav] Route calculation failed:', e);
		logError('navigation', msg);
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

	const dest = get(destination);
	if (dest) {
		addToHistory(dest.label, dest.detail, dest.lat, dest.lng);
	}

	navInfo.update((n) => ({ ...n, state: 'navigating' }));
	navStartTick.update((n) => n + 1);
}

/** Arrêter la navigation et revenir à idle */
export function stopNavigation(): void {
	navInfo.set(IDLE_NAV);
	isRerouting = false;
}

/**
 * Mise à jour de la position GPS pendant la navigation.
 * Calcule la distance au prochain step, avance les steps, et met à jour le trimIndex.
 */
export function updateNavPosition(pos: GpsPosition): void {
	const current = get(navInfo);
	if (current.state !== 'navigating' || !current.route) return;

	const { route } = current;
	let stepIdx = current.currentStepIndex;

	// Advance steps
	while (stepIdx < route.steps.length - 1) {
		const step = route.steps[stepIdx + 1];
		const distToStep = haversineM(pos.lat, pos.lng, step.location[1], step.location[0]);

		if (distToStep < STEP_REACHED_M) {
			stepIdx++;
		} else {
			break;
		}
	}

	// Update trim index (progressive route erasure)
	const trimIndex = findClosestGeometryIndex(pos.lat, pos.lng, route.geometry, current.trimIndex);

	// Distance au prochain step
	let distToNext = 0;
	if (stepIdx < route.steps.length - 1) {
		const next = route.steps[stepIdx + 1];
		distToNext = haversineM(pos.lat, pos.lng, next.location[1], next.location[0]);
	}

	// Distance restante
	let distRemaining = distToNext;
	for (let i = stepIdx + 1; i < route.steps.length; i++) {
		distRemaining += route.steps[i].distanceM;
	}

	// Estimate remaining duration based on distance ratio + current speed
	const ratio = route.distanceM > 0 ? distRemaining / route.distanceM : 0;
	let durRemaining: number;
	if (pos.speed != null && pos.speed > 1) {
		// Blend: average between proportional ETA and speed-based ETA
		const speedBasedS = distRemaining / pos.speed;
		const proportionalS = route.durationS * ratio;
		durRemaining = (speedBasedS + proportionalS) / 2;
	} else {
		durRemaining = route.durationS * ratio;
	}

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
		etaTimestamp: Date.now() + durRemaining * 1000,
		trimIndex
	});
}

/** Obtenir les radars de vitesse sur l'itinéraire */
export function getRouteRadars(): Radar[] {
	return get(navInfo).radarsOnRoute;
}

/** Obtenir la géométrie restante de l'itinéraire (après trimIndex) */
export function getRemainingGeometry(): [number, number][] {
	const current = get(navInfo);
	if (!current.route) return [];
	return current.route.geometry.slice(current.trimIndex);
}

/** Vérifie si l'utilisateur est hors route */
export function isOffRoute(pos: GpsPosition): boolean {
	const current = get(navInfo);
	if (!current.route) return false;
	return distanceToPolyline(pos.lat, pos.lng, current.route.geometry) > OFF_ROUTE_M;
}

/**
 * Recalculate route from current position when user goes off-route.
 * Debounced with a cooldown to avoid spam.
 */
export async function rerouteFromPosition(pos: GpsPosition): Promise<void> {
	const now = Date.now();
	if (isRerouting || now - lastRerouteTime < REROUTE_COOLDOWN_MS) return;

	const dest = get(destination);
	if (!dest) return;

	isRerouting = true;
	lastRerouteTime = now;
	console.log('[nav] Off-route detected — recalculating...');

	try {
		const appSettings = getSettings();
		const route = await calculateRoute(pos.lat, pos.lng, dest.lat, dest.lng, {
			avoidHighways: appSettings.avoidHighways
		});

		const radarsOnRoute = await countRadarsOnRoute(route);

		navInfo.set({
			state: 'navigating',
			route,
			radarsOnRoute,
			currentStepIndex: 0,
			distanceToNextStep: route.steps[0]?.distanceM ?? 0,
			distanceRemaining: route.distanceM,
			durationRemaining: route.durationS,
			etaTimestamp: Date.now() + route.durationS * 1000,
			trimIndex: 0
		});

		console.log(`[nav] Rerouted: ${(route.distanceM / 1000).toFixed(1)} km, ${radarsOnRoute.length} radars`);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		logError('navigation/reroute', msg);
	} finally {
		isRerouting = false;
	}
}
