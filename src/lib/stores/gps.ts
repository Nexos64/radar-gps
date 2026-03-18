import { writable, derived } from 'svelte/store';

export interface GpsPosition {
	lat: number;
	lng: number;
	accuracy: number;
	heading: number | null;
	speed: number | null; // m/s
	timestamp: number;
}

export type GpsSignal = 'strong' | 'weak' | 'lost' | 'off';

const MIN_DISTANCE_M = 5;
const THROTTLE_MS = 1000;
const LOST_TIMEOUT_MS = 10_000;
const WEAK_ACCURACY_M = 50;

export const position = writable<GpsPosition | null>(null);
export const gpsSignal = writable<GpsSignal>('off');

let watchId: number | null = null;
let lastUpdate = 0;
let lastPos: GpsPosition | null = null;
let lostTimer: ReturnType<typeof setTimeout> | null = null;

function distanceM(a: GpsPosition, b: GpsPosition): number {
	const R = 6_371_000;
	const dLat = (b.lat - a.lat) * Math.PI / 180;
	const dLng = (b.lng - a.lng) * Math.PI / 180;
	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const h = sinLat * sinLat +
		Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
	return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function resetLostTimer() {
	if (lostTimer) clearTimeout(lostTimer);
	lostTimer = setTimeout(() => gpsSignal.set('lost'), LOST_TIMEOUT_MS);
}

function onPosition(geo: GeolocationPosition) {
	const now = Date.now();
	if (now - lastUpdate < THROTTLE_MS) return;

	const pos: GpsPosition = {
		lat: geo.coords.latitude,
		lng: geo.coords.longitude,
		accuracy: geo.coords.accuracy,
		heading: geo.coords.heading,
		speed: geo.coords.speed,
		timestamp: geo.timestamp
	};

	if (lastPos && distanceM(lastPos, pos) < MIN_DISTANCE_M) return;

	lastUpdate = now;
	lastPos = pos;
	position.set(pos);
	gpsSignal.set(pos.accuracy <= WEAK_ACCURACY_M ? 'strong' : 'weak');
	resetLostTimer();
}

function onError(err: GeolocationPositionError) {
	console.warn('GPS error:', err.message);
	gpsSignal.set('lost');
}

export function startGps() {
	if (watchId !== null) return;
	if (!navigator.geolocation) {
		gpsSignal.set('lost');
		return;
	}

	gpsSignal.set('weak');
	resetLostTimer();

	watchId = navigator.geolocation.watchPosition(onPosition, onError, {
		enableHighAccuracy: true,
		maximumAge: 1000,
		timeout: 10_000
	});
}

export function stopGps() {
	if (watchId !== null) {
		navigator.geolocation.clearWatch(watchId);
		watchId = null;
	}
	if (lostTimer) clearTimeout(lostTimer);
	lastPos = null;
	lastUpdate = 0;
	position.set(null);
	gpsSignal.set('off');
}

// Speed in km/h for UI
export const speedKmh = derived(position, ($pos) =>
	$pos?.speed != null && $pos.speed >= 0 ? Math.round($pos.speed * 3.6) : null
);
