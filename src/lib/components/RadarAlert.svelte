<script lang="ts">
	import { activeAlert, type RadarAlert } from '$lib/stores/alerts';
	import { playWarningAlert, playDangerAlert } from '$lib/stores/audio';

	const DANGER_DISTANCE_M = 100;

	const TYPE_LABELS: Record<string, string> = {
		fixed: 'Radar fixe',
		mobile: 'Radar mobile',
		traffic_light: 'Radar feu rouge',
		section_start: 'Tronçon',
		section_end: 'Fin tronçon',
		police: 'Contrôle police',
		other: 'Radar'
	};

	const TYPE_EMOJIS: Record<string, string> = {
		fixed: '📷',
		mobile: '📱',
		traffic_light: '🚦',
		section_start: '⏱',
		section_end: '⏱',
		police: '👮',
		other: '⚠️'
	};

	function formatDistance(m: number): string {
		if (m < 1000) return `${Math.round(m / 10) * 10} m`;
		return `${(m / 1000).toFixed(1)} km`;
	}

	// Réagir aux nouvelles alertes pour jouer le son
	$: if ($activeAlert?.isNew) {
		if ($activeAlert.distanceM <= DANGER_DISTANCE_M) {
			playDangerAlert();
		} else {
			playWarningAlert();
		}
	}

	$: isDanger = $activeAlert != null && $activeAlert.distanceM <= DANGER_DISTANCE_M;
	$: label = $activeAlert ? (TYPE_LABELS[$activeAlert.radar.type] || 'Radar') : '';
	$: emoji = $activeAlert ? (TYPE_EMOJIS[$activeAlert.radar.type] || '⚠️') : '';
	$: speedText = $activeAlert?.radar.speedLimit ? `${$activeAlert.radar.speedLimit} km/h` : '';
	$: distText = $activeAlert ? formatDistance($activeAlert.distanceM) : '';
	$: sourceText = $activeAlert ? $activeAlert.radar.source.toUpperCase() : '';
</script>

{#if $activeAlert}
	<div class="radar-alert" class:danger={isDanger}>
		<div class="alert-icon">{emoji}</div>
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
		gap: 12px;
		padding: 14px 18px;
		background: rgba(30, 30, 50, 0.92);
		border: 2px solid #f57c00;
		border-radius: 16px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		animation: slideIn 0.3s ease-out;
	}

	.radar-alert.danger {
		border-color: #e53935;
		background: rgba(60, 20, 20, 0.95);
		animation: slideIn 0.3s ease-out, pulse 1s ease-in-out infinite;
	}

	.alert-icon {
		font-size: 28px;
		flex-shrink: 0;
	}

	.alert-body {
		flex: 1;
		min-width: 0;
	}

	.alert-title {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
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
		background: #e53935;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 800;
		color: #ffffff;
	}

	.alert-distance {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 22px;
		font-weight: 800;
		color: #f57c00;
		margin-top: 2px;
	}

	.danger .alert-distance {
		color: #ff5252;
	}

	.alert-source {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 10px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
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
