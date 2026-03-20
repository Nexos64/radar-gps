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
			<div class="stat-divider"></div>
			<div class="stat">
				<span class="stat-value">{formatDuration($navInfo.route.durationS)}</span>
				<span class="stat-label">Duree</span>
			</div>
			<div class="stat-divider"></div>
			<div class="stat">
				<span class="stat-value radar-count">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:4px;">
						<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
						<circle cx="12" cy="13" r="4"/>
					</svg>
					{$navInfo.radarsOnRoute.length}
				</span>
				<span class="stat-label">Radars</span>
			</div>
		</div>
		<div class="preview-actions">
			<button class="cancel-btn" on:click={stopNavigation}>Annuler</button>
			<button class="go-btn" on:click={startNavigation}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;">
					<polygon points="3 11 22 2 13 21 11 13 3 11"/>
				</svg>
				C'est parti !
			</button>
		</div>
	</div>
{/if}

<style>
	.route-preview {
		position: fixed;
		bottom: env(safe-area-inset-bottom, 0px);
		left: 12px;
		right: 12px;
		z-index: 35;
		background: rgba(36, 40, 48, 0.96);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		padding: 24px 20px 20px;
		border-radius: 20px;
		box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.35);
		animation: slideUp 0.3s ease-out;
	}

	.preview-stats {
		display: flex;
		justify-content: space-around;
		align-items: center;
		margin-bottom: 20px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.stat-divider {
		width: 1px;
		height: 32px;
		background: rgba(255, 255, 255, 0.1);
	}

	.stat-value {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 22px;
		font-weight: 800;
		color: #ffffff;
	}

	.stat-value.radar-count {
		color: #F08000;
		display: flex;
		align-items: center;
	}

	.stat-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
	}

	.preview-actions {
		display: flex;
		gap: 12px;
	}

	.cancel-btn {
		flex: 1;
		padding: 14px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		background: transparent;
		color: rgba(255, 255, 255, 0.7);
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.cancel-btn:active {
		background: rgba(255, 255, 255, 0.06);
	}

	.go-btn {
		flex: 2;
		padding: 14px;
		border: none;
		border-radius: 16px;
		background: #1FE093;
		color: #1B1D21;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 800;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 12px rgba(31, 224, 147, 0.3);
		transition: transform 0.15s ease;
	}

	.go-btn:active {
		transform: scale(0.97);
	}

	@keyframes slideUp {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}
</style>
