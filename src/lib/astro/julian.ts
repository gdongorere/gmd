// src/lib/astro/julian.ts
// Julian dates and calendar conversion for ANY year, including prehistoric ones.
//
// JavaScript's Date only reaches ±273,790 years, and its year numbering has no year
// zero, so the time machine keeps its own clock as a Julian Date (a double). Calendar
// dates use the proleptic Gregorian calendar throughout, with astronomical year
// numbering (year 0 = 1 BCE, -1 = 2 BCE …), which is what ISO 8601 uses too.

export const J2000 = 2451545.0;
export const UNIX_EPOCH_JD = 2440587.5;
export const MS_PER_DAY = 86_400_000;
export const DAYS_PER_YEAR = 365.25; // Julian year, the unit of "years" in this engine
export const DAYS_PER_CENTURY = 36525;

/** Largest |ms| a JavaScript Date can represent. */
export const DATE_LIMIT_MS = 8.64e15;

export interface CalendarDate {
	year: number;
	month: number; // 1–12
	day: number; // 1–31
	hour: number;
	minute: number;
	second: number;
}

export const jdFromUnixMs = (ms: number) => ms / MS_PER_DAY + UNIX_EPOCH_JD;
export const unixMsFromJd = (jd: number) => (jd - UNIX_EPOCH_JD) * MS_PER_DAY;

/** Julian Date for a proleptic-Gregorian calendar date (Meeus, ch. 7). */
export function jdFromCalendar(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
	let y = year;
	let m = month;
	if (m <= 2) {
		y -= 1;
		m += 12;
	}
	const a = Math.floor(y / 100);
	const b = 2 - a + Math.floor(a / 4);
	const dayFraction = (hour + (minute + second / 60) / 60) / 24;
	return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + dayFraction + b - 1524.5;
}

/** Proleptic-Gregorian calendar date for a Julian Date. */
export function calendarFromJd(jd: number): CalendarDate {
	const shifted = jd + 0.5;
	const z = Math.floor(shifted);
	let f = shifted - z;
	const alpha = Math.floor((z - 1867216.25) / 36524.25);
	const a = z + 1 + alpha - Math.floor(alpha / 4);
	const b = a + 1524;
	const c = Math.floor((b - 122.1) / 365.25);
	const d = Math.floor(365.25 * c);
	const e = Math.floor((b - d) / 30.6001);
	const day = b - d - Math.floor(30.6001 * e);
	const month = e < 14 ? e - 1 : e - 13;
	const year = month > 2 ? c - 4716 : c - 4715;

	// Split the day fraction without letting rounding push a time to 24:00:00.
	let totalSeconds = Math.round(f * 86400 * 1000) / 1000;
	if (totalSeconds >= 86400) {
		totalSeconds = 0;
		f = 0;
		// carry into the next day via recursion on a nudged JD
		return calendarFromJd(Math.floor(jd + 0.5) + 0.5 + 1e-9);
	}
	const hour = Math.floor(totalSeconds / 3600);
	const minute = Math.floor((totalSeconds - hour * 3600) / 60);
	const second = totalSeconds - hour * 3600 - minute * 60;
	return { year, month, day, hour, minute, second };
}

/** Decimal year (e.g. 2026.76) from a Julian Date. Good enough for slowly varying models. */
export const decimalYearFromJd = (jd: number) => 2000 + (jd - J2000) / DAYS_PER_YEAR;
export const jdFromDecimalYear = (year: number) => J2000 + (year - 2000) * DAYS_PER_YEAR;

/** Julian centuries since J2000. */
export const centuriesSinceJ2000 = (jd: number) => (jd - J2000) / DAYS_PER_CENTURY;

const pad = (n: number, width = 2) => String(Math.trunc(n)).padStart(width, '0');

/** "2026-10-05" / "-19999-03-02" (ISO 8601 extended years) */
export function formatIsoDate(c: CalendarDate): string {
	const y = c.year < 0 ? `-${pad(-c.year, 4)}` : pad(c.year, 4);
	return `${y}-${pad(c.month)}-${pad(c.day)}`;
}

export function formatTime(c: CalendarDate, withSeconds = true): string {
	const s = Math.floor(c.second);
	return withSeconds ? `${pad(c.hour)}:${pad(c.minute)}:${pad(s)}` : `${pad(c.hour)}:${pad(c.minute)}`;
}

/** Human-friendly year label: "2026", "44 BCE", "19,999 BCE" (astronomical year −19998). */
export function formatYearHuman(year: number): string {
	if (year > 0) return year.toLocaleString('en-US');
	return `${(1 - year).toLocaleString('en-US')} BCE`;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "5 Oct 2026" / "2 Mar 19,999 BCE" */
export function formatDateHuman(c: CalendarDate): string {
	return `${c.day} ${MONTHS[c.month - 1]} ${formatYearHuman(c.year)}`;
}
