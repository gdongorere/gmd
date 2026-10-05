// src/lib/astro/accuracy.ts
// What can honestly be claimed about each part of the simulation at a given instant.
// The time machine shows this next to the clock so "accurate" never means "pretend".

import { DAYS_PER_YEAR, decimalYearFromJd } from './julian';
import { deltaTUncertaintySeconds } from './time';
import { marsConfidence } from './mars';
import { planetConfidence } from './planets';
import { climateAt } from './climate';
import { SUN_GALAXY } from './galaxySun';

export type Level = 'precise' | 'good' | 'approximate' | 'schematic' | 'n/a';

export interface AccuracyRow {
	id: 'time' | 'earth' | 'planets' | 'moon' | 'mars' | 'galaxy' | 'ice';
	topic: string;
	level: Level;
	/** One short human sentence. */
	note: string;
}

export function formatDuration(seconds: number): string {
	if (seconds < 1) return `${seconds.toFixed(1)} s`;
	if (seconds < 120) return `${Math.round(seconds)} s`;
	if (seconds < 7200) return `${Math.round(seconds / 60)} min`;
	if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`;
	return `${Math.round(seconds / 86400)} days`;
}

export function accuracyReport(jd: number, nowJd: number): AccuracyRow[] {
	const y = decimalYearFromJd(jd);
	const yearsFromNow = (jd - nowJd) / DAYS_PER_YEAR;
	const unc = deltaTUncertaintySeconds(y);
	const rows: AccuracyRow[] = [];

	// Earth's rotation phase: ΔT uncertainty is how far the day/night line could be out.
	const lonErr = (unc / 240).toFixed(unc < 24 ? 2 : 1); // 1 s of rotation = 15″ = 1/240°
	const nowY = decimalYearFromJd(nowJd);
	if (y >= 1955 && y <= nowY + 1) {
		rows.push({ id: 'time', topic: 'Time scale', level: 'precise', note: `Clock and Earth’s spin are measured or short-term predicted (ΔT known to ~0.1 s).` });
		rows.push({ id: 'earth', topic: 'Earth rotation & seasons', level: 'precise', note: 'Day/night line good to well under 0.1°.' });
	} else if (y > nowY + 1 && y <= 2150) {
		rows.push({ id: 'time', topic: 'Time scale', level: 'good', note: `Future Earth spin is predicted; ΔT uncertain by ~${formatDuration(unc)}.` });
		rows.push({ id: 'earth', topic: 'Earth rotation & seasons', level: 'good', note: `Day/night line uncertain by ~${lonErr}°.` });
	} else if (y >= -500 && y < 1955) {
		rows.push({ id: 'time', topic: 'Time scale', level: 'good', note: `Reconstructed from eclipses and telescopes; ΔT uncertain by ~${formatDuration(unc)}.` });
		rows.push({ id: 'earth', topic: 'Earth rotation & seasons', level: 'good', note: `Seasons exact; time of day uncertain by ~${formatDuration(unc)} (about ${lonErr}° of longitude).` });
	} else if (y >= -10000 && y < -500) {
		rows.push({ id: 'time', topic: 'Time scale', level: 'approximate', note: `Earth’s spin is extrapolated; clock time could be out by ${formatDuration(unc)} or more.` });
		rows.push({ id: 'earth', topic: 'Earth rotation & seasons', level: 'approximate', note: 'Seasons and tilt are right; time of day is not meaningful beyond a few hours.' });
	} else {
		rows.push({ id: 'time', topic: 'Time scale', level: 'n/a', note: `The date is a proleptic-calendar label: Earth’s spin is uncertain by ${formatDuration(unc)}, so time of day means nothing here.` });
		rows.push({ id: 'earth', topic: 'Earth rotation & seasons', level: y >= -1e6 && y <= 1e6 ? 'approximate' : 'n/a', note: y >= -1e6 && y <= 1e6 ? 'Season and tilt are modelled; day/night phase is arbitrary.' : 'Earth’s orientation is not modelled this far from today.' });
	}

	const pc = planetConfidence(jd);
	rows.push({ id: 'planets', topic: 'Planet positions', level: pc.level === 'precise' ? 'precise' : pc.level === 'good' ? 'good' : 'approximate', note: pc.note });

	rows.push({
		id: 'moon', topic: 'Moon phase',
		level: y >= -3000 && y <= 3000 ? 'good' : 'approximate',
		note: y >= -3000 && y <= 3000 ? 'Phase and distance good to a fraction of a day.' : 'Phase is illustrative at this distance from today.',
	});

	const mc = marsConfidence(jd);
	rows.push({
		id: 'mars', topic: 'Mars season & storms',
		level: mc === 'documented' ? 'good' : mc === 'seasonal-model' ? 'good' : 'approximate',
		note: mc === 'documented'
			? 'Season (Ls) good to ~0.1°; global dust storms shown are those observed by spacecraft.'
			: mc === 'seasonal-model'
				? 'Season is modelled well; whether a storm occurs cannot be predicted (about one Mars year in three has one).'
				: 'Mars season drifts out of step the further we go from 1874–2100; storms cannot be known.',
	});

	const armUncertaintyDeg = Math.abs(yearsFromNow / 1e6) * (SUN_GALAXY.armPattern.plus + SUN_GALAXY.armPattern.minus) / 2 / 977.792 * (180 / Math.PI);
	rows.push({
		id: 'galaxy', topic: 'Sun in the Galaxy',
		level: Math.abs(yearsFromNow) < 1e6 ? 'good' : 'approximate',
		note: `Sun is 26,673 ± 85 ly from Sgr A* (GRAVITY 2019). Spiral arms drift with an uncertain pattern speed: ±${armUncertaintyDeg < 1 ? armUncertaintyDeg.toFixed(2) : Math.round(armUncertaintyDeg)}° at this epoch.`,
	});

	const c = climateAt(jd);
	rows.push({
		id: 'ice', topic: 'Ice ages',
		level: c.applicable ? 'schematic' : 'n/a',
		note: c.applicable ? 'Ice-sheet extent is a schematic from sea-level history (tens of metres, thousands of years uncertain).' : 'Outside the 800,000-year ice-age window.',
	});
	return rows;
}
