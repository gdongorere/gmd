// src/lib/galaxy/features.ts
// Named things you can fly to in Explore mode. Positions come from the same constants
// as the generator, so labels land exactly on what is drawn.

import { ARMS, ARM_PHASE_OFFSET, GALAXY, fromSun } from './constants';
import { GLOBULAR_CLUSTERS } from './generate';
import { VIEWS, type CameraPose } from './camera';

export type FeatureKind = 'centre' | 'structure' | 'arm' | 'home' | 'satellite' | 'cluster';

export interface Feature {
	id: string;
	label: string;
	kind: FeatureKind;
	/** 1 labels always show, 2 only when zoomed in somewhat, 3 only when close. */
	priority: 1 | 2 | 3;
	position: [number, number, number];
	/** Camera when flying here: distance in scene units (1 unit = 100 ly), degrees. */
	camera: { distance: number; polar: number; azimuth: number };
	summary: string;
	facts: { label: string; value: string }[];
	/** How the model differs from reality, when it does. */
	why?: string;
}

const DEG = Math.PI / 180;
const K = Math.tan(GALAXY.armPitch);

/** A point on an arm's centreline at azimuth θ, picking the winding closest to r ≈ 250 (25,000 ly). */
function armPosition(armIndex: number, thetaDeg: number): [number, number, number] {
	const arm = ARMS[armIndex];
	const theta = thetaDeg * DEG;
	let best: number | null = null;
	for (let n = -4; n <= 4; n++) {
		const t = theta + 2 * Math.PI * n;
		const r = GALAXY.sagittariusRadiusAtSun * Math.exp((t - (ARM_PHASE_OFFSET + arm.phase)) * K);
		if (r >= arm.rStart + 10 && r <= arm.rEnd - 10 && (best === null || Math.abs(r - 250) < Math.abs(best - 250))) best = r;
	}
	const r = best ?? (arm.rStart + arm.rEnd) / 2;
	return [r * Math.cos(theta), 0, -r * Math.sin(theta)];
}

const nearestCluster = (() => {
	let best = GLOBULAR_CLUSTERS[0];
	let bestD = Infinity;
	for (const c of GLOBULAR_CLUSTERS) {
		const d = Math.hypot(c.x - GALAXY.sunRadius, c.y, c.z);
		if (d < bestD) {
			bestD = d;
			best = c;
		}
	}
	return best;
})();

const lmc = fromSun(GALAXY.lmc.distance, GALAXY.lmc.l, GALAXY.lmc.b);
const smc = fromSun(GALAXY.smc.distance, GALAXY.smc.l, GALAXY.smc.b);
const barAnchor: [number, number, number] = [
	GALAXY.barHalfLength * 0.8 * Math.cos(GALAXY.barAngle),
	0,
	-GALAXY.barHalfLength * 0.8 * Math.sin(GALAXY.barAngle),
];

