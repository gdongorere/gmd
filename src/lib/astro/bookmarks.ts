// src/lib/astro/bookmarks.ts
// Bookmarked moments, kept in localStorage. Storage can be blocked or full, so every access is guarded and the
// feature degrades to "not saved" instead of throwing.

export interface Bookmark { id: string; label: string; jd: number }

export const BOOKMARK_KEY = 'gmd.timeBookmarks.v1';
export const MAX_BOOKMARKS = 24;

/** Validates untrusted JSON from storage: right shape, finite JD, bounded label, no duplicates. */
export function parseBookmarks(raw: string | null): Bookmark[] {
	if (!raw) return [];
	try {
		const data: unknown = JSON.parse(raw);
		if (!Array.isArray(data)) return [];
		const seen = new Set<string>();
		const out: Bookmark[] = [];
		for (const item of data) {
			if (!item || typeof item !== 'object') continue;
			const { id, label, jd } = item as Record<string, unknown>;
			if (typeof id !== 'string' || typeof label !== 'string' || typeof jd !== 'number' || !Number.isFinite(jd)) continue;
			if (seen.has(id) || id.length > 64) continue;
			seen.add(id);
			out.push({ id, label: label.slice(0, 80), jd });
			if (out.length >= MAX_BOOKMARKS) break;
		}
		return out;
	} catch { return []; }
}

export function addBookmark(list: Bookmark[], label: string, jd: number, now = Date.now()): Bookmark[] {
	if (!Number.isFinite(jd)) return list;
	// Re-bookmarking the same moment just renames it.
	const same = list.find((b) => Math.abs(b.jd - jd) < 1 / 86400);
	const next = same
		? list.map((b) => (b === same ? { ...b, label: label.slice(0, 80) || b.label } : b))
		: [{ id: `b${now.toString(36)}${Math.floor(Math.abs(jd) % 997)}`, label: label.slice(0, 80) || 'Bookmark', jd }, ...list];
	return next.slice(0, MAX_BOOKMARKS);
}

export const removeBookmark = (list: Bookmark[], id: string) => list.filter((b) => b.id !== id);

export function loadBookmarks(): Bookmark[] {
	try { return parseBookmarks(window.localStorage.getItem(BOOKMARK_KEY)); } catch { return []; }
}
export function saveBookmarks(list: Bookmark[]): boolean {
	try { window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
