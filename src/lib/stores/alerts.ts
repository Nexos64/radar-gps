/**
 * Alert engine — détecte les radars à proximité
 *
 * Logique :
 * 1. Navigation : alerter uniquement les radars dans le corridor de l'itinéraire
 * 2. Navigation libre : alerter avec filtre angulaire ±25° + protection tournant
 * 3. Zones de silence après passage d'un radar (30s)
 * 4. Dédoublonnage spatial : si deux radars sont < 100m, alerter qu'une seule fois
 * 5. Pas de ré-alerte sonore pour un même radar pendant 10s
 */

import { writable } from 'svelte/store';
import type { Radar } from '$lib/types';
import type { GpsPosition } from '$lib/stores/gps';
import {
	alertDistanceForSpeed,
	RADAR_PASSED_DISTANCE_M,
	SILENCE_AFTER_PASS_MS,
	ALERT_REPEAT_INTERVAL_MS
} from '$lib/config';

// ── Types ──

export interface RadarAlert {
	radar: Radar;
	distanceM: number;
	/** true = première alerte (déclenche son + vibration) */
	isNew: boolean;
}

// ── Stores ──

/** Radar le plus proche en alerte (null si aucun) */
export const activeAlert = writable<RadarAlert | null>(null);

// ── État interne ──

/** Timestamp de la dernière alerte sonore par radar id */
const lastSoundAt = new Map<string, number>();

/** Radars récemment passés → en zone de silence */
const silencedRadars = new Map<string, number>(); // id → timestamp de passage

/** Distance précédente par radar (pour détecter le passage) */
const prevDistances = new Map<string, number>();

/** Radars déjà alertés dans ce cycle (pour dédoublonnage spatial) */
const alertedPositions: { lat: number; lng: number }[] = [];

/** Recent headings for sharp turn detection (timestamp, heading) */
const headingHistory: { ts: number; heading: number }[] = [];
const HEADING_HISTORY_WINDOW_MS = 5000;

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

/** Calculate bearing from point A to point B in degrees (0-360) */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const lat1R = lat1 * Math.PI / 180;
	const lat2R = lat2 * Math.PI / 180;
	const y = Math.sin(dLng) * Math.cos(lat2R);
	const x = Math.cos(lat1R) * Math.sin(lat2R) -
		Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
	return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Angular difference between two angles in degrees (-180 to 180) */
function angleDiff(a: number, b: number): number {
	let diff = ((b - a + 180) % 360) - 180;
	if (diff < -180) diff += 360;
	return diff;
}

const DEDUP_DISTANCE_M = 100;
const FREE_MODE_ANGLE_DEG = 25; // ±25° cone in free mode

// ── Heading history management ──

function recordHeading(heading: number) {
	const now = Date.now();
	headingHistory.push({ ts: now, heading });
	// Purge old entries
	while (headingHistory.length > 0 && now - headingHistory[0].ts > HEADING_HISTORY_WINDOW_MS) {
		headingHistory.shift();
	}
}

/** Check if there was a sharp turn (>40°) in the recent heading history */
function hadSharpTurn(): boolean {
	if (headingHistory.length < 2) return false;
	for (let i = 1; i < headingHistory.length; i++) {
		const diff = Math.abs(angleDiff(headingHistory[i - 1].heading, headingHistory[i].heading));
		if (diff > 40) return true;
	}
	return false;
}

// ── Nettoyage des silences expirés ──

function cleanSilenced() {
	const now = Date.now();
	for (const [id, ts] of silencedRadars) {
		if (now - ts > SILENCE_AFTER_PASS_MS) {
			silencedRadars.delete(id);
			prevDistances.delete(id);
		}
	}
}

// ── Moteur principal ──

/**
 * Évalue les alertes à chaque tick GPS.
 *
 * @param pos Position GPS actuelle
 * @param radars Radars candidats (sur la route en navigation, tous en libre)
 * @param navigating true si en mode navigation
 * @param routeGeometry Géométrie de l'itinéraire (pour le filtre corridor en navigation)
 */
export function evaluateAlerts(
	pos: GpsPosition,
	radars: Radar[],
	navigating: boolean = false
): void {
	cleanSilenced();
	alertedPositions.length = 0;

	const now = Date.now();
	const speedKmh = (pos.speed ?? 0) * 3.6;
	const alertRadius = alertDistanceForSpeed(speedKmh);
	const hasHeading = pos.heading != null && pos.speed != null && pos.speed > 1;

	// Record heading for sharp turn detection
	if (hasHeading) {
		recordHeading(pos.heading!);
	}

	// In free mode with sharp recent turn, suppress alerts temporarily
	const sharpTurn = !navigating && hasHeading && hadSharpTurn();

	let closest: RadarAlert | null = null;

	for (const radar of radars) {
		const dist = haversineM(pos.lat, pos.lng, radar.lat, radar.lng);

		// ── Détection de passage (distance augmente après avoir été < seuil) ──
		const prevDist = prevDistances.get(radar.id);
		prevDistances.set(radar.id, dist);

		if (prevDist !== undefined && prevDist <= RADAR_PASSED_DISTANCE_M && dist > RADAR_PASSED_DISTANCE_M) {
			silencedRadars.set(radar.id, now);
			continue;
		}

		// ── Skip si en zone de silence ──
		if (silencedRadars.has(radar.id)) continue;

		// ── Skip si hors du rayon d'alerte ──
		if (dist > alertRadius) continue;

		// ── Angle filtering (free mode only) ──
		// In navigation mode, radars are already filtered to the route corridor
		// In free mode, only alert for radars roughly ahead (±25°)
		if (!navigating && hasHeading) {
			const bearing = bearingDeg(pos.lat, pos.lng, radar.lat, radar.lng);
			const diff = Math.abs(angleDiff(pos.heading!, bearing));
			if (diff > FREE_MODE_ANGLE_DEG) continue;

			// If there was a sharp turn recently, be even more conservative
			if (sharpTurn && diff > 15) continue;
		}

		// ── Dédoublonnage spatial : skip si un radar déjà alerté est < 100m ──
		const isDuplicate = alertedPositions.some(
			(p) => haversineM(p.lat, p.lng, radar.lat, radar.lng) < DEDUP_DISTANCE_M
		);
		if (isDuplicate) continue;

		// Marquer cette position comme alertée
		alertedPositions.push({ lat: radar.lat, lng: radar.lng });

		// ── Ce radar est en alerte — garder le plus proche ──
		if (!closest || dist < closest.distanceM) {
			const lastSound = lastSoundAt.get(radar.id) ?? 0;
			const isNew = (now - lastSound) > ALERT_REPEAT_INTERVAL_MS;

			closest = { radar, distanceM: dist, isNew };
		}
	}

	if (closest?.isNew) {
		lastSoundAt.set(closest.radar.id, now);
	}

	activeAlert.set(closest);
}

/** Reset all alert state (on GPS stop, etc.) */
export function resetAlerts(): void {
	activeAlert.set(null);
	lastSoundAt.clear();
	silencedRadars.clear();
	prevDistances.clear();
	alertedPositions.length = 0;
	headingHistory.length = 0;
}
