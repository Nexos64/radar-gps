<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { getRadarsBySource } from '$lib/stores/radardb';
	import { errorLog, clearErrors } from '$lib/stores/errorlog';
	import { gpsSignal } from '$lib/stores/gps';
	import { luftopStale } from '$lib/stores/radars';

	const dispatch = createEventDispatcher<{ close: void }>();

	let authenticated = false;
	let username = '';
	let password = '';
	let loginError = '';

	let luftopCount = 0;
	let osmCount = 0;
	let wazeCount = 0;
	let loading = true;

	function login() {
		if (username === 'admin' && password === '12345') {
			authenticated = true;
			loginError = '';
			loadRadarCounts();
		} else {
			loginError = 'Identifiants incorrects';
		}
	}

	async function loadRadarCounts() {
		loading = true;
		try {
			const [luftop, osm, waze] = await Promise.all([
				getRadarsBySource('luftop'),
				getRadarsBySource('osm'),
				getRadarsBySource('waze')
			]);
			luftopCount = luftop.length;
			osmCount = osm.length;
			wazeCount = waze.length;
		} catch {
			luftopCount = 0;
			osmCount = 0;
			wazeCount = 0;
		}
		loading = false;
	}

	function formatTime(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}
</script>

<div class="admin-page">
	<div class="admin-header">
		<button class="back-btn" on:click={() => dispatch('close')}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
		</button>
		<h1>Administration</h1>
	</div>

	<div class="admin-body">
		{#if !authenticated}
			<section class="section">
				<h2 class="section-title">Connexion</h2>
				<div class="login-form">
					<input
						class="login-input"
						type="text"
						bind:value={username}
						placeholder="Nom d'utilisateur"
						autocomplete="off"
						autocorrect="off"
					/>
					<input
						class="login-input"
						type="password"
						bind:value={password}
						placeholder="Mot de passe"
						on:keydown={(e) => e.key === 'Enter' && login()}
					/>
					{#if loginError}
						<div class="login-error">{loginError}</div>
					{/if}
					<button class="login-btn" on:click={login}>Se connecter</button>
				</div>
			</section>
		{:else}
			<!-- Status -->
			<section class="section">
				<h2 class="section-title">Statut</h2>
				<div class="status-grid">
					<div class="status-item">
						<div class="status-icon-row">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="3"/>
								<path d="M12 2a10 10 0 0 1 10 10"/>
								<path d="M12 6a6 6 0 0 1 6 6"/>
							</svg>
							<span class="status-label">Signal GPS</span>
						</div>
						<span class="status-value" class:status-ok={$gpsSignal === 'strong'} class:status-warn={$gpsSignal === 'weak'} class:status-err={$gpsSignal === 'lost' || $gpsSignal === 'off'}>
							{$gpsSignal === 'strong' ? 'Fort' : $gpsSignal === 'weak' ? 'Faible' : $gpsSignal === 'lost' ? 'Perdu' : 'Off'}
						</span>
					</div>
					<div class="status-item">
						<div class="status-icon-row">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
								<line x1="4" y1="22" x2="4" y2="15"/>
							</svg>
							<span class="status-label">Luftop</span>
						</div>
						<span class="status-value" class:status-ok={!$luftopStale} class:status-warn={$luftopStale}>
							{$luftopStale ? 'Perime' : 'OK'}
						</span>
					</div>
				</div>
			</section>

			<!-- Radars -->
			<section class="section">
				<div class="section-header">
					<h2 class="section-title">Radars en memoire</h2>
					<button class="refresh-btn" on:click={loadRadarCounts}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="23 4 23 10 17 10"/>
							<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
						</svg>
					</button>
				</div>
				{#if loading}
					<div class="loading-text">Chargement...</div>
				{:else}
					<div class="radar-grid">
						<div class="radar-card">
							<div class="radar-count">{luftopCount}</div>
							<div class="radar-source">Luftop</div>
						</div>
						<div class="radar-card">
							<div class="radar-count">{osmCount}</div>
							<div class="radar-source">OSM</div>
						</div>
						<div class="radar-card">
							<div class="radar-count">{wazeCount}</div>
							<div class="radar-source">Waze</div>
						</div>
						<div class="radar-card total">
							<div class="radar-count">{luftopCount + osmCount + wazeCount}</div>
							<div class="radar-source">Total</div>
						</div>
					</div>
				{/if}
			</section>

			<!-- Error log -->
			<section class="section">
				<div class="section-header">
					<h2 class="section-title">Journal d'erreurs</h2>
					{#if $errorLog.length > 0}
						<button class="clear-btn" on:click={clearErrors}>Effacer</button>
					{/if}
				</div>
				{#if $errorLog.length === 0}
					<div class="no-errors">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1FE093" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;vertical-align:-3px;">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
							<polyline points="22 4 12 14.01 9 11.01"/>
						</svg>
						Aucune erreur
					</div>
				{:else}
					<div class="error-list">
						{#each $errorLog as entry}
							<div class="error-item">
								<div class="error-head">
									<span class="error-source">{entry.source}</span>
									<span class="error-time">{formatTime(entry.timestamp)}</span>
								</div>
								<div class="error-msg">{entry.message}</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>
</div>

<style>
	.admin-page {
		position: fixed;
		inset: 0;
		z-index: 55;
		background: #1B1D21;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.admin-header {
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

	.admin-body {
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

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 14px;
	}

	.section-header .section-title {
		margin: 0;
	}

	/* Login */
	.login-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.login-input {
		width: 100%;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 14px;
		padding: 14px 16px;
		color: #ffffff;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 600;
		outline: none;
		box-sizing: border-box;
		transition: border-color 0.2s ease;
	}

	.login-input:focus {
		border-color: #0099FF;
	}

	.login-input::placeholder {
		color: rgba(255, 255, 255, 0.3);
		font-weight: 500;
	}

	.login-error {
		color: #FF5252;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
	}

	.login-btn {
		background: #0099FF;
		border: none;
		border-radius: 14px;
		padding: 14px;
		color: #ffffff;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	.login-btn:active {
		transform: scale(0.98);
	}

	/* Status */
	.status-grid {
		display: flex;
		gap: 12px;
	}

	.status-item {
		flex: 1;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-icon-row {
		display: flex;
		align-items: center;
		gap: 8px;
		color: rgba(255, 255, 255, 0.4);
	}

	.status-label {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		font-weight: 600;
	}

	.status-value {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 16px;
		font-weight: 800;
	}

	.status-ok { color: #1FE093; }
	.status-warn { color: #F08000; }
	.status-err { color: #FF5252; }

	/* Radar counts */
	.radar-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.radar-card {
		background: rgba(255, 255, 255, 0.04);
		border-radius: 16px;
		padding: 18px;
		text-align: center;
	}

	.radar-card.total {
		background: rgba(0, 153, 255, 0.1);
	}

	.radar-count {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 28px;
		font-weight: 900;
		color: #ffffff;
		line-height: 1;
	}

	.radar-source {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 6px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.loading-text {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
		padding: 12px 0;
	}

	.refresh-btn {
		background: rgba(255, 255, 255, 0.06);
		border: none;
		color: #0099FF;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.refresh-btn:active {
		background: rgba(255, 255, 255, 0.12);
	}

	/* Error log */
	.no-errors {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		color: #1FE093;
		padding: 18px;
		background: rgba(31, 224, 147, 0.06);
		border-radius: 16px;
		text-align: center;
		font-weight: 700;
	}

	.clear-btn {
		background: none;
		border: none;
		color: #FF5252;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		padding: 4px 8px;
	}

	.error-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 400px;
		overflow-y: auto;
	}

	.error-item {
		background: rgba(255, 43, 43, 0.06);
		border-left: 3px solid rgba(255, 43, 43, 0.4);
		border-radius: 12px;
		padding: 14px;
	}

	.error-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.error-source {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 800;
		color: #FF5252;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.error-time {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
	}

	.error-msg {
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
		word-break: break-word;
	}
</style>
