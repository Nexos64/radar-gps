<script lang="ts">
	import { speedKmh } from '$lib/stores/gps';
	import { currentSpeedLimit } from '$lib/stores/speedlimit';

	/** Bottom offset in pixels (controlled by parent based on bottom sheet) */
	export let bottomPx = 96;
	/** Whether the overlay is visible */
	export let visible = true;

	$: over = $currentSpeedLimit != null && $speedKmh != null && $speedKmh > $currentSpeedLimit;
</script>

{#if visible}
	<div class="speed-overlay" style="bottom: {bottomPx}px;">
		<!-- Vitesse actuelle -->
		<div class="speed-current" class:over>
			<span class="speed-value">{$speedKmh ?? '--'}</span>
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
{/if}

<style>
	.speed-overlay {
		position: fixed;
		left: 14px;
		z-index: 25;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
		transition: bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
	}

	.speed-current {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		background: rgba(36, 40, 48, 0.92);
		border-radius: 18px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 2px solid rgba(255, 255, 255, 0.1);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
	}

	.speed-current.over {
		border-color: #FF2B2B;
		background: rgba(50, 25, 25, 0.95);
	}

	.speed-value {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 28px;
		font-weight: 900;
		color: #ffffff;
		line-height: 1;
	}

	.speed-current.over .speed-value {
		color: #FF5252;
	}

	.speed-unit {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 10px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.4);
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
		border: 3.5px solid #FF2B2B;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.limit-value {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 18px;
		font-weight: 900;
		color: #1a1a1a;
		line-height: 1;
	}
</style>
