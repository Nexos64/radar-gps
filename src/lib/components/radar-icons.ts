import type { Map as MLMap } from 'maplibre-gl';
import type { RadarType } from '$lib/types';

const ICON_SIZE = 48;

/** Draw a modern camera icon (outline style, white on dark background) */
function renderCameraIcon(): ImageData {
	const canvas = document.createElement('canvas');
	canvas.width = ICON_SIZE;
	canvas.height = ICON_SIZE;
	const ctx = canvas.getContext('2d')!;
	const cx = ICON_SIZE / 2;
	const cy = ICON_SIZE / 2;

	// Dark semi-transparent circle background for visibility
	ctx.beginPath();
	ctx.arc(cx, cy, ICON_SIZE / 2 - 2, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(30, 30, 30, 0.85)';
	ctx.fill();
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2;
	ctx.stroke();

	// Camera body — rounded rectangle
	const bw = 24, bh = 16;
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
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2.2;
	ctx.stroke();

	// Camera bump on top (viewfinder)
	ctx.beginPath();
	ctx.moveTo(cx - 5, by);
	ctx.lineTo(cx - 3, by - 5);
	ctx.lineTo(cx + 3, by - 5);
	ctx.lineTo(cx + 5, by);
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2.2;
	ctx.stroke();

	// Lens circle
	ctx.beginPath();
	ctx.arc(cx, cy + 2, 5.5, 0, Math.PI * 2);
	ctx.strokeStyle = '#ffffff';
	ctx.lineWidth = 2;
	ctx.stroke();

	// Small dot (flash/sensor) top right
	ctx.beginPath();
	ctx.arc(bx + bw - 5, by + 4.5, 1.5, 0, Math.PI * 2);
	ctx.fillStyle = '#ffffff';
	ctx.fill();

	return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

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
