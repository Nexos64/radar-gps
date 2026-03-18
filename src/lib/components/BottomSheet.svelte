<script lang="ts" context="module">
	export type SheetState = 'closed' | 'half' | 'full';
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Bottom sheet à 3 états :
	 *   - closed : seul le handle + barre de recherche sont visibles (~80px)
	 *   - half   : mi-hauteur (~45% de l'écran)
	 *   - full   : plein écran (sauf safe area top)
	 *
	 * Glissement vertical (touch) pour changer d'état.
	 */

	export let state: SheetState = 'closed';

	let sheetEl: HTMLDivElement;
	let startY = 0;
	let startTranslate = 0;
	let currentTranslate = 0;
	let dragging = false;
	let windowHeight = 0;

	// Positions en px depuis le haut de l'écran
	$: closedTop = windowHeight - 80;
	$: halfTop = windowHeight * 0.55;
	$: fullTop = 20; // safe area

	$: targetTop = state === 'full' ? fullTop : state === 'half' ? halfTop : closedTop;

	$: if (!dragging && sheetEl) {
		currentTranslate = targetTop;
	}

	function onTouchStart(e: TouchEvent) {
		// Ne pas capturer si le touch est dans un input ou la liste scrollable
		const target = e.target as HTMLElement;
		if (target.closest('input') || target.closest('.search-results-scroll')) return;

		dragging = true;
		startY = e.touches[0].clientY;
		startTranslate = currentTranslate;
	}

	function onTouchMove(e: TouchEvent) {
		if (!dragging) return;
		const dy = e.touches[0].clientY - startY;
		const newY = startTranslate + dy;
		// Clamp entre fullTop et closedTop
		currentTranslate = Math.max(fullTop, Math.min(closedTop, newY));
	}

	function onTouchEnd() {
		if (!dragging) return;
		dragging = false;

		// Déterminer l'état le plus proche
		const distClosed = Math.abs(currentTranslate - closedTop);
		const distHalf = Math.abs(currentTranslate - halfTop);
		const distFull = Math.abs(currentTranslate - fullTop);

		const min = Math.min(distClosed, distHalf, distFull);
		if (min === distFull) state = 'full';
		else if (min === distHalf) state = 'half';
		else state = 'closed';
	}

	/** Ouvrir le sheet au tap sur la barre de recherche */
	export function open() {
		if (state === 'closed') state = 'half';
	}

	export function close() {
		state = 'closed';
	}

	onMount(() => {
		windowHeight = window.innerHeight;
		currentTranslate = closedTop;

		const onResize = () => { windowHeight = window.innerHeight; };
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="bottom-sheet"
	bind:this={sheetEl}
	style="transform: translateY({currentTranslate}px); {dragging ? '' : 'transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);'}"
	on:touchstart={onTouchStart}
	on:touchmove={onTouchMove}
	on:touchend={onTouchEnd}
>
	<!-- Handle -->
	<div class="handle-area">
		<div class="handle"></div>
	</div>

	<!-- Contenu (slot) -->
	<div class="sheet-content">
		<slot />
	</div>
</div>

<style>
	.bottom-sheet {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		height: 100vh;
		z-index: 40;
		background: #1e1e2e;
		border-radius: 20px 20px 0 0;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		touch-action: none;
		will-change: transform;
	}

	.handle-area {
		display: flex;
		justify-content: center;
		padding: 10px 0 6px;
		cursor: grab;
		flex-shrink: 0;
	}

	.handle {
		width: 40px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.3);
	}

	.sheet-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		padding: 0 16px 16px;
	}
</style>
