<script lang="ts">
	import { navInfo, currentStep, nextStep, isNavigating, stopNavigation } from '$lib/stores/navigation';

	const MANEUVER_ICONS: Record<string, string> = {
		'depart': '🚗',
		'arrive': '🏁',
		'turn': '↩️',
		'new name': '➡️',
		'merge': '🔀',
		'on ramp': '⤴️',
		'off ramp': '⤵️',
		'fork': '🔀',
		'end of road': '⏹️',
		'continue': '⬆️',
		'roundabout': '🔄',
		'rotary': '🔄',
		'roundabout turn': '🔄',
		'exit roundabout': '↪️',
		'exit rotary': '↪️'
	};

	const MODIFIER_ARROWS: Record<string, string> = {
		'uturn': '↩️',
		'sharp right': '↗️',
		'right': '➡️',
		'slight right': '↗️',
		'straight': '⬆️',
		'slight left': '↖️',
		'left': '⬅️',
		'sharp left': '↖️'
	};

	function formatDist(m: number): string {
		if (m < 1000) return `${Math.round(m / 10) * 10} m`;
		return `${(m / 1000).toFixed(1)} km`;
	}

	function formatEta(timestamp: number): string {
		const d = new Date(timestamp);
		return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
	}

	function iconForStep(step: { maneuver: string; modifier: string | null }): string {
		if (step.modifier) {
			return MODIFIER_ARROWS[step.modifier] || MANEUVER_ICONS[step.maneuver] || '⬆️';
		}
		return MANEUVER_ICONS[step.maneuver] || '⬆️';
	}
</script>

{#if $isNavigating && $currentStep}
	<div class="turn-by-turn">
		<!-- Instruction principale -->
		<div class="main-instruction">
			<div class="turn-icon">{iconForStep($currentStep)}</div>
			<div class="turn-body">
				<div class="turn-distance">{formatDist($navInfo.distanceToNextStep)}</div>
				<div class="turn-text">{$currentStep.instruction}</div>
			</div>
		</div>

		<!-- Prochaine instruction (aperçu) -->
		{#if $nextStep}
			<div class="next-instruction">
				<span class="next-icon">{iconForStep($nextStep)}</span>
				<span class="next-text">Puis : {$nextStep.instruction}</span>
			</div>
		{/if}

		<!-- Barre d'info en bas -->
		<div class="nav-bar">
			<div class="nav-stat">
				<span class="nav-value">{formatDist($navInfo.distanceRemaining)}</span>
				<span class="nav-label">restant</span>
			</div>
			<div class="nav-stat">
				<span class="nav-value eta">{formatEta($navInfo.etaTimestamp)}</span>
				<span class="nav-label">arrivée</span>
			</div>
			<button class="stop-btn" on:click={stopNavigation}>✕</button>
		</div>
	</div>
{/if}

<style>
	.turn-by-turn {
		position: fixed;
		top: env(safe-area-inset-top, 0px);
		left: 0;
		right: 0;
		z-index: 35;
		display: flex;
		flex-direction: column;
		pointer-events: auto;
	}

	.main-instruction {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 20px;
		background: rgba(20, 20, 40, 0.95);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.turn-icon {
		font-size: 36px;
		flex-shrink: 0;
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(66, 133, 244, 0.2);
		border-radius: 14px;
	}

	.turn-body {
		flex: 1;
		min-width: 0;
	}

	.turn-distance {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 28px;
		font-weight: 800;
		color: #ffffff;
		line-height: 1.1;
	}

	.turn-text {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.7);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.next-instruction {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 20px;
		background: rgba(20, 20, 40, 0.85);
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.5);
	}

	.next-icon {
		font-size: 14px;
	}

	.next-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nav-bar {
		position: fixed;
		bottom: env(safe-area-inset-bottom, 0px);
		left: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 20px;
		background: rgba(20, 20, 40, 0.95);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.nav-stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.nav-value {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 700;
		color: #ffffff;
	}

	.nav-value.eta {
		font-size: 20px;
		font-weight: 800;
		color: #4caf50;
	}

	.nav-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 10px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stop-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: none;
		background: #e53935;
		color: #ffffff;
		font-size: 16px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}
</style>
