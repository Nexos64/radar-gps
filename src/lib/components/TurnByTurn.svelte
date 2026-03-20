<script lang="ts">
	import { onDestroy } from 'svelte';
	import { navInfo, currentStep, nextStep, isNavigating, stopNavigation } from '$lib/stores/navigation';

	/** Ticker that updates every 30s to refresh ETA display */
	let etaTick = 0;
	const etaInterval = setInterval(() => { etaTick++; }, 30_000);
	onDestroy(() => clearInterval(etaInterval));

	type StepInfo = { maneuver: string; modifier: string | null };

	/** Map step to a direction category for SVG icon selection */
	function directionForStep(step: StepInfo): string {
		if (step.modifier) {
			const m = step.modifier;
			if (m === 'uturn') return 'uturn';
			if (m === 'sharp right') return 'sharp-right';
			if (m === 'right') return 'right';
			if (m === 'slight right') return 'slight-right';
			if (m === 'straight') return 'straight';
			if (m === 'slight left') return 'slight-left';
			if (m === 'left') return 'left';
			if (m === 'sharp left') return 'sharp-left';
		}
		const t = step.maneuver;
		if (t === 'arrive') return 'arrive';
		if (t === 'depart' || t === 'continue') return 'straight';
		if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn') return 'roundabout';
		if (t === 'merge' || t === 'on ramp' || t === 'fork') return 'slight-right';
		if (t === 'off ramp') return 'slight-right';
		if (t === 'exit roundabout' || t === 'exit rotary') return 'right';
		return 'straight';
	}

	function formatDist(m: number): string {
		if (m < 1000) return `${Math.round(m / 10) * 10} m`;
		return `${(m / 1000).toFixed(1)} km`;
	}

	function formatEta(timestamp: number, _tick?: number): string {
		// _tick param forces Svelte reactivity on interval
		const d = new Date(timestamp);
		return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
	}
</script>

{#if $isNavigating && $currentStep}
	<div class="turn-by-turn">
		<!-- Instruction principale -->
		<div class="main-instruction">
			<div class="turn-icon">
				{#if directionForStep($currentStep) === 'straight'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
				{:else if directionForStep($currentStep) === 'right'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
				{:else if directionForStep($currentStep) === 'left'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
				{:else if directionForStep($currentStep) === 'slight-right'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
				{:else if directionForStep($currentStep) === 'slight-left'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="17" x2="7" y2="7"/><polyline points="17 7 7 7 7 17"/></svg>
				{:else if directionForStep($currentStep) === 'sharp-right'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"/><path d="M6 17v-5a3 3 0 0 1 3-3h9"/></svg>
				{:else if directionForStep($currentStep) === 'sharp-left'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><path d="M18 17v-5a3 3 0 0 0-3-3H6"/></svg>
				{:else if directionForStep($currentStep) === 'uturn'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 1 1 0 8h-1"/></svg>
				{:else if directionForStep($currentStep) === 'roundabout'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 16v5"/><path d="M12 3v5"/><polyline points="9 5 12 3 15 5"/></svg>
				{:else if directionForStep($currentStep) === 'arrive'}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
				{:else}
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
				{/if}
			</div>
			<div class="turn-body">
				<div class="turn-distance">{formatDist($navInfo.distanceToNextStep)}</div>
				<div class="turn-text">{$currentStep.instruction}</div>
			</div>
		</div>

		<!-- Prochaine instruction (apercu) -->
		{#if $nextStep}
			<div class="next-instruction">
				<div class="next-icon">
					{#if directionForStep($nextStep) === 'right'}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
					{:else if directionForStep($nextStep) === 'left'}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
					{:else if directionForStep($nextStep) === 'straight'}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
					{:else if directionForStep($nextStep) === 'roundabout'}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/></svg>
					{:else}
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
					{/if}
				</div>
				<span class="next-text">Puis : {$nextStep.instruction}</span>
			</div>
		{/if}

		<!-- Barre d'info en bas -->
		<div class="nav-bar">
			<div class="nav-stat">
				<span class="nav-value">{formatDist($navInfo.distanceRemaining)}</span>
				<span class="nav-label">restant</span>
			</div>
			<div class="nav-eta">
				<span class="nav-eta-value">{formatEta($navInfo.etaTimestamp, etaTick)}</span>
				<span class="nav-label">arrivee</span>
			</div>
			<button class="stop-btn" on:click={stopNavigation}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18"/>
					<line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
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
		background: rgba(36, 40, 48, 0.96);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.turn-icon {
		width: 56px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 153, 255, 0.15);
		border-radius: 16px;
		color: #0099FF;
		flex-shrink: 0;
	}

	.turn-body {
		flex: 1;
		min-width: 0;
	}

	.turn-distance {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 28px;
		font-weight: 800;
		color: #ffffff;
		line-height: 1.1;
	}

	.turn-text {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
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
		background: rgba(36, 40, 48, 0.88);
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.45);
	}

	.next-icon {
		color: rgba(255, 255, 255, 0.4);
		display: flex;
		align-items: center;
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
		padding: 14px 20px;
		background: rgba(36, 40, 48, 0.96);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.nav-stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.nav-value {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 17px;
		font-weight: 700;
		color: #ffffff;
	}

	.nav-eta {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.nav-eta-value {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 22px;
		font-weight: 800;
		color: #1FE093;
	}

	.nav-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 10px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.35);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stop-btn {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: #FF2B2B;
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(255, 43, 43, 0.3);
		transition: transform 0.15s ease;
	}

	.stop-btn:active {
		transform: scale(0.92);
	}
</style>