export const FEATURES: Feature[] = [
	{
		id: 'sgr-a-star', label: 'Sagittarius A*', kind: 'centre', priority: 1, position: [0, 0, 0],
		camera: { distance: 140, polar: 62, azimuth: 10 },
		summary: 'The supermassive black hole at the centre of the Milky Way. Everything here orbits it, slowly.',
		facts: [
			{ label: 'Mass', value: '≈ 4.3 million Suns' },
			{ label: 'Distance from the Sun', value: '≈ 26,000 light-years' },
			{ label: 'Event-horizon radius', value: '≈ 12 million km (about 0.08 AU)' },
		],
		why: 'Greatly exaggerated. At true scale its shadow would be far smaller than a single pixel, so it is drawn about ten orders of magnitude too large to be seen.',
	},
	{
		id: 'galactic-bar', label: 'Galactic bar', kind: 'structure', priority: 1, position: barAnchor,
		camera: { distance: 300, polar: 40, azimuth: 20 },
		summary: 'An elongated bar of mostly old, yellow-orange stars runs through the centre, with spiral arms starting at its ends.',
		facts: [
			{ label: 'Half-length', value: '≈ 16,000 light-years' },
			{ label: 'Angle to the Sun–centre line', value: '≈ 27°' },
			{ label: 'Bulge', value: 'boxy / peanut shaped, ≈ 10,000 ly across' },
		],
		why: 'The bar is built from a triaxial Gaussian distribution of stars. Real bars have finer internal structure.',
	},
	{
		id: 'perseus-arm', label: 'Perseus Arm', kind: 'arm', priority: 1, position: armPosition(1, 60),
		camera: { distance: 200, polar: 55, azimuth: 30 },
		summary: 'One of the two major spiral arms: dense with young, blue stars and glowing pink star-forming regions.',
		facts: [
			{ label: 'Type', value: 'major arm' },
			{ label: 'Pitch angle', value: '≈ 12°' },
			{ label: 'Crosses the Sun–centre line', value: '≈ 32,000 light-years from the centre' },
		],
		why: 'Arms are logarithmic spirals. In reality they are density waves, so they rotate as a pattern while stars drift through them. The model does the same.',
	},
	{
		id: 'scutum-centaurus-arm', label: 'Scutum–Centaurus Arm', kind: 'arm', priority: 2, position: armPosition(0, 120),
		camera: { distance: 200, polar: 55, azimuth: 150 },
		summary: 'The other major arm. It begins at the near end of the bar and sweeps around the far side of the galaxy.',
		facts: [
			{ label: 'Type', value: 'major arm' },
			{ label: 'Crosses the Sun–centre line', value: '≈ 16,000 light-years from the centre' },
		],
	},
	{
		id: 'sagittarius-arm', label: 'Sagittarius–Carina Arm', kind: 'arm', priority: 2, position: armPosition(2, -100),
		camera: { distance: 200, polar: 55, azimuth: -60 },
		summary: 'A minor arm just inside the Sun’s orbit. Fewer stars than the major arms, but rich in nebulae.',
		facts: [
			{ label: 'Type', value: 'minor arm' },
			{ label: 'Crosses the Sun–centre line', value: '≈ 23,000 light-years from the centre' },
		],
	},
	{
		id: 'norma-outer-arm', label: 'Norma–Outer Arm', kind: 'arm', priority: 3, position: armPosition(3, -150),
		camera: { distance: 220, polar: 55, azimuth: -120 },
		summary: 'A minor arm that winds from near the bar out to the galaxy’s edge, where it is called the Outer Arm.',
		facts: [{ label: 'Type', value: 'minor arm' }],
	},
	{
		id: 'orion-spur', label: 'Orion Spur', kind: 'arm', priority: 2, position: [259, 0, -75],
		camera: { distance: 120, polar: 50, azimuth: 70 },
		summary: 'A short, narrow spur of gas and young stars between the Sagittarius and Perseus arms. We live in it.',
		facts: [
			{ label: 'Length', value: '≈ 10,000 light-years' },
			{ label: 'Also called', value: 'the Local Arm' },
		],
		why: 'The spur moves with the Sun in this model, so we stay inside it instead of the pattern sweeping past.',
	},
	{
		id: 'sun', label: 'The Sun', kind: 'home', priority: 1, position: [GALAXY.sunRadius, GALAXY.sunHeight, 0],
		camera: { distance: 90, polar: 62, azimuth: 40 },
		summary: 'Our home: an ordinary star in a quiet suburb of the galaxy, a little above the middle of the disk.',
		facts: [
			{ label: 'Distance from the centre', value: '≈ 26,000 light-years' },
			{ label: 'Height above the plane', value: '≈ 65 light-years' },
			{ label: 'Orbital speed', value: '≈ 230 km/s' },
			{ label: 'One orbit', value: '≈ 230 million years' },
		],
		why: 'The camera follows the Sun’s orbit, so the Sun stays put on screen while the rest of the galaxy turns around it.',
	},
	{
		id: 'globular-cluster', label: 'Globular cluster', kind: 'cluster', priority: 3,
		position: [nearestCluster.x, nearestCluster.y, nearestCluster.z],
		camera: { distance: 60, polar: 70, azimuth: 0 },
		summary: 'A tight ball of hundreds of thousands of ancient stars orbiting well outside the disk, in the halo.',
		facts: [
			{ label: 'Age', value: '≈ 10–13 billion years' },
			{ label: 'Known in the Milky Way', value: '≈ 150' },
		],
	},
	{
		id: 'lmc', label: 'Large Magellanic Cloud', kind: 'satellite', priority: 1, position: [lmc.x, lmc.y, lmc.z],
		camera: { distance: 800, polar: 90, azimuth: 0 },
		summary: 'The largest satellite galaxy of the Milky Way, still forming stars, visible to the naked eye from the southern hemisphere.',
		facts: [
			{ label: 'Distance', value: '≈ 163,000 light-years' },
			{ label: 'Diameter', value: '≈ 14,000 light-years' },
		],
	},
	{
		id: 'smc', label: 'Small Magellanic Cloud', kind: 'satellite', priority: 2, position: [smc.x, smc.y, smc.z],
		camera: { distance: 600, polar: 90, azimuth: 0 },
		summary: 'A smaller dwarf galaxy, being slowly stretched by the Milky Way’s gravity.',
		facts: [
			{ label: 'Distance', value: '≈ 206,000 light-years' },
			{ label: 'Diameter', value: '≈ 7,000 light-years' },
		],
	},
];

