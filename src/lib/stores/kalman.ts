/**
 * Simple 1D Kalman filter for GPS coordinates.
 *
 * Smooths noisy GPS readings while keeping responsiveness.
 * Applied independently to lat and lng.
 */

export class KalmanFilter1D {
	private x: number; // state estimate
	private p: number; // estimate uncertainty
	private q: number; // process noise
	private r: number; // measurement noise

	constructor(processNoise = 0.00001, measurementNoise = 0.0001) {
		this.x = 0;
		this.p = 1;
		this.q = processNoise;
		this.r = measurementNoise;
	}

	/** Update the filter with a new measurement. Returns filtered value. */
	update(measurement: number): number {
		// Prediction
		this.p += this.q;

		// Update
		const k = this.p / (this.p + this.r);
		this.x += k * (measurement - this.x);
		this.p *= 1 - k;

		return this.x;
	}

	/** Reset the filter with an initial value */
	reset(value: number) {
		this.x = value;
		this.p = 1;
	}

	get value() {
		return this.x;
	}
}

/**
 * GPS Kalman smoother — applies Kalman filtering to lat/lng/heading.
 * Also handles tunnel detection (GPS signal loss).
 */
export class GpsKalman {
	private latFilter: KalmanFilter1D;
	private lngFilter: KalmanFilter1D;
	private initialized = false;
	private lastTimestamp = 0;

	// Tunnel detection
	private lastValidPos: { lat: number; lng: number; heading: number | null; speed: number | null } | null = null;
	private tunnelMode = false;
	private tunnelStartTime = 0;
	static readonly TUNNEL_TIMEOUT_MS = 15_000; // 15s sans GPS = tunnel

	constructor() {
		// Lower process noise = smoother, higher = more responsive
		// Lower measurement noise = trust GPS more
		this.latFilter = new KalmanFilter1D(0.000003, 0.00005);
		this.lngFilter = new KalmanFilter1D(0.000003, 0.00005);
	}

	/**
	 * Filter a GPS position. Returns smoothed position.
	 * Adjusts noise dynamically based on accuracy.
	 */
	filter(lat: number, lng: number, accuracy: number, timestamp: number): { lat: number; lng: number } {
		if (!this.initialized) {
			this.latFilter.reset(lat);
			this.lngFilter.reset(lng);
			this.initialized = true;
			this.lastTimestamp = timestamp;
			return { lat, lng };
		}

		// Adjust measurement noise based on accuracy
		// High accuracy → trust GPS more (low noise)
		// Low accuracy → smooth more (high noise)
		const noise = Math.max(0.000005, accuracy * 0.000001);
		(this.latFilter as any).r = noise;
		(this.lngFilter as any).r = noise;

		this.lastTimestamp = timestamp;
		this.tunnelMode = false;

		return {
			lat: this.latFilter.update(lat),
			lng: this.lngFilter.update(lng)
		};
	}

	/**
	 * Check if we're in a tunnel (GPS lost).
	 * Call this when GPS times out. Returns extrapolated position if available.
	 */
	enterTunnel(): { lat: number; lng: number } | null {
		if (!this.lastValidPos) return null;
		this.tunnelMode = true;
		if (this.tunnelStartTime === 0) this.tunnelStartTime = Date.now();
		return { lat: this.lastValidPos.lat, lng: this.lastValidPos.lng };
	}

	/**
	 * Extrapolate position in tunnel based on last known heading and speed.
	 * Returns null if no valid data or tunnel too long.
	 */
	extrapolateInTunnel(elapsedMs: number): { lat: number; lng: number } | null {
		if (!this.lastValidPos || !this.tunnelMode) return null;
		if (elapsedMs > GpsKalman.TUNNEL_TIMEOUT_MS) return null;

		const { lat, lng, heading, speed } = this.lastValidPos;
		if (heading == null || speed == null || speed < 1) return { lat, lng };

		// Extrapolate position
		const distM = speed * (elapsedMs / 1000);
		const headingRad = (heading * Math.PI) / 180;
		const dLat = (distM * Math.cos(headingRad)) / 111_320;
		const dLng = (distM * Math.sin(headingRad)) / (111_320 * Math.cos((lat * Math.PI) / 180));

		return { lat: lat + dLat, lng: lng + dLng };
	}

	/** Store last valid position (for tunnel extrapolation) */
	setLastValid(lat: number, lng: number, heading: number | null, speed: number | null) {
		this.lastValidPos = { lat, lng, heading, speed };
		this.tunnelStartTime = 0;
	}

	get isTunnel() {
		return this.tunnelMode;
	}

	reset() {
		this.initialized = false;
		this.lastValidPos = null;
		this.tunnelMode = false;
		this.tunnelStartTime = 0;
	}
}
