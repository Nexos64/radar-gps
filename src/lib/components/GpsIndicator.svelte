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
		lost: '#FF2B2B',
		weak: '#F08000',
		strong: '#1FE093'
	};
</script>

<div class="gps-indicator" style="--color: {colors[$gpsSignal]}">
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
		{#if $gpsSignal === 'strong'}
			<circle cx="12" cy="12" r="3" fill="var(--color)"/>
			<path d="M12 2a10 10 0 0 1 10 10"/>
			<path d="M12 6a6 6 0 0 1 6 6"/>
		{:else if $gpsSignal === 'weak'}
			<circle cx="12" cy="12" r="3" fill="var(--color)"/>
			<path d="M12 6a6 6 0 0 1 6 6"/>
		{:else}
			<circle cx="12" cy="12" r="3" fill="var(--color)"/>
		{/if}
	</svg>
	<span>{labels[$gpsSignal]}</span>
</div>

<style>
	.gps-indicator {
		position: fixed;
		top: calc(env(safe-area-inset-top, 12px) + 4px);
		right: 12px;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: rgba(36, 40, 48, 0.85);
		border-radius: 20px;
		color: var(--color);
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
</style>
