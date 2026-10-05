import { describe, expect, it } from 'vitest';
import { neighbourRate, stepSeconds, timeActionForKey } from '../shortcuts';
import { MAX_BOOKMARKS, addBookmark, parseBookmarks, removeBookmark } from '../bookmarks';
import { TIME_TOUR } from '../tour';
import { jdFromCalendar } from '../julian';
import { RATE_PRESETS } from '../clock';

describe('keyboard shortcuts', () => {
	it('maps keys to actions', () => {
		expect(timeActionForKey(',')).toBe('step-back');
		expect(timeActionForKey('.')).toBe('step-forward');
		expect(timeActionForKey('[')).toBe('slower');
		expect(timeActionForKey(']')).toBe('faster');
		expect(timeActionForKey('n')).toBe('now');
		expect(timeActionForKey('J')).toBe('open-time-machine');
		expect(timeActionForKey('b')).toBe('bookmark');
		expect(timeActionForKey('t')).toBeNull();
		expect(timeActionForKey('T', true)).toBe('time-tour');
		expect(timeActionForKey('x')).toBeNull();
	});
	it('steps are never below a minute and scale with the speed', () => {
		expect(stepSeconds(1)).toBe(60);
		expect(stepSeconds(-86400)).toBe(86400);
	});
	it('neighbourRate walks the presets and keeps the sign and the ends', () => {
		const speeds = RATE_PRESETS.map((p) => p.secondsPerSecond);
		expect(neighbourRate(1, 1)).toBe(speeds[1]);
		expect(neighbourRate(-3600, -1)).toBe(-speeds[1]);
		expect(neighbourRate(1, -1)).toBe(speeds[0]);
		expect(neighbourRate(speeds[speeds.length - 1], 1)).toBe(speeds[speeds.length - 1]);
		expect(neighbourRate(0, 1)).toBe(speeds[1]);
	});
});

describe('bookmarks', () => {
	it('rejects junk and keeps valid entries', () => {
		expect(parseBookmarks(null)).toEqual([]);
		expect(parseBookmarks('not json')).toEqual([]);
		expect(parseBookmarks('{"a":1}')).toEqual([]);
		const raw = JSON.stringify([{ id: 'a', label: 'ok', jd: 2460000 }, { id: 'b', label: 'x', jd: 'nope' }, { id: 'a', label: 'dup', jd: 1 }, null, { id: 'c', label: 'inf', jd: null }]);
		expect(parseBookmarks(raw)).toEqual([{ id: 'a', label: 'ok', jd: 2460000 }]);
	});
	it('caps length and label size; ignores non-finite times', () => {
		let list: ReturnType<typeof parseBookmarks> = [];
		for (let i = 0; i < MAX_BOOKMARKS + 5; i++) list = addBookmark(list, 'x'.repeat(200), 2460000 + i, i);
		expect(list.length).toBe(MAX_BOOKMARKS);
		expect(list[0].label.length).toBe(80);
		expect(addBookmark(list, 'bad', NaN)).toBe(list);
	});
	it('bookmarking the same moment renames instead of duplicating; removal works', () => {
		let list = addBookmark([], 'first', 2460000.5, 1);
		list = addBookmark(list, 'renamed', 2460000.5, 2);
		expect(list).toHaveLength(1);
		expect(list[0].label).toBe('renamed');
		expect(removeBookmark(list, list[0].id)).toEqual([]);
	});
});

describe('time-travel tour', () => {
	const now = jdFromCalendar(2026, 10, 5, 12);
	it('goes from today back through Mars, the ice age and deep time, strictly into the past', () => {
		const jds = TIME_TOUR.map((s) => s.jd(now));
		expect(jds[0]).toBe(now);
		for (let i = 1; i < jds.length; i++) expect(jds[i]).toBeLessThan(jds[i - 1]);
		expect(TIME_TOUR.map((s) => s.view)).toEqual(['3d', 'mars', 'earth', 'galaxy', 'galaxy']);
		expect(new Set(TIME_TOUR.map((s) => s.id)).size).toBe(TIME_TOUR.length);
	});
});
