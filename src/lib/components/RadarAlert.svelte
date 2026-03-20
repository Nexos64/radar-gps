<script lang="ts">
	import { activeAlert, type RadarAlert } from '$lib/stores/alerts';
	import { playWarningAlert, playDangerAlert } from '$lib/stores/audio';

	const DANGER_DISTANCE_M = 100;

	const TYPE_LABELS: Record<string, string> = {
		fixed: 'Radar fixe',
		mobile: 'Radar mobile',
		traffic_light: 'Radar feu rouge',
		section_start: 'Troncon',
		section_end: 'Fin troncon',
		police: 'Controle police',
		other: 'Radar'
	};

	function formatDistance(m: number): string {
		if (m < 1000) return `${Math.round(m / 10) * 10} m`;
		return `${(m / 1000).toFixed(1)} km`;
	}

	// Reagir aux nouvelles alertes pour jouer le son
	$: if ($activeAlert?.isNew) {
		if ($activeAlert.distanceM <= DANGER_DISTANCE_M) {
			playDangerAlert();
		} else {
			playWarningAlert();
		}
	}

	$: isDanger = $activeAlert != null && $activeAlert.distanceM <= DANGER_DISTANCE_M;
	$: label = $activeAlert ? (TYPE_LABELS[$activeAlert.radar.type] || 'Radar') : '';
	$: speedText = $activeAlert?.radar.speedLimit ? `${$activeAlert.radar.speedLimit} km/h` : '';
	$: distText = $activeAlert ? formatDistance($activeAlert.distanceM) : '';
	$: sourceText = $activeAlert ? $activeAlert.radar.source.toUpperCase() : '';
	$: isPolice = $activeAlert?.radar.type === 'police';
</script>

{#if $activeAlert}
	<div class="radar-alert" class:danger={isDanger}>
		<div class="alert-icon-wrap" class:police={isPolice}>
			{#if isPolice}
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2L4 7v4c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V7l-8-5z"/>
					<path d="M9 12l2 2 4-4"/>
				</svg>
			{:else}
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
					<circle cx="12" cy="13" r="4"/>
				</svg>
			{/if}
		</div>
		<div class="alert-body">
			<div class="alert-title">
				{label}
				{#if speedText}
					<span class="speed-badge">{speedText}</span>
				{/if}
			</div>
			<div class="alert-distance">dans {distText}</div>
		</div>
		<div class="alert-source">{sourceText}</div>
	</div>
{/if}

<style>
	.radar-alert {
		position: fixed;
		top: env(safe-area-inset-top, 8px);
		left: 12px;
		right: 12px;
		z-index: 9999;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		background: rgba(36, 40, 48, 0.95);
		border-left: 4px solid #F08000;
		border-radius: 16px;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
		animation: slideIn 0.3s ease-out;
	}

	.radar-alert.danger {
		border-left-color: #FF2B2B;
		background: rgba(50, 25, 25, 0.95);
		animation: slideIn 0.3s ease-out, pulse 1s ease-in-out infinite;
	}

	.alert-icon-wrap {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		background: rgba(240, 128, 0, 0.15);
		color: #F08000;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.danger .alert-icon-wrap {
		background: rgba(255, 43, 43, 0.15);
		color: #FF2B2B;
	}

	.alert-icon-wrap.police {
		background: rgba(0, 153, 255, 0.15);
		color: #0099FF;
	}

	.alert-body {
		flex: 1;
		min-width: 0;
	}

	.alert-title {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 700;
		color: #ffffff;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.speed-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 2px 8px;
		background: #FF2B2B;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 800;
		color: #ffffff;
	}

	.alert-distance {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 22px;
		font-weight: 800;
		color: #F08000;
		margin-top: 2px;
	}

	.danger .alert-distance {
		color: #FF5252;
	}

	.alert-source {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 10px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.3);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		align-self: flex-start;
	}

	@keyframes slideIn {
		from {
			transform: translateY(-20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.85; }
	}
</style>
