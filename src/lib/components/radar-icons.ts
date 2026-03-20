import type { Map as MLMap } from 'maplibre-gl';
import type { RadarType } from '$lib/types';

const ICON_SIZE = 48;

/** Draw a modern camera icon — flat design with Waze-inspired orange circle */
function renderCameraIcon(): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = ICON_SIZE;
	canvas.height = ICON_SIZE;
	const ctx = canvas.getContext('2d')!;
	const cx = ICON_SIZE / 2;
	const cy = ICON_SIZE / 2;
	const r = ICON_SIZE / 2 - 2;

	// Orange circle background
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fillStyle = '#F08000';
	ctx.fill();

	// Subtle border
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// Camera body — rounded rectangle
	const bw = 22, bh = 14;
	const bx = cx - bw / 2, by = cy - bh / 2 + 2;
	const br = 3;
	ctx.beginPath();
	ctx.moveTo(bx + br, by);
	ctx.lineTo(bx + bw - br, by);
	ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
	ctx.lineTo(bx + bw, by + bh - br);
	ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
	ctx.lineTo(bx + br, by + bh);
	ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
	ctx.lineTo(bx, by + br);
	ctx.quadraticCurveTo(bx, by, bx + br, by);
	ctx.closePath();
	ctx.fillStyle = '#ffffff';
	ctx.fill();

	// Camera bump on top (viewfinder)
	ctx.beginPath();
	ctx.moveTo(cx - 5, by);
	ctx.lineTo(cx - 3, by - 5);
	ctx.lineTo(cx + 3, by - 5);
	ctx.lineTo(cx + 5, by);
	ctx.fillStyle = '#ffffff';
	ctx.fill();

	// Lens circle (orange on white)
	ctx.beginPath();
	ctx.arc(cx, cy + 2, 5, 0, Math.PI * 2);
	ctx.fillStyle = '#F08000';
	ctx.fill();

	// Inner lens dot
	ctx.beginPath();
	ctx.arc(cx, cy + 2, 2, 0, Math.PI * 2);
	ctx.fillStyle = '#ffffff';
	ctx.fill();

	return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

/** Draw a police icon — blue circle with shield */
function renderPoliceIcon(): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = ICON_SIZE;
	canvas.height = ICON_SIZE;
	const ctx = canvas.getContext('2d')!;
	const cx = ICON_SIZE / 2;
	const cy = ICON_SIZE / 2;
	const r = ICON_SIZE / 2 - 2;

	// Blue circle background
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fillStyle = '#0099FF';
	ctx.fill();

	// Subtle border
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// Shield shape (white)
	ctx.fillStyle = '#ffffff';
	ctx.beginPath();
	ctx.moveTo(cx, cy - 12);
	ctx.lineTo(cx + 10, cy - 7);
	ctx.lineTo(cx + 10, cy + 2);
	ctx.quadraticCurveTo(cx + 9, cy + 10, cx, cy + 14);
	ctx.quadraticCurveTo(cx - 9, cy + 10, cx - 10, cy + 2);
	ctx.lineTo(cx - 10, cy - 7);
	ctx.closePath();
	ctx.fill();

	// Inner shield detail (blue star-like mark)
	ctx.fillStyle = '#0099FF';
	ctx.beginPath();
	ctx.arc(cx, cy + 1, 4, 0, Math.PI * 2);
	ctx.fill();

	return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

/** Register all radar icons on the map — all types use the same camera icon except police */
export function registerRadarIcons(map: MLMap) {
	const cameraImg = renderCameraIcon();
	const policeImg = renderPoliceIcon();

	const types: (RadarType | 'default')[] = [
		'fixed', 'mobile', 'traffic_light', 'section_start', 'section_end', 'other', 'default'
	];

	for (const type of types) {
		map.addImage(`radar-${type}`, {
			width: ICON_SIZE,
			height: ICON_SIZE,
			data: new Uint8Array(cameraImg.data)
		});
	}

	map.addImage('radar-police', {
		width: ICON_SIZE,
		height: ICON_SIZE,
		data: new Uint8Array(policeImg.data)
	});
}

/** Get the MapLibre image name for a radar type */
export function radarImageName(type: RadarType): string {
	return `radar-${type}`;
}
