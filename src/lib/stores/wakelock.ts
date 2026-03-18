let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
	try {
		if ('wakeLock' in navigator) {
			wakeLock = await navigator.wakeLock.request('screen');
			wakeLock.addEventListener('release', () => { wakeLock = null; });
		}
	} catch (e) {
		console.warn('Wake Lock failed:', e);
	}
}

export async function releaseWakeLock() {
	if (wakeLock) {
		await wakeLock.release();
		wakeLock = null;
	}
}

// Re-acquire on visibility change (tab switch back)
if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && !wakeLock) {
			requestWakeLock();
		}
	});
}
