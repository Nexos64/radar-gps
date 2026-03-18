/**
 * Alert engine — détecte les radars à proximité
 *
 * Logique simplifiée :
 * 1. Alerte toujours dans les deux sens, quelle que soit l'orientation du radar
 * 2. Zones de silence après passage d'un radar (30s)
 * 3. Dédoublonnage spatial : si deux radars sont < 100m, alerter qu'une seule fois
 * 4. Pas de ré-alerte sonore pour un même radar pendant 10s
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

const DEDUP_DISTANCE_M = 100;

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
 *
 * Alerte toujours dans les deux sens. Dédoublonne les radars
 * proches (< 100m) pour éviter les doubles alertes.
 */
export function evaluateAlerts(pos: GpsPosition, radars: Radar[]): void {
	cleanSilenced();
	alertedPositions.length = 0;

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
			silencedRadars.set(radar.id, now);
			continue;
		}

		// ── Skip si en zone de silence ──
		if (silencedRadars.has(radar.id)) continue;

		// ── Skip si hors du rayon d'alerte ──
		if (dist > alertRadius) continue;

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
}
