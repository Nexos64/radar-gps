/**
 * Audio alert system — Web Audio API + HTML Audio fallback + Vibration
 *
 * Génère un bip d'alerte synthétique.
 * Utilise Web Audio API en priorité, avec un fallback HTML Audio
 * pour contourner le mode silencieux sur iOS/Android.
 *
 * Deux niveaux :
 *   - "warning" : bip double à 800 Hz (radar détecté)
 *   - "danger"  : bip rapide à 1000 Hz (très proche, < 100m)
 *
 * La vibration est jouée en parallèle si le device la supporte.
 */

let audioCtx: AudioContext | null = null;

/** Volume fort pour percer le mode silencieux */
const ALERT_GAIN = 0.8;

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

/** Joue une série de bips via Web Audio API */
function playTone(frequency: number, durationMs: number, count: number, gapMs: number) {
	const ctx = getAudioContext();

	for (let i = 0; i < count; i++) {
		const startTime = ctx.currentTime + (i * (durationMs + gapMs)) / 1000;
		const endTime = startTime + durationMs / 1000;

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = 'square'; // square wave is louder/more piercing than sine
		osc.frequency.value = frequency;

		// Fade in/out pour éviter les clics
		gain.gain.setValueAtTime(0, startTime);
		gain.gain.linearRampToValueAtTime(ALERT_GAIN, startTime + 0.02);
		gain.gain.setValueAtTime(ALERT_GAIN, endTime - 0.02);
		gain.gain.linearRampToValueAtTime(0, endTime);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(startTime);
		osc.stop(endTime);
	}
}

/**
 * Fallback: generate a data URI WAV beep and play it via HTML Audio.
 * HTML <audio> can sometimes bypass silent mode on certain devices.
 */
function playHtmlAudioBeep() {
	try {
		// Generate a simple 800Hz WAV beep (200ms)
		const sampleRate = 22050;
		const duration = 0.2;
		const numSamples = Math.floor(sampleRate * duration);
		const buffer = new ArrayBuffer(44 + numSamples * 2);
		const view = new DataView(buffer);

		// WAV header
		const writeString = (offset: number, str: string) => {
			for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
		};
		writeString(0, 'RIFF');
		view.setUint32(4, 36 + numSamples * 2, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true); // PCM
		view.setUint16(22, 1, true); // mono
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * 2, true);
		view.setUint16(32, 2, true);
		view.setUint16(34, 16, true);
		writeString(36, 'data');
		view.setUint32(40, numSamples * 2, true);

		// Generate square wave at 800Hz
		for (let i = 0; i < numSamples; i++) {
			const t = i / sampleRate;
			const val = Math.sin(2 * Math.PI * 800 * t) > 0 ? 16000 : -16000;
			view.setInt16(44 + i * 2, val, true);
		}

		const blob = new Blob([buffer], { type: 'audio/wav' });
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);
		audio.volume = 1.0;
		audio.play().catch(() => {}).finally(() => {
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		});
	} catch {
		// Ignore
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
	playHtmlAudioBeep(); // fallback for silent mode
	vibrate([100, 50, 100]);
}

/** Alerte danger : radar très proche (< 100m) */
export function playDangerAlert() {
	playTone(1000, 100, 3, 80);
	playHtmlAudioBeep(); // fallback for silent mode
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

		// Also unlock HTML Audio path
		const audio = new Audio();
		audio.volume = 0;
		audio.play().catch(() => {});
	} catch {
		// Ignore errors
	}
}
