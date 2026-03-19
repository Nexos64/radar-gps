import type { Radar } from '$lib/types';

const DB_NAME = 'radar-gps';
const DB_VERSION = 1;
const STORE_RADARS = 'radars';
const STORE_META = 'meta';

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_RADARS)) {
				db.createObjectStore(STORE_RADARS, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(STORE_META)) {
				db.createObjectStore(STORE_META, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = db.transaction(store, mode);
		const s = t.objectStore(store);
		const r = fn(s);
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});
}

/** Get the last fetch timestamp for a source */
export async function getLastFetch(source: string): Promise<number> {
	const db = await open();
	const row = await tx(db, STORE_META, 'readonly', (s) => s.get(`lastFetch-${source}`));
	db.close();
	return row?.value ?? 0;
}

/** Set the last fetch timestamp for a source */
export async function setLastFetch(source: string): Promise<void> {
	const db = await open();
	await tx(db, STORE_META, 'readwrite', (s) =>
		s.put({ key: `lastFetch-${source}`, value: Date.now() })
	);
	db.close();
}

/** Store radars for a source (replaces all existing radars from that source) */
export async function storeRadars(source: string, radars: Radar[]): Promise<void> {
	const db = await open();
	const t = db.transaction(STORE_RADARS, 'readwrite');
	const store = t.objectStore(STORE_RADARS);

	// Delete existing radars from this source
	const all: Radar[] = await new Promise((resolve, reject) => {
		const req = store.getAll();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

	for (const r of all) {
		if (r.source === source) store.delete(r.id);
	}

	// Add new radars
	for (const r of radars) {
		store.put(r);
	}

	await new Promise<void>((resolve, reject) => {
		t.oncomplete = () => resolve();
		t.onerror = () => reject(t.error);
	});
	db.close();
}

/** Get all radars, deduplicated (Luftop > OSM > Waze) */
export async function getAllRadars(): Promise<Radar[]> {
	const db = await open();
	const all: Radar[] = await tx(db, STORE_RADARS, 'readonly', (s) => s.getAll());
	db.close();
	return dedup(all);
}

/** Get radars from a specific source */
export async function getRadarsBySource(source: string): Promise<Radar[]> {
	const db = await open();
	const all: Radar[] = await tx(db, STORE_RADARS, 'readonly', (s) => s.getAll());
	db.close();
	return all.filter((r) => r.source === source);
}

/** Get radars within a radius from a position, filtered by bbox */
export async function getRadarsInView(
	userLat: number,
	userLng: number,
	radiusM: number,
	bbox: { north: number; south: number; east: number; west: number }
): Promise<Radar[]> {
	const db = await open();
	const all: Radar[] = await tx(db, STORE_RADARS, 'readonly', (s) => s.getAll());
	db.close();

	const inView = all.filter((r) => {
		// Quick bbox check first
		if (r.lat < bbox.south || r.lat > bbox.north || r.lng < bbox.west || r.lng > bbox.east) {
			return false;
		}
		// Then distance check from user
		return distanceM({ lat: userLat, lng: userLng }, r) <= radiusM;
	});

	return dedup(inView);
}

const SOURCE_PRIORITY: Record<string, number> = { osm: 0, luftop: 1, waze: 2 };
const DEDUP_DISTANCE_M = 100;

/** Deduplicate radars: if two radars are within 100m, keep the higher-priority source */
function dedup(radars: Radar[]): Radar[] {
	// Sort by priority (OSM first, then Luftop, then Waze)
	const sorted = [...radars].sort(
		(a, b) => (SOURCE_PRIORITY[a.source] ?? 9) - (SOURCE_PRIORITY[b.source] ?? 9)
	);

	const kept: Radar[] = [];
	for (const radar of sorted) {
		const isDuplicate = kept.some(
			(existing) => distanceM(existing, radar) < DEDUP_DISTANCE_M
		);
		if (!isDuplicate) kept.push(radar);
	}
	return kept;
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
	const R = 6_371_000;
	const dLat = ((b.lat - a.lat) * Math.PI) / 180;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;
	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const h =
		sinLat * sinLat +
		Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
	return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
