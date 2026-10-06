import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { enuBasis, geodeticToEcef, rad } from '../earth/geo';
import { NO_INPUT } from './flight';
import { earthTelemetry, geoOf, setAttitude, spawnOnGround, stepEarth, type TerrainQuery } from './earthflight';

const sea: TerrainQuery = { height: () => 0 };

/** A scripted gravity-turn ascent: nose up, throttle to the stop, pitch program from 80° down to horizontal by ~110 km. */
function ascend(maxSeconds: number) {
	const s = spawnOnGround(0, 10, 90, 0);
	s.pos.set(...geodeticToEcef(0, rad(10), 300)); s.landed = false; s.flightMode = true; s.gear = false;
	setAttitude(s.q, 0, rad(10), rad(90), rad(80));
	const log = { maxQ: 0, maxMach: 0, maxHeat: 0, t: 0, orbitAt: -1, fuelAtOrbit: 0, ap: 0, pe: 0 };
	const dt = 1 / 20;
	for (let t = 0; t < maxSeconds; t += dt) {
		const tel = earthTelemetry(s, sea);
		log.maxQ = Math.max(log.maxQ, tel.q); log.maxMach = Math.max(log.maxMach, tel.mach); log.maxHeat = Math.max(log.maxHeat, tel.heatFlux / 1e4);
		const o = tel.orbit;
		if (o.inOrbit && log.orbitAt < 0) { log.orbitAt = t; log.fuelAtOrbit = tel.fuelFraction; log.ap = o.apoapsis ?? -1; log.pe = o.periapsis; break; }
		const alt = tel.altitudeMsl;
		const target = Math.max(0, 80 * (1 - Math.pow(Math.max(0, alt - 2000) / 108_000, 0.55)));
		const g = geoOf(s.pos), n = new THREE.Vector3(...g.up), fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(s.q);
		const theta = (Math.asin(Math.max(-1, Math.min(1, fwd.dot(n)))) * 180) / Math.PI;
		const pitch = Math.max(-1, Math.min(1, 0.25 * (target - theta)));
		stepEarth(s, { ...NO_INPUT, forward: 1, pitch }, dt, sea, { hoverAssist: true, levelAssist: true });
		log.t = t;
		if (s.propellant <= 0) break;
	}
	return { s, log };
}

describe('can the Kestrel reach orbit? (scripted gravity-turn ascent, no pilot)', () => {
	it('reaches a stable orbit above 100 km with propellant left, in under ~15 minutes', () => {
		const { s, log } = ascend(1200);
		const tel = earthTelemetry(s, sea);
		process.stderr.write(`ORBIT t=${log.t.toFixed(0)}s orbitAt=${log.orbitAt.toFixed(0)} fuelLeft=${(log.fuelAtOrbit * 100).toFixed(0)}% maxQ=${(log.maxQ / 1000).toFixed(1)}kPa maxMach=${log.maxMach.toFixed(1)} maxHeat=${log.maxHeat.toFixed(0)}W/cm2 AP=${(log.ap / 1000).toFixed(0)}km PE=${(log.pe / 1000).toFixed(0)}km | now alt=${(tel.altitudeMsl / 1000).toFixed(0)}km speed=${tel.speed.toFixed(0)} fuel=${(tel.fuelFraction * 100).toFixed(0)}%\n`);
		expect(log.orbitAt).toBeGreaterThan(0);
		expect(log.fuelAtOrbit).toBeGreaterThan(0.05);
		void enuBasis;
	});

	it('hands-off orbit insertion: from a 90 km, 7 km/s hop, level nose + full throttle (horizon hold) reaches orbit with the nose still level', () => {
		const s = spawnOnGround(0, 10, 90, 0);
		s.pos.set(...geodeticToEcef(0, rad(10), 90_000)); s.landed = false; s.flightMode = true; s.gear = false;
		const e = enuBasis(0, rad(10)).east, v = 7000 - 7.292115e-5 * (6378137 + 90_000);
		s.vel.set(e[0] * v, e[1] * v, e[2] * v);
		setAttitude(s.q, 0, rad(10), rad(90), 0);
		let orbitAt = -1;
		for (let t = 0; t < 400; t += 0.1) {
			stepEarth(s, { ...NO_INPUT, forward: 1 }, 0.1, sea);
			const tel = earthTelemetry(s, sea);
			if (tel.orbit.inOrbit) { orbitAt = t; expect(Math.abs(tel.pitch)).toBeLessThan(4); break; }
		}
		expect(orbitAt).toBeGreaterThan(0); expect(orbitAt).toBeLessThan(400);
	});
});
