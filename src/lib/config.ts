export const PROTOMAPS_API_KEY = '9a3b40d05d41740c';
export const TOMTOM_API_KEY = 'fb4aWBVq9tSHrJfAJYXKfSSQF2IqpF7s';

export const MAP_CENTER: [number, number] = [6.63, 46.54]; // Lausanne
export const MAP_ZOOM = 10;

// Bounding box couvrant FR + CH + DE
export const BBOX = {
	south: 41.3,  // sud de la France
	north: 55.1,  // nord de l'Allemagne
	west: -5.2,   // ouest de la France
	east: 15.1    // est de l'Allemagne
};

export const TTL = {
	LUFTOP: 4 * 24 * 60 * 60 * 1000,  // 4 jours
	OSM: 24 * 60 * 60 * 1000,          // 1 jour
	WAZE: 5 * 60 * 1000                 // 5 minutes
};

export const RADAR_VIEW_RADIUS_M = 15_000; // 15 km

// ── Alert engine ──
/** Distance d'alerte en fonction de la vitesse (km/h → mètres) */
export function alertDistanceForSpeed(kmh: number): number {
	if (kmh <= 50) return 300;
	if (kmh <= 90) return 600;
	if (kmh <= 110) return 800;
	return 1000;
}

/** Distance en dessous de laquelle on considère le radar "passé" */
export const RADAR_PASSED_DISTANCE_M = 50;

/** Durée de silence après passage d'un radar (ms) */
export const SILENCE_AFTER_PASS_MS = 30_000; // 30 secondes

/** Intervalle minimum entre deux alertes sonores pour le même radar (ms) */
export const ALERT_REPEAT_INTERVAL_MS = 10_000; // 10 secondes

// ── Free navigation tilt ──
/** Vitesse minimale (m/s) pour activer le tilt en navigation libre */
export const FREE_TILT_SPEED_MS = 2.8; // ~10 km/h
export const FREE_TILT_PITCH = 45; // degrees
