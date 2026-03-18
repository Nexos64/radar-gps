<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { settings, setHome, setWork, toggleAvoidHighways, toggleRadarFreeRoute, type SavedAddress } from '$lib/stores/settings';
	import { searchNominatim, type NominatimResult } from '$lib/sources/nominatim';

	const dispatch = createEventDispatcher<{ close: void; admin: void }>();

	let editingField: 'home' | 'work' | null = null;
	let searchQuery = '';
	let searchResults: NominatimResult[] = [];
	let searchLoading = false;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function startEdit(field: 'home' | 'work') {
		editingField = field;
		searchQuery = '';
		searchResults = [];
	}

	function cancelEdit() {
		editingField = null;
		searchQuery = '';
		searchResults = [];
	}

	function onSearchInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (searchQuery.trim().length < 2) {
			searchResults = [];
			return;
		}
		searchLoading = true;
		debounceTimer = setTimeout(async () => {
			try {
				searchResults = await searchNominatim(searchQuery);
			} catch { searchResults = []; }
			finally { searchLoading = false; }
		}, 400);
	}

	function selectAddress(result: NominatimResult) {
		const addr: SavedAddress = {
			label: result.label,
			detail: result.detail,
			lat: result.lat,
			lng: result.lng
		};
		if (editingField === 'home') setHome(addr);
		else if (editingField === 'work') setWork(addr);
		cancelEdit();
	}

	function removeAddress(field: 'home' | 'work') {
		if (field === 'home') setHome(null);
		else setWork(null);
	}
</script>

