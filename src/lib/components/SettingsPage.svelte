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
		<h1>Parametres</h1>
	</div>

	<div class="settings-body">
		<!-- Adresses -->
		<section class="section">
			<h2 class="section-title">Adresses favorites</h2>

			{#if editingField}
				<div class="edit-address">
					<div class="edit-header">
						<span class="edit-label">
							{#if editingField === 'home'}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0099FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
								Maison
							{:else}
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F08000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
								Travail
							{/if}
						</span>
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
					<div class="address-icon-wrap home">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
							<polyline points="9 22 9 12 15 12 15 22"/>
						</svg>
					</div>
					{#if $settings.home}
						<div class="address-info">
							<div class="address-label">{$settings.home.label}</div>
							<div class="address-detail">{$settings.home.detail}</div>
						</div>
						<button class="address-edit" on:click={() => startEdit('home')}>Modifier</button>
						<button class="address-remove" on:click={() => removeAddress('home')}>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					{:else}
						<button class="address-add" on:click={() => startEdit('home')}>Ajouter l'adresse de la maison</button>
					{/if}
				</div>

				<!-- Work -->
				<div class="address-row">
					<div class="address-icon-wrap work">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
							<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
						</svg>
					</div>
					{#if $settings.work}
						<div class="address-info">
							<div class="address-label">{$settings.work.label}</div>
							<div class="address-detail">{$settings.work.detail}</div>
						</div>
						<button class="address-edit" on:click={() => startEdit('work')}>Modifier</button>
						<button class="address-remove" on:click={() => removeAddress('work')}>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					{:else}
						<button class="address-add" on:click={() => startEdit('work')}>Ajouter l'adresse du travail</button>
					{/if}
				</div>
			{/if}
		</section>

		<!-- Options d'itineraire -->
		<section class="section">
			<h2 class="section-title">Itineraire</h2>

			<label class="toggle-row">
				<div class="toggle-info">
					<div class="toggle-label">Eviter les autoroutes</div>
					<div class="toggle-desc">Calculer les itineraires sans autoroute</div>
				</div>
				<div class="toggle-switch" class:active={$settings.avoidHighways} on:click={toggleAvoidHighways} on:keydown={toggleAvoidHighways} role="switch" aria-checked={$settings.avoidHighways} tabindex="0">
					<div class="toggle-thumb"></div>
				</div>
			</label>

			<label class="toggle-row">
				<div class="toggle-info">
					<div class="toggle-label">Itineraire sans radar</div>
					<div class="toggle-desc">Privilegier les routes avec le moins de radars</div>
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
		background: #1B1D21;
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
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}

	.back-btn {
		background: none;
		border: none;
		color: #0099FF;
		padding: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	h1 {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 20px;
		font-weight: 800;
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
		margin-top: 28px;
	}

	.section-title {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.35);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0 0 14px;
	}

	/* Addresses */
	.address-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.address-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.address-icon-wrap.home {
		background: rgba(0, 153, 255, 0.12);
		color: #0099FF;
	}

	.address-icon-wrap.work {
		background: rgba(240, 128, 0, 0.12);
		color: #F08000;
	}

	.address-info {
		flex: 1;
		min-width: 0;
	}

	.address-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 700;
		color: #ffffff;
	}

	.address-detail {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.address-add {
		flex: 1;
		background: none;
		border: none;
		color: #0099FF;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
		padding: 0;
	}

	.address-edit {
		background: none;
		border: none;
		color: #0099FF;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		padding: 4px 8px;
		flex-shrink: 0;
	}

	.address-remove {
		background: rgba(255, 255, 255, 0.08);
		border: none;
		color: rgba(255, 255, 255, 0.45);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.address-remove:active {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Edit address */
	.edit-address {
		background: rgba(255, 255, 255, 0.04);
		border-radius: 16px;
		padding: 16px;
	}

	.edit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.edit-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.edit-cancel {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.45);
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.edit-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 12px;
		padding: 14px;
		color: #ffffff;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 600;
		outline: none;
		box-sizing: border-box;
	}

	.edit-input::placeholder {
		color: rgba(255, 255, 255, 0.3);
		font-weight: 500;
	}

	.edit-loading {
		padding: 12px 0;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
	}

	.edit-result {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		padding: 12px 0;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.edit-result:active {
		background: rgba(255, 255, 255, 0.05);
	}

	.edit-result-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		color: #ffffff;
	}

	.edit-result-detail {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
	}

	/* Toggle switches */
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		cursor: pointer;
	}

	.toggle-info {
		flex: 1;
		min-width: 0;
	}

	.toggle-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 700;
		color: #ffffff;
	}

	.toggle-desc {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.35);
		margin-top: 2px;
	}

	.toggle-switch {
		width: 50px;
		height: 30px;
		border-radius: 15px;
		background: rgba(255, 255, 255, 0.12);
		position: relative;
		flex-shrink: 0;
		transition: background 0.25s ease;
	}

	.toggle-switch.active {
		background: #0099FF;
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #ffffff;
		transition: transform 0.25s ease;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
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
		gap: 10px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 16px;
		padding: 16px;
		color: rgba(255, 255, 255, 0.45);
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.admin-btn:active {
		background: rgba(255, 255, 255, 0.08);
	}
</style>
