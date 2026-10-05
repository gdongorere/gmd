// src/lib/astro/tour.ts
// The guided time-travel tour: five stops from today to one galactic year ago.

import { DATED_STORMS } from './mars';
import { DAYS_PER_YEAR, jdFromCalendar } from './julian';

export type TourView = '3d' | 'mars' | 'earth' | 'galaxy';
export interface TimeTourStep { id: string; title: string; body: string; view: TourView; jd: (nowJd: number) => number }

export const TIME_TOUR: TimeTourStep[] = [
	{ id: 'today', title: 'Today', view: '3d',
		body: 'Every planet is where it really is right now, and Earth’s night side is genuinely dark. Next we go back eight years.',
		jd: (now) => now },
	{ id: 'mars-2018', title: 'Mars goes dark, 2018', view: 'mars',
		body: 'In mid-2018 a dust storm wrapped the whole planet and ended the Opportunity rover’s mission. Watch the surface fade behind the haze.',
		jd: () => DATED_STORMS.find((s) => s.id === '2018')!.startJd + 20 },
	{ id: 'lgm', title: 'The ice age, 21,000 years ago', view: 'earth',
		body: 'Sea level is about 130 m lower and ice reaches roughly 40°N. Ice edges here are schematic: switch on the exposed shelf to see how much more land there was.',
		jd: () => jdFromCalendar(-19050, 1, 15, 12) },
	{ id: 'k-pg', title: 'The dinosaurs’ last day, 66 million years ago', view: 'galaxy',
		body: 'The Sun is already a third of a galactic lap behind where it is now, and Earth’s continents are in different places, which this model does not draw.',
		jd: (now) => now - 66e6 * DAYS_PER_YEAR },
	{ id: 'galactic-year', title: 'One galactic year ago', view: 'galaxy',
		body: 'About 203 million years ago the Sun was at the same place in its orbit, and the galaxy’s spiral arms were somewhere else entirely.',
		jd: (now) => now - 203e6 * DAYS_PER_YEAR },
];
