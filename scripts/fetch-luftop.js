/**
 * Fetch radar data from Luftop API for FR, CH, DE
 * and write to static/data/radars-luftop.json
 *
 * Usage: LUFTOP_API_KEY=xxx node scripts/fetch-luftop.js
 */

const API_KEY = process.env.LUFTOP_API_KEY;
if (!API_KEY) {
	console.error('Missing LUFTOP_API_KEY env var');
	process.exit(1);
}

const COUNTRIES = ['fr', 'ch', 'de'];
const API_BASE = 'https://api.lufop.net/api';

// Map Luftop type codes to our radar types
function mapType(typeCode) {
	const code = parseInt(typeCode, 10);
	if (code === 40) return 'traffic_light';
	if (code === 137) return 'section_start';
	if (code === 138) return 'section_end';
	if (code === 154) return 'fixed'; // chantier = fixed
	return 'fixed';
}

function mapFlash(flash) {
	return flash === 'D'; // D = both directions
}

async function fetchCountry(pays) {
	const url = `${API_BASE}?key=${API_KEY}&format=json&nbr=10000&pays=${pays}`;
	console.log(`Fetching ${pays.toUpperCase()}...`);
	const res = await fetch(url, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
			'Referer': 'https://lufop.net/',
			'Accept': 'application/json'
		}
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${pays}`);
	const data = await res.json();
	console.log(`  → ${data.length} radars`);
	return data;
}

async function main() {
	const allRaw = [];
	for (const pays of COUNTRIES) {
		const data = await fetchCountry(pays);
		allRaw.push(...data);
	}

	const radars = allRaw.map((r) => ({
		id: `luftop-${r.ID}`,
		lat: parseFloat(r.lat),
		lng: parseFloat(r.lng),
		type: mapType(r.type),
		speedLimit: r.vitesse ? parseInt(r.vitesse, 10) : null,
		angle: r.azimut ? parseInt(r.azimut, 10) : null,
		bidirectional: mapFlash(r.flash),
		source: 'luftop'
	}));

	const fs = await import('node:fs');
	const path = await import('node:path');
	const outPath = path.join(process.cwd(), 'static', 'data', 'radars-luftop.json');
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, JSON.stringify(radars));
	console.log(`\nWrote ${radars.length} radars to ${outPath}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
