import { describe, expect, it } from 'vitest';
import { makeProjector, marsOrientation, localSolarTime, sunLight, latLonToVec, bodyToSunFrame } from '../globe';
import { subsolarPoint } from '../earth';
import { jdFromCalendar } from '../julian';

describe('globe geometry', () => {
	it('the sub-solar point maps to the Sun direction', () => {
		const s = { lat: 17.3, lon: -42 };
		const v = bodyToSunFrame(latLonToVec(s.lat, s.lon), s);
		expect(v[0]).toBeCloseTo(1, 9);
		expect(Math.abs(v[1])).toBeLessThan(1e-9);
	});
	it('projection and inverse agree', () => {
		const p = makeProjector({ lat: 10, lon: 30 }, 50, 20);
		const q = p.toScreen(25, 60);
		if (q.depth > 0) {
			const back = p.fromScreen(q.u, q.v)!;
			expect(back.lat).toBeCloseTo(25, 6);
			expect(back.lon).toBeCloseTo(60, 6);
		}
	});
	it('the Sun lights the sub-solar point fully', () => {
		const p = makeProjector({ lat: 0, lon: 0 }, 0, 0); // camera on the Sun line
		const hit = p.fromScreen(0, 0)!;
		expect(sunLight(hit.normal, p.sun)).toBeCloseTo(1, 9);
	});
	it('northern summer solstice lights the north pole all day (Earth, 2026-06-21)', () => {
		const sp = subsolarPoint(jdFromCalendar(2026, 6, 21, 9));
		expect(sp.latitude).toBeGreaterThan(23.3);
		expect(sp.latitude).toBeLessThan(23.5);
	});
});

describe('Mars orientation', () => {
	it('sub-solar longitude drifts west one full turn per sol', () => {
		const a = marsOrientation(jdFromCalendar(2026, 10, 5, 0)).subsolar.lon;
		const b = marsOrientation(jdFromCalendar(2026, 10, 5, 0) + 1.0274912517).subsolar.lon;
		let d = Math.abs(a - b);
		if (d > 180) d = 360 - d;
		expect(d).toBeLessThan(1.5); // returns to the same longitude after one sol (EOT changes slightly)
	});
	it('Curiosity landed mid-afternoon at Gale (LTST ≈ 14–15 h, 2012-08-06 05:17 UTC)', () => {
		const m = marsOrientation(jdFromCalendar(2012, 8, 6, 5, 17));
		const lt = localSolarTime(137.4, m.subsolar.lon);
		expect(lt).toBeGreaterThan(13.8);
		expect(lt).toBeLessThan(15.6);
	});
	it('solar declination follows Ls', () => {
		expect(marsOrientation(jdFromCalendar(2026, 10, 5)).subsolar.lat).toBeLessThan(25.2);
	});
});
