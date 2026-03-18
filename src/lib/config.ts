export const PROTOMAPS_API_KEY = '9a3b40d05d41740c';

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
