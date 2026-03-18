import type { Map as MLMap } from 'maplibre-gl';
import type { RadarType } from '$lib/types';

/** Radar icon config per type */
const ICON_CONFIG: Record<RadarType | 'default', { fill: string; symbol: string }> = {
	fixed:         { fill: '#e53935', symbol: '📷' },
	mobile:        { fill: '#f57c00', symbol: '📱' },
	traffic_light: { fill: '#388e3c', symbol: '🚦' },
	section_start: { fill: '#ab47bc', symbol: '⏱' },
	section_end:   { fill: '#ab47bc', symbol: '⏱' },
	police:        { fill: '#1565c0', symbol: '' },  // custom drawn
	other:         { fill: '#757575', symbol: '⚠️' },
	default:       { fill: '#757575', symbol: '⚠️' }
};

const ICON_SIZE = 48;

/** Draw a police officer icon (cap + silhouette) on blue circle */
function renderPoliceIcon(): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = ICON_SIZE;
	canvas.height = ICON_SIZE;
	const ctx = canvas.getContext('2d')!;
	const cx = ICON_SIZE / 2;
	const cy = ICON_SIZE / 2;
	const r = ICON_SIZE / 2 - 3;

	// Blue circle background
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fillStyle = '#1565c0';
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2.5;
	ctx.stroke();

	// Clip to circle so nothing overflows
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
	ctx.clip();

	const white = '#ffffff';

	// Hat brim (wide ellipse)
	ctx.fillStyle = white;
	ctx.beginPath();
	ctx.ellipse(cx, cy - 5, 13, 4, 0, 0, Math.PI * 2);
	ctx.fill();

	// Hat top (trapezoid)
	ctx.beginPath();
	ctx.moveTo(cx - 9, cy - 6);
	ctx.lineTo(cx - 6, cy - 16);
	ctx.lineTo(cx + 6, cy - 16);
	ctx.lineTo(cx + 9, cy - 6);
	ctx.closePath();
	ctx.fill();

	// Hat badge (gold dot)
	ctx.beginPath();
	ctx.arc(cx, cy - 11, 2.2, 0, Math.PI * 2);
	ctx.fillStyle = '#FFD54F';
	ctx.fill();

	// Head
	ctx.fillStyle = white;
	ctx.beginPath();
	ctx.arc(cx, cy + 2, 6, 0, Math.PI * 2);
	ctx.fill();

	// Shoulders / body
	ctx.beginPath();
	ctx.moveTo(cx - 15, cy + 22);
	ctx.quadraticCurveTo(cx - 14, cy + 9, cx - 6, cy + 9);
	ctx.lineTo(cx + 6, cy + 9);
	ctx.quadraticCurveTo(cx + 14, cy + 9, cx + 15, cy + 22);
	ctx.closePath();
	ctx.fill();

	ctx.restore();

	return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

/** Generate a radar icon as ImageData for MapLibre */
function renderRadarIcon(fill: string, symbol: string): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = ICON_SIZE;
	canvas.height = ICON_SIZE;
	const ctx = canvas.getContext('2d')!;

	// Circle background
	ctx.beginPath();
	ctx.arc(ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2 - 3, 0, Math.PI * 2);
	ctx.fillStyle = fill;
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2.5;
	ctx.stroke();

	// Emoji/symbol in center
	ctx.font = `${ICON_SIZE * 0.45}px sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(symbol, ICON_SIZE / 2, ICON_SIZE / 2 + 1);

	return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

/** Register all radar icons on the map */
export function registerRadarIcons(map: MLMap) {
	for (const [type, config] of Object.entries(ICON_CONFIG)) {
		let imgData: ImageData;
		if (type === 'police') {
			imgData = renderPoliceIcon();
		} else {
			imgData = renderRadarIcon(config.fill, config.symbol);
		}
		map.addImage(`radar-${type}`, {
			width: ICON_SIZE,
			height: ICON_SIZE,
			data: new Uint8Array(imgData.data)
		});
	}
}

/** Get the MapLibre image name for a radar type */
export function radarImageName(type: RadarType): string {
	return `radar-${type}`;
}
