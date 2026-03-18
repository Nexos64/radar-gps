<script lang="ts">
	import { gpsSignal } from '$lib/stores/gps';

	const labels: Record<string, string> = {
		off: 'GPS OFF',
		lost: 'GPS PERDU',
		weak: 'GPS FAIBLE',
		strong: 'GPS'
	};

	const colors: Record<string, string> = {
		off: '#666',
		lost: '#e53935',
		weak: '#f57c00',
		strong: '#4caf50'
	};
</script>

<div class="gps-indicator" style="--color: {colors[$gpsSignal]}">
	<div class="dot"></div>
	<span>{labels[$gpsSignal]}</span>
</div>

<style>
	.gps-indicator {
		position: fixed;
		top: env(safe-area-inset-top, 12px);
		right: 12px;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(0, 0, 0, 0.7);
		border-radius: 20px;
		color: var(--color);
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.5px;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color);
	}
</style>