export const featureById = (id: string) => FEATURES.find((f) => f.id === id);

/** Keyboard numbers 1–9 map onto these, in this order. */
export const FLY_TO_ORDER = ['sgr-a-star', 'galactic-bar', 'perseus-arm', 'orion-spur', 'sun', 'globular-cluster', 'lmc', 'smc'];

export function featurePose(f: Feature): CameraPose {
	return {
		logDistance: Math.log(f.camera.distance),
		polar: f.camera.polar * DEG,
		azimuth: f.camera.azimuth * DEG,
		targetX: f.position[0],
		targetY: f.position[1],
		targetZ: f.position[2],
		roll: 0,
	};
}

// ---------------------------------------------------------------------------
// Guided tour
// ---------------------------------------------------------------------------

export interface TourStep {
	title: string;
	body: string;
	pose: CameraPose;
	featureId?: string;
}

const flat = (pose: CameraPose): CameraPose => ({ ...pose, roll: 0 });
const poseOf = (id: string) => featurePose(featureById(id)!);

export const TOUR: TourStep[] = [
	{
		title: 'The big picture',
		body: 'Our galaxy is a barred spiral about 100,000 light-years across, home to hundreds of billions of stars. This model uses a few hundred thousand to stand in for them, all placed from real measurements.',
		pose: flat(VIEWS['face-on']),
	},
	{ title: 'A bar at the centre', body: 'The middle of the galaxy is stretched into a bar of old, yellow stars about 27° off the line between us and the centre. The spiral arms start at its ends.', pose: poseOf('galactic-bar'), featureId: 'galactic-bar' },
	{ title: 'Spiral arms', body: 'Young blue stars and pink star-forming clouds trace the arms. Perseus and Scutum–Centaurus are the two major arms; the dark lanes on their inner edges are dust.', pose: poseOf('perseus-arm'), featureId: 'perseus-arm' },
	{ title: 'Home', body: 'The Sun sits about 26,000 light-years from the centre, inside a small spur called the Orion Spur. One lap of the galaxy takes it roughly 230 million years.', pose: poseOf('sun'), featureId: 'sun' },
	{ title: 'The central black hole', body: 'Sagittarius A* holds about 4.3 million Suns’ worth of mass in a region smaller than Mercury’s orbit. Here it is drawn hugely oversized so you can see it.', pose: poseOf('sgr-a-star'), featureId: 'sgr-a-star' },
	{ title: 'Neighbours', body: 'The Large and Small Magellanic Clouds are satellite galaxies about 160,000 and 200,000 light-years away, pulled around by the Milky Way’s gravity.', pose: poseOf('lmc'), featureId: 'lmc' },
	{ title: 'The halo', body: 'A faint, spherical halo of ancient stars surrounds the disk, dotted with about 150 globular clusters. Pull back and you can see how little of the space around us is filled with stars.', pose: flat(VIEWS.halo) },
];
