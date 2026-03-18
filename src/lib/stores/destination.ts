import { writable } from 'svelte/store';

export interface Destination {
	lat: number;
	lng: number;
	label: string;
	detail: string;
}

/** Current selected destination (null = no destination) */
export const destination = writable<Destination | null>(null);

export function clearDestination() {
	destination.set(null);
}
