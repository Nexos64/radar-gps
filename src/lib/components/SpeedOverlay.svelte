<script lang="ts">
	import { speedKmh } from '$lib/stores/gps';
	import { currentSpeedLimit } from '$lib/stores/speedlimit';

	$: over = $currentSpeedLimit != null && $speedKmh != null && $speedKmh > $currentSpeedLimit;
</script>

<div class="speed-overlay">
	<!-- Vitesse actuelle -->
	<div class="speed-current" class:over>
		<span class="speed-value">{$speedKmh ?? '—'}</span>
		<span class="speed-unit">km/h</span>
	</div>

	<!-- Limitation de vitesse -->
	{#if $currentSpeedLimit != null}
		<div class="speed-limit">
			<div class="limit-sign">
				<span class="limit-value">{$currentSpeedLimit}</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.speed-overlay {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 16px) + 80px);
		left: 14px;
		z-index: 25;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}

	.speed-current {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		background: rgba(20, 20, 40, 0.9);
		border-radius: 16px;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border: 2px solid rgba(255, 255, 255, 0.15);
	}

	.speed-current.over {
		border-color: #e53935;
		background: rgba(60, 20, 20, 0.95);
	}

	.speed-value {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 28px;
		font-weight: 800;
		color: #ffffff;
		line-height: 1;
	}

	.speed-current.over .speed-value {
		color: #ff5252;
	}

	.speed-unit {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 10px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.5);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.speed-limit {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.limit-sign {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: #ffffff;
		border: 3px solid #e53935;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.limit-value {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 18px;
		font-weight: 900;
		color: #1a1a1a;
		line-height: 1;
	}
</style>
