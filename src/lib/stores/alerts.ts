/**
 * Alert engine — détecte les radars à proximité selon la trajectoire GPS
 *
 * Logique :
 * 1. Pour chaque radar dans le rayon d'alerte (fonction de la vitesse) :
 *    - Si le radar est bidirectionnel ou sans angle → alerte toujours
 *    - Sinon : alerte seulement si le cap GPS est proche de la direction du radar (±45°)
 * 2. Zones de silence : après avoir dépassé un radar, pas d'alerte pendant 30s
 * 3. Pas de ré-alerte sonore pour un même radar pendant 10s
 */

import { writable, get } from 'svelte/store';
import type { Radar } from '$lib/types';
import type { GpsPosition } from '$lib/stores/gps';
import {
	alertDistanceForSpeed,
	HEADING_TOLERANCE_DEG,
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

/** Bearing from point A to point B (degrees, 0 = north) */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const la1 = lat1 * Math.PI / 180;
	const la2 = lat2 * Math.PI / 180;
	const y = Math.sin(dLng) * Math.cos(la2);
	const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
	return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

/** Angle difference, normalized to 0–180 */
function angleDiff(a: number, b: number): number {
	let d = Math.abs(a - b) % 360;
	if (d > 180) d = 360 - d;
	return d;
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
 * Appelé depuis le composant Map à chaque mise à jour de position.
 */
export function evaluateAlerts(pos: GpsPosition, radars: Radar[]): void {
	cleanSilenced();

	const now = Date.now();
	const speedKmh = (pos.speed ?? 0) * 3.6;
	const alertRadius = alertDistanceForSpeed(speedKmh);

	let closest: RadarAlert | null = null;

	for (const radar of radars) {
		const dist = haversineM(pos.lat, pos.lng, radar.lat, radar.lng);

		// ── Détection de passage (distance augmente après avoir été < seuil) ──
		const prevDist = prevDistances.get(radar.id);
		prevDistances.set(radar.id, dist);

		if (prevDist !== undefined && prevDist <= RADAR_PASSED_DISTANCE_M && dist > RADAR_PASSED_DISTANCE_M) {
			// On vient de passer ce radar → zone de silence
			silencedRadars.set(radar.id, now);
			continue;
		}

		// ── Skip si en zone de silence ──
		if (silencedRadars.has(radar.id)) continue;

		// ── Skip si hors du rayon d'alerte ──
		if (dist > alertRadius) continue;

		// ── Filtre de trajectoire ──
		if (!shouldAlert(pos, radar)) continue;

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

/**
 * Détermine si on doit alerter pour ce radar selon le cap GPS.
 *
 * - Radar bidirectionnel ou sans angle → toujours alerter
 * - Sinon : le cap GPS doit être dans ±HEADING_TOLERANCE de la direction du radar
 *   OU on se dirige vers le radar (bearing vers le radar ≈ cap GPS)
 */
function shouldAlert(pos: GpsPosition, radar: Radar): boolean {
	// Pas de cap GPS fiable (à l'arrêt) → alerter si proche
	if (pos.heading == null || pos.speed == null || pos.speed < 1) return true;

	// Radar bidirectionnel ou sans direction → alerter dans les deux sens
	if (radar.bidirectional || radar.angle == null) return true;

	// Le cap GPS doit être cohérent avec la direction du radar
	// = on roule dans le même sens que ce que le radar surveille
	if (angleDiff(pos.heading, radar.angle) <= HEADING_TOLERANCE_DEG) return true;

	// Dernier check : on se dirige vers le radar ?
	const bearingToRadar = bearingDeg(pos.lat, pos.lng, radar.lat, radar.lng);
	if (angleDiff(pos.heading, bearingToRadar) <= HEADING_TOLERANCE_DEG) return true;

	return false;
}

/** Reset all alert state (on GPS stop, etc.) */
export function resetAlerts(): void {
	activeAlert.set(null);
	lastSoundAt.clear();
	silencedRadars.clear();
	prevDistances.clear();
}
