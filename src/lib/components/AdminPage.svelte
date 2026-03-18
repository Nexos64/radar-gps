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
						<span class="status-label">Signal GPS</span>
						<span class="status-value" class:status-ok={$gpsSignal === 'strong'} class:status-warn={$gpsSignal === 'weak'} class:status-err={$gpsSignal === 'lost' || $gpsSignal === 'off'}>
							{$gpsSignal === 'strong' ? 'Fort' : $gpsSignal === 'weak' ? 'Faible' : $gpsSignal === 'lost' ? 'Perdu' : 'Off'}
						</span>
					</div>
					<div class="status-item">
						<span class="status-label">Luftop</span>
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
					<div class="no-errors">Aucune erreur</div>
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
		background: #1e1e2e;
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

	.admin-body {
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

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
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
		background: rgba(255, 255, 255, 0.08);
		border: none;
		border-radius: 10px;
		padding: 14px;
		color: #ffffff;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		outline: none;
		box-sizing: border-box;
	}

	.login-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	.login-error {
		color: #ff5252;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 500;
	}

	.login-btn {
		background: #4285F4;
		border: none;
		border-radius: 10px;
		padding: 14px;
		color: #ffffff;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
	}

	.login-btn:active {
		background: #3367d6;
	}

	/* Status */
	.status-grid {
		display: flex;
		gap: 12px;
	}

	.status-item {
		flex: 1;
		background: rgba(255, 255, 255, 0.04);
		border-radius: 12px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.status-label {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.45);
		font-weight: 500;
	}

	.status-value {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 15px;
		font-weight: 700;
	}

	.status-ok { color: #4caf50; }
	.status-warn { color: #ff9800; }
	.status-err { color: #ff5252; }

	/* Radar counts */
	.radar-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.radar-card {
		background: rgba(255, 255, 255, 0.04);
		border-radius: 12px;
		padding: 16px;
		text-align: center;
	}

	.radar-card.total {
		background: rgba(66, 133, 244, 0.12);
	}

	.radar-count {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 28px;
		font-weight: 800;
		color: #ffffff;
		line-height: 1;
	}

	.radar-source {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.45);
		margin-top: 6px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.loading-text {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.4);
		padding: 12px 0;
	}

	.refresh-btn {
		background: rgba(255, 255, 255, 0.08);
		border: none;
		color: #4285F4;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.refresh-btn:active {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Error log */
	.no-errors {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 14px;
		color: #4caf50;
		padding: 16px;
		background: rgba(76, 175, 80, 0.08);
		border-radius: 12px;
		text-align: center;
		font-weight: 600;
	}

	.clear-btn {
		background: none;
		border: none;
		color: #ff5252;
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		font-weight: 600;
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
		background: rgba(255, 82, 82, 0.08);
		border: 1px solid rgba(255, 82, 82, 0.15);
		border-radius: 10px;
		padding: 12px;
	}

	.error-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.error-source {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 12px;
		font-weight: 700;
		color: #ff5252;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.error-time {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.35);
	}

	.error-msg {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.7);
		word-break: break-word;
	}
</style>
