/**
 * Audio alert system — Web Audio API + Vibration
 *
 * Génère un bip d'alerte synthétique (pas de fichier audio).
 * Deux niveaux :
 *   - "warning" : bip double à 800 Hz (radar détecté)
 *   - "danger"  : bip rapide à 1000 Hz (très proche, < 100m)
 *
 * La vibration est jouée en parallèle si le device la supporte.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
	// Reprendre si suspendu (nécessite une interaction utilisateur sur mobile)
	if (audioCtx.state === 'suspended') {
		audioCtx.resume();
	}
	return audioCtx;
}

/** Joue une série de bips */
function playTone(frequency: number, durationMs: number, count: number, gapMs: number) {
	const ctx = getAudioContext();

	for (let i = 0; i < count; i++) {
		const startTime = ctx.currentTime + (i * (durationMs + gapMs)) / 1000;
		const endTime = startTime + durationMs / 1000;

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = 'sine';
		osc.frequency.value = frequency;

		// Fade in/out pour éviter les clics
		gain.gain.setValueAtTime(0, startTime);
		gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
		gain.gain.setValueAtTime(0.3, endTime - 0.02);
		gain.gain.linearRampToValueAtTime(0, endTime);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(startTime);
		osc.stop(endTime);
	}
}

/** Vibration pattern */
function vibrate(pattern: number[]) {
	if (navigator.vibrate) {
		navigator.vibrate(pattern);
	}
}

// ── API publique ──

/** Alerte standard : radar détecté dans le rayon d'alerte */
export function playWarningAlert() {
	playTone(800, 150, 2, 100);
	vibrate([100, 50, 100]);
}

/** Alerte danger : radar très proche (< 100m) */
export function playDangerAlert() {
	playTone(1000, 100, 3, 80);
	vibrate([200, 50, 200, 50, 200]);
}

/**
 * Doit être appelé une fois suite à une interaction utilisateur (tap, click)
 * pour débloquer l'AudioContext sur mobile (iOS/Android).
 */
export function unlockAudio() {
	try {
		const ctx = getAudioContext();
		// Jouer un son silencieux pour débloquer
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		gain.gain.value = 0;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.01);
	} catch {
		// Ignore errors
	}
}