<div class="settings-page">
	<div class="settings-header">
		<button class="back-btn" on:click={() => dispatch('close')}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
		</button>
		<h1>Paramètres</h1>
	</div>

	<div class="settings-body">
		<!-- Adresses -->
		<section class="section">
			<h2 class="section-title">Adresses favorites</h2>

			{#if editingField}
				<div class="edit-address">
					<div class="edit-header">
						<span class="edit-label">{editingField === 'home' ? '🏠 Maison' : '💼 Travail'}</span>
						<button class="edit-cancel" on:click={cancelEdit}>Annuler</button>
					</div>
					<input
						class="edit-input"
						bind:value={searchQuery}
						on:input={onSearchInput}
						placeholder="Rechercher une adresse..."
						autocomplete="off"
						autocorrect="off"
					/>
					{#if searchLoading}
						<div class="edit-loading">Recherche...</div>
					{/if}
					{#each searchResults as result (result.placeId)}
						<button class="edit-result" on:click={() => selectAddress(result)}>
							<div class="edit-result-label">{result.label}</div>
							<div class="edit-result-detail">{result.detail}</div>
						</button>
					{/each}
				</div>
			{:else}
				<!-- Home -->
				<div class="address-row">
					<span class="address-icon">🏠</span>
					{#if $settings.home}
						<div class="address-info">
							<div class="address-label">{$settings.home.label}</div>
							<div class="address-detail">{$settings.home.detail}</div>
						</div>
						<button class="address-edit" on:click={() => startEdit('home')}>Modifier</button>
						<button class="address-remove" on:click={() => removeAddress('home')}>✕</button>
					{:else}
						<button class="address-add" on:click={() => startEdit('home')}>Ajouter l'adresse de la maison</button>
					{/if}
				</div>

				<!-- Work -->
				<div class="address-row">
					<span class="address-icon">💼</span>
					{#if $settings.work}
						<div class="address-info">
							<div class="address-label">{$settings.work.label}</div>
							<div class="address-detail">{$settings.work.detail}</div>
						</div>
						<button class="address-edit" on:click={() => startEdit('work')}>Modifier</button>
						<button class="address-remove" on:click={() => removeAddress('work')}>✕</button>
					{:else}
						<button class="address-add" on:click={() => startEdit('work')}>Ajouter l'adresse du travail</button>
					{/if}
				</div>
			{/if}
		</section>

		<!-- Options d'itinéraire -->
		<section class="section">
			<h2 class="section-title">Itinéraire</h2>

			<label class="toggle-row">
				<div class="toggle-info">
					<div class="toggle-label">Éviter les autoroutes</div>
					<div class="toggle-desc">Calculer les itinéraires sans autoroute</div>
				</div>
				<div class="toggle-switch" class:active={$settings.avoidHighways} on:click={toggleAvoidHighways} on:keydown={toggleAvoidHighways} role="switch" aria-checked={$settings.avoidHighways} tabindex="0">
					<div class="toggle-thumb"></div>
				</div>
			</label>

			<label class="toggle-row">
				<div class="toggle-info">
					<div class="toggle-label">Itinéraire sans radar</div>
					<div class="toggle-desc">Privilégier les routes avec le moins de radars</div>
				</div>
				<div class="toggle-switch" class:active={$settings.radarFreeRoute} on:click={toggleRadarFreeRoute} on:keydown={toggleRadarFreeRoute} role="switch" aria-checked={$settings.radarFreeRoute} tabindex="0">
					<div class="toggle-thumb"></div>
				</div>
			</label>
		</section>

		<!-- Admin -->
		<section class="section admin-section">
			<button class="admin-btn" on:click={() => dispatch('admin')}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3"/>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
				</svg>
				Administration
			</button>
		</section>
	</div>
</div>

<style>
	.settings-page {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: #1e1e2e;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.settings-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 16px 12px;
		padding-top: calc(env(safe-area-inset-top, 16px) + 8px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		flex-shrink: 0;
	}

	.back-btn {
		background: none;
		border: none;
		color: #4285F4;
		padding: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	h1 {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 20px;
		font-weight: 700;
		color: #ffffff;
		margin: 0;
	}

	.settings-body {
		flex: 1;
		overflow-y: auto;
		padding: 0 16px 32px;
		-webkit-overflow-scrolling: touch;
	}

	.section {
		margin-top: 24px;
	}

	.section-title {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0 0 12px;
	}

	/* Addresses */
	.address-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.address-icon {
		font-size: 20px;
		flex-shrink: 0;
	}

	.address-info {
		flex: 1;
		min-width: 0;
	}

	.address-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: #ffffff;
	}

	.address-detail {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.45);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.address-add {
		flex: 1;
		background: none;
		border: none;
		color: #4285F4;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		padding: 0;
	}

	.address-edit {
		background: none;
		border: none;
		color: #4285F4;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 8px;
		flex-shrink: 0;
	}

	.address-remove {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: rgba(255, 255, 255, 0.5);
		width: 24px;
		height: 24px;
		border-radius: 50%;
		font-size: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	/* Edit address */
	.edit-address {
		background: rgba(255, 255, 255, 0.04);
		border-radius: 12px;
		padding: 14px;
	}

	.edit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.edit-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
	}

	.edit-cancel {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		cursor: pointer;
	}

	.edit-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 10px;
		padding: 12px;
		color: #ffffff;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		outline: none;
		box-sizing: border-box;
	}

	.edit-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	.edit-loading {
		padding: 10px 0;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.4);
	}

	.edit-result {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding: 10px 0;
		cursor: pointer;
	}

	.edit-result:active {
		background: rgba(255, 255, 255, 0.05);
	}

	.edit-result-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
	}

	.edit-result-detail {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.45);
	}

	/* Toggle switches */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		cursor: pointer;
	}

	.toggle-info {
		flex: 1;
		min-width: 0;
	}

	.toggle-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: #ffffff;
	}

	.toggle-desc {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 2px;
	}

	.toggle-switch {
		width: 48px;
		height: 28px;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.15);
		position: relative;
		flex-shrink: 0;
		transition: background 0.2s ease;
	}

	.toggle-switch.active {
		background: #4285F4;
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #ffffff;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.toggle-switch.active .toggle-thumb {
		transform: translateX(20px);
	}

	/* Admin */
	.admin-section {
		margin-top: 40px;
		padding-top: 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.admin-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 14px;
		color: rgba(255, 255, 255, 0.5);
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.admin-btn:active {
		background: rgba(255, 255, 255, 0.08);
	}
</style>
