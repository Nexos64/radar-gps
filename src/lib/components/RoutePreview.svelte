<script lang="ts">
	import { navInfo, isPreview, startNavigation, stopNavigation } from '$lib/stores/navigation';

	function formatDist(m: number): string {
		if (m < 1000) return `${Math.round(m)} m`;
		return `${(m / 1000).toFixed(1)} km`;
	}

	function formatDuration(s: number): string {
		if (s < 60) return '< 1 min';
		const mins = Math.round(s / 60);
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
	}
</script>

{#if $isPreview && $navInfo.route}
	<div class="route-preview">
		<div class="preview-stats">
			<div class="stat">
				<span class="stat-value">{formatDist($navInfo.route.distanceM)}</span>
				<span class="stat-label">Distance</span>
			</div>
			<div class="stat">
				<span class="stat-value">{formatDuration($navInfo.route.durationS)}</span>
				<span class="stat-label">Durée</span>
			</div>
			<div class="stat">
				<span class="stat-value radar-count">{$navInfo.radarsOnRoute.length}</span>
				<span class="stat-label">📷 Radars</span>
			</div>
		</div>
		<div class="preview-actions">
			<button class="cancel-btn" on:click={stopNavigation}>Annuler</button>
			<button class="go-btn" on:click={startNavigation}>
				C'est parti !
			</button>
		</div>
	</div>
{/if}

<style>
	.route-preview {
		position: fixed;
		bottom: env(safe-area-inset-bottom, 0px);
		left: 0;
		right: 0;
		z-index: 35;
		background: rgba(20, 20, 40, 0.95);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		padding: 20px;
		border-radius: 20px 20px 0 0;
		animation: slideUp 0.3s ease-out;
	}

	.preview-stats {
		display: flex;
		justify-content: space-around;
		margin-bottom: 18px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.stat-value {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 22px;
		font-weight: 800;
		color: #ffffff;
	}

	.stat-value.radar-count {
		color: #f57c00;
	}

	.stat-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.5);
	}

	.preview-actions {
		display: flex;
		gap: 12px;
	}

	.cancel-btn {
		flex: 1;
		padding: 14px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 14px;
		background: transparent;
		color: rgba(255, 255, 255, 0.7);
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
	}

	.go-btn {
		flex: 2;
		padding: 14px;
		border: none;
		border-radius: 14px;
		background: #4285F4;
		color: #ffffff;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
	}

	.go-btn:active {
		background: #3367d6;
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
