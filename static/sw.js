/**
 * Service Worker — Cache-first for app shell, network-first for API/tiles.
 * Ensures the PWA loads instantly from cache on iOS home screen.
 */

const CACHE_NAME = 'radar-gps-v4';

// App shell files to precache
const APP_SHELL = [
	'/',
	'/manifest.json'
];

// Patterns that should be cached after first fetch (CSS, JS, fonts)
const CACHEABLE_PATTERNS = [
	/\.(js|css|woff2?|ttf|eot)(\?.*)?$/,
	/\/icons\//,
	/fonts\/pbf\//
];

// Patterns that should NEVER be cached (API calls, tiles, live data)
const NEVER_CACHE = [
	/\/api\//,
	/overpass/,
	/tomtom\.com/,
	/nominatim/,
	/router\.project-osrm/,
	/protomaps\.com\/tiles/,
	/luftop/,
	/waze/
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(
				keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
			))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const url = event.request.url;

	// Never cache API/tile requests
	if (NEVER_CACHE.some((p) => p.test(url))) {
		event.respondWith(fetch(event.request));
		return;
	}

	// Navigation requests (HTML pages): network-first with cache fallback
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
					return response;
				})
				.catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
		);
		return;
	}

	// Cacheable static assets: cache-first
	if (CACHEABLE_PATTERNS.some((p) => p.test(url))) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				if (cached) return cached;
				return fetch(event.request).then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
					}
					return response;
				});
			})
		);
		return;
	}

	// Default: network with cache fallback
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				if (response.ok && event.request.method === 'GET') {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(() => caches.match(event.request))
	);
});
