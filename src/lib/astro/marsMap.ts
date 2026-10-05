// src/lib/astro/marsMap.ts
// A schematic Mars surface for the globe: hand-placed bright/dark albedo regions and seasonal polar caps.
// No spacecraft imagery is bundled (it cannot be fetched in this build environment); positions are
// the well-known IAU/telescopic locations of the classical albedo features, rounded.

export interface MarsFeature { name: string; lat: number; lon: number; radius: number; strength: number }

/** strength > 0 darkens (basaltic plains), < 0 brightens (dust-covered highlands, basins). East longitudes −180…180. */
export const MARS_FEATURES: MarsFeature[] = [
	{ name: 'Syrtis Major', lat: 8, lon: 69, radius: 11, strength: 1 },
	{ name: 'Acidalia Planitia', lat: 47, lon: -20, radius: 16, strength: 0.8 },
	{ name: 'Sinus Meridiani', lat: -2, lon: 0, radius: 9, strength: 0.7 },
	{ name: 'Sinus Sabaeus', lat: -8, lon: 20, radius: 9, strength: 0.8 },
	{ name: 'Mare Tyrrhenum', lat: -15, lon: 100, radius: 10, strength: 0.7 },
	{ name: 'Mare Cimmerium', lat: -22, lon: 147, radius: 12, strength: 0.7 },
	{ name: 'Mare Sirenum', lat: -35, lon: -160, radius: 12, strength: 0.7 },
	{ name: 'Solis Lacus', lat: -26, lon: -90, radius: 8, strength: 0.8 },
	{ name: 'Valles Marineris', lat: -13, lon: -75, radius: 4.5, strength: 0.55 },
	{ name: 'Valles Marineris', lat: -13, lon: -63, radius: 4.5, strength: 0.55 },
	{ name: 'Valles Marineris', lat: -12, lon: -52, radius: 4.5, strength: 0.55 },
	{ name: 'Hellas Planitia', lat: -42, lon: 70, radius: 11, strength: -1 },
	{ name: 'Argyre Planitia', lat: -50, lon: -43, radius: 8, strength: -0.8 },
	{ name: 'Arabia Terra', lat: 22, lon: 15, radius: 18, strength: -0.45 },
	{ name: 'Tharsis', lat: 5, lon: -105, radius: 18, strength: -0.55 },
	{ name: 'Elysium', lat: 25, lon: 147, radius: 12, strength: -0.5 },
	{ name: 'Olympus Mons', lat: 18.65, lon: -133.8, radius: 4, strength: -0.9 },
];

/** Landmarks to label on the globe. */
export const MARS_LABELS = [
	{ name: 'Olympus Mons', lat: 18.65, lon: -133.8 },
	{ name: 'Valles Marineris', lat: -13, lon: -62 },
	{ name: 'Hellas', lat: -42, lon: 70 },
	{ name: 'Syrtis Major', lat: 8, lon: 69 },
	{ name: 'Gale Crater (Curiosity)', lat: -5.4, lon: 137.8 },
	{ name: 'Jezero (Perseverance)', lat: 18.4, lon: 77.5 },
];

const rad = Math.PI / 180;

/** Great-circle angular distance in degrees. */
export function angularDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const c = Math.sin(lat1 * rad) * Math.sin(lat2 * rad) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon1 - lon2) * rad);
	return Math.acos(Math.max(-1, Math.min(1, c))) / rad;
}

/** Albedo darkness offset in [−1, 1] at a point. */
export function marsDarkness(lat: number, lon: number): number {
	let v = 0;
	for (const f of MARS_FEATURES) {
		const d = angularDistance(lat, lon, f.lat, f.lon) / f.radius;
		if (d < 2.5) v += f.strength * Math.exp(-d * d);
	}
	return Math.max(-1, Math.min(1, v));
}

const interp = (table: [number, number][], ls: number) => {
	const x = ((ls % 360) + 360) % 360;
	for (let i = 1; i < table.length; i++) {
		if (x <= table[i][0]) {
			const [x0, y0] = table[i - 1];
			const [x1, y1] = table[i];
			return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
		}
	}
	return table[table.length - 1][1];
};

/** Latitude of the seasonal north polar cap edge (°N) at solar longitude Ls: schematic from telescopic/MGS records. */
export const northCapEdge = (ls: number) => interp([[0, 62], [30, 70], [60, 78], [90, 83], [150, 85], [180, 84], [210, 78], [240, 70], [270, 64], [300, 60], [330, 59], [360, 62]], ls);
/** Latitude of the seasonal south polar cap edge (°S, returned negative). */
export const southCapEdge = (ls: number) => interp([[0, -78], [30, -70], [60, -62], [90, -58], [120, -60], [150, -64], [180, -70], [210, -76], [240, -82], [270, -86], [300, -86], [330, -84], [360, -78]], ls);
