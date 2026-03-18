import { writable, derived } from 'svelte/store';
import { GpsKalman } from './kalman';

export interface GpsPosition {
	lat: number;
	lng: number;
	accuracy: number;
	heading: number | null;
	speed: number | null; // m/s
	timestamp: number;
	/** true si la position est extrapolée (tunnel) */
	extrapolated?: boolean;
}

export type GpsSignal = 'strong' | 'weak' | 'lost' | 'off';

const MIN_DISTANCE_M = 5;
const THROTTLE_MS = 1000;
const LOST_TIMEOUT_MS = 10_000;
const WEAK_ACCURACY_M = 50;

export const position = writable<GpsPosition | null>(null);
export const gpsSignal = writable<GpsSignal>('off');
export const compassHeading = writable<number | null>(null);

let compassListener: ((e: DeviceOrientationEvent) => void) | null = null;

function startCompass() {
	if (compassListener) return;
	compassListener = (e: DeviceOrientationEvent) => {
		// iOS uses webkitCompassHeading (0-360, 0=North)
		const heading = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
		if (heading != null) compassHeading.set(heading);
	};
	window.addEventListener('deviceorientationabsolute', compassListener as any, true);
	// Fallback for browsers that don't support 'deviceorientationabsolute'
	window.addEventListener('deviceorientation', compassListener, true);
}

function stopCompass() {
	if (!compassListener) return;
	window.removeEventListener('deviceorientationabsolute', compassListener as any, true);
	window.removeEventListener('deviceorientation', compassListener, true);
	compassListener = null;
	compassHeading.set(null);
}

let watchId: number | null = null;
let lastUpdate = 0;
let lastPos: GpsPosition | null = null;
let lostTimer: ReturnType<typeof setTimeout> | null = null;
let tunnelInterval: ReturnType<typeof setInterval> | null = null;

const kalman = new GpsKalman();

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
	lostTimer = setTimeout(() => {
		gpsSignal.set('lost');
		// Enter tunnel mode — extrapolate position
		startTunnelExtrapolation();
	}, LOST_TIMEOUT_MS);
}

function startTunnelExtrapolation() {
	if (tunnelInterval) return;
	kalman.enterTunnel();
	let elapsed = 0;

	tunnelInterval = setInterval(() => {
		elapsed += 1000;
		const extrapolated = kalman.extrapolateInTunnel(elapsed);
		if (!extrapolated) {
			stopTunnelExtrapolation();
			return;
		}
		position.set({
			lat: extrapolated.lat,
			lng: extrapolated.lng,
			accuracy: 999, // unknown in tunnel
			heading: lastPos?.heading ?? null,
			speed: lastPos?.speed ?? null,
			timestamp: Date.now(),
			extrapolated: true
		});
	}, 1000);
}

function stopTunnelExtrapolation() {
	if (tunnelInterval) {
		clearInterval(tunnelInterval);
		tunnelInterval = null;
	}
}

function onPosition(geo: GeolocationPosition) {
	const now = Date.now();
	if (now - lastUpdate < THROTTLE_MS) return;

	// Kalman filter the position
	const filtered = kalman.filter(
		geo.coords.latitude,
		geo.coords.longitude,
		geo.coords.accuracy,
		geo.timestamp
	);

	const pos: GpsPosition = {
		lat: filtered.lat,
		lng: filtered.lng,
		accuracy: geo.coords.accuracy,
		heading: geo.coords.heading,
		speed: geo.coords.speed,
		timestamp: geo.timestamp
	};

	if (lastPos && distanceM(lastPos, pos) < MIN_DISTANCE_M) return;

	// Store for tunnel extrapolation
	kalman.setLastValid(filtered.lat, filtered.lng, geo.coords.heading, geo.coords.speed);

	// Stop tunnel mode if active
	stopTunnelExtrapolation();

	lastUpdate = now;
	lastPos = pos;
	position.set(pos);
	gpsSignal.set(pos.accuracy <= WEAK_ACCURACY_M ? 'strong' : 'weak');
	resetLostTimer();
}

function onError(err: GeolocationPositionError) {
	console.warn('GPS error:', err.message);
	gpsSignal.set('lost');
	startTunnelExtrapolation();
}

export function startGps() {
	if (watchId !== null) return;
	if (!navigator.geolocation) {
		gpsSignal.set('lost');
		return;
	}

	gpsSignal.set('weak');
	kalman.reset();
	resetLostTimer();
	startCompass();

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
	stopTunnelExtrapolation();
	stopCompass();
	kalman.reset();
	lastPos = null;
	lastUpdate = 0;
	position.set(null);
	gpsSignal.set('off');
}

// Speed in km/h for UI
export const speedKmh = derived(position, ($pos) =>
	$pos?.speed != null && $pos.speed >= 0 ? Math.round($pos.speed * 3.6) : null
);
