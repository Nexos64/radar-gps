<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let visible = false;

	const dispatch = createEventDispatcher<{ recenter: void }>();
</script>

{#if visible}
	<button class="recenter-btn" on:click={() => dispatch('recenter')} aria-label="Recentrer">
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polygon points="3 11 22 2 13 21 11 13 3 11"/>
		</svg>
	</button>
{/if}

<style>
	.recenter-btn {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 16px) + 80px);
		right: 14px;
		z-index: 25;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: none;
		background: rgba(20, 20, 40, 0.9);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		color: #4285F4;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		transition: transform 0.15s ease, background 0.15s ease;
	}

	.recenter-btn:active {
		transform: scale(0.9);
		background: rgba(66, 133, 244, 0.3);
	}
</style>
