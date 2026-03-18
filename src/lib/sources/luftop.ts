import type { Radar } from '$lib/types';

export async function fetchLuftopRadars(): Promise<Radar[]> {
	const res = await fetch('/data/radars-luftop.json');
	if (!res.ok) throw new Error(`Luftop data HTTP ${res.status}`);
	return res.json();
}
