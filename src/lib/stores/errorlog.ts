import { writable } from 'svelte/store';

export interface ErrorEntry {
	timestamp: number;
	source: string;
	message: string;
}

const MAX_ENTRIES = 100;

export const errorLog = writable<ErrorEntry[]>([]);

export function logError(source: string, message: string) {
	errorLog.update((entries) => {
		const entry: ErrorEntry = { timestamp: Date.now(), source, message };
		const updated = [entry, ...entries];
		if (updated.length > MAX_ENTRIES) updated.length = MAX_ENTRIES;
		return updated;
	});
}

export function clearErrors() {
	errorLog.set([]);
}
