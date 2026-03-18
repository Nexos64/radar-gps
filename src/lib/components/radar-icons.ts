import type { Map as MLMap } from 'maplibre-gl';
import type { RadarType } from '$lib/types';

/** Radar icon config per type */
const ICON_CONFIG: Record<RadarType | 'default', { fill: string; symbol: string }> = {
	fixed:         { fill: '#e53935', symbol: '📷' },
	mobile:        { fill: '#f57c00', symbol: '📱' },
	traffic_light: { fill: '#388e3c', symbol: '🚦' },
	section_start: { fill: '#ab47bc', symbol: '⏱' },
	section_end:   { fill: '#ab47bc', symbol: '⏱' },
	police:        { fill: '#1565c0', symbol: '👮' },
	other:         { fill: '#757575', symbol: '⚠️' },
	default:       { fill: '#757575', symbol: '⚠️' }
};

const ICON_SIZE = 48;

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
		const imgData = renderRadarIcon(config.fill, config.symbol);
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
