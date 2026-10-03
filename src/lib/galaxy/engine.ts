// src/lib/galaxy/engine.ts
// The WebGL Milky Way: one draw call per layer, all motion in shaders, a single
// requestAnimationFrame loop, and a governor that keeps weak devices comfortable.

import {
	AddEquation, AdditiveBlending, Blending, BufferAttribute, BufferGeometry, Color, CustomBlending, DoubleSide,
	InstancedBufferAttribute, InstancedBufferGeometry, Mesh, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, PerspectiveCamera, PlaneGeometry,
	Points, Scene, ShaderMaterial, ShaderMaterialParameters, Vector3, WebGLRenderer,
} from 'three';
import type { StarfieldConfig, StarfieldStats } from '@/contexts/StarfieldContext';
import { CAMERA_FOV, CAMERA_REFERENCE_DISTANCE, GALAXY, LY_PER_UNIT } from './constants';
import { CameraPose, DEFAULT_PATH, VIEWS, clonePose, damp, dampPose, newPose, poseAlong, poseBetween, smootherstep } from './camera';
import { galaxyBus, type GalaxyApi, type WaypointEntry } from './bus';
import { GalaxyData, LAYER_NAMES, LayerName, generateGalaxy } from './generate';
import { DeviceProfile, QualityGovernor, RESOLUTION_STEPS, loadSettledTier } from './quality';
import { BLACK_HOLE_FRAGMENT, BLACK_HOLE_VERTEX, GLOW_FRAGMENT, GLOW_VERTEX, POINT_FRAGMENT, POINT_VERTEX } from './shaders';
import { LayerCounts, TIERS, Tier, minTier, tierIndex } from './tiers';

export interface GalaxyEngine {
	setConfig(config: StarfieldConfig): void;
	dispose(): void;
}

export interface EngineOptions {
	canvas: HTMLCanvasElement;
	sunMarker: HTMLElement | null;
	statsOverlay: HTMLElement | null;
	config: StarfieldConfig;
	profile: DeviceProfile & { ceiling: Tier };
	/** Tier forced from the URL (?quality=low), overrides settings. */
	forcedTier: Tier | null;
	onStats(stats: StarfieldStats): void;
	onReady(): void;
	onContextLost(): void;
	/** Aborts start-up if the component unmounts while the galaxy is still generating. */
	signal: AbortSignal;
}

// ---------------------------------------------------------------------------
// Layer styling
// ---------------------------------------------------------------------------

type SizeCap = 'star' | 'glow' | 'nebula';

interface LayerStyle {
	profile: 0 | 1 | 2;
	intensity: number;
	nearFade: [number, number];
	cap: SizeCap;
	order: number;
	/** Star layers follow the density slider. */
	density: boolean;
}

const LAYER_STYLE: Record<LayerName, LayerStyle> = {
	// Instanced in-plane quads (see GLOW_VERTEX), not points.
	glow: { profile: 1, intensity: 0.042, nearFade: [60, 260], cap: 'glow', order: 0, density: false },
	old: { profile: 0, intensity: 0.9, nearFade: [0.4, 5], cap: 'star', order: 1, density: true },
	dust: { profile: 2, intensity: 0.3, nearFade: [30, 120], cap: 'glow', order: 2, density: false },
	young: { profile: 0, intensity: 1.05, nearFade: [0.4, 5], cap: 'star', order: 3, density: true },
	halo: { profile: 0, intensity: 0.95, nearFade: [0.4, 5], cap: 'star', order: 4, density: true },
	hii: { profile: 1, intensity: 0.3, nearFade: [12, 60], cap: 'nebula', order: 5, density: false },
};

const STAR_LAYERS: LayerName[] = ['old', 'young', 'halo'];

function generateInWorker(counts: LayerCounts): Promise<GalaxyData> {
	return new Promise((resolve) => {
		let worker: Worker;
		try {
			worker = new Worker(new URL('./galaxy.worker.ts', import.meta.url));
		} catch {
			resolve(generateGalaxy(counts));
			return;
		}
		worker.onmessage = (event: MessageEvent<GalaxyData>) => {
			resolve(event.data);
			worker.terminate();
		};
		worker.onerror = () => {
			worker.terminate();
			resolve(generateGalaxy(counts));
		};
		worker.postMessage(counts);
	});
}

const colorVec = (hex: string) => {
	const c = new Color(hex);
	return new Vector3(c.r, c.g, c.b);
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export async function createGalaxyEngine(options: EngineOptions): Promise<GalaxyEngine> {
	const { canvas, sunMarker, statsOverlay, profile, forcedTier, onStats, onReady, onContextLost, signal } = options;
	let config = options.config;
	let disposed = false;

	const manualTier = (): Tier | null => forcedTier ?? (config.quality === 'auto' ? null : config.quality);

	// The galaxy is generated once at the highest tier we may need; lower tiers draw prefixes.
	const startTier = minTier(loadSettledTier(profile.renderer) ?? profile.ceiling, profile.ceiling);
	let generatedTier: Tier = manualTier() ?? profile.ceiling;
	const governor = new QualityGovernor(manualTier() ?? startTier, profile.ceiling, profile.renderer, manualTier() === null);
	if (manualTier()) governor.state.tier = manualTier() as Tier;

	let data = await generateInWorker(TIERS[generatedTier].counts);
	if (signal.aborted) return { setConfig: () => undefined, dispose: () => undefined };

	// --- Renderer -----------------------------------------------------------------
	const renderer = new WebGLRenderer({
		canvas,
		antialias: false,
		alpha: false,
		depth: false,
		stencil: false,
		powerPreference: profile.mobile ? 'default' : 'high-performance',
	});
	renderer.setClearColor(0x0a0a0a, 1);
	const gl = renderer.getContext();
	const pointSizeRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | number[];
	const hardwareMaxPoint = pointSizeRange?.[1] ?? 64;

	const scene = new Scene();
	const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.3, 8000);

	const shared = {
		uTime: { value: 0 },
		uClock: { value: 0 },
		uPixelScale: { value: 1 },
		uMinPx: { value: 1 },
		uTwinkle: { value: 0 },
	};

	interface LayerObject {
		object: Points<BufferGeometry, ShaderMaterial> | Mesh<BufferGeometry, ShaderMaterial>;
		style: LayerStyle;
	}

	// Dust alpha-blends (absorbs what was drawn behind it); everything else adds light.
	const blendingFor = (style: LayerStyle): ShaderMaterialParameters & { blending: Blending } =>
		style.profile === 2 ? { blending: NormalBlending } : { blending: AdditiveBlending };

	const buildGeometry = (name: LayerName): BufferGeometry => {
		const layer = data[name];
		if (name === 'glow') {
			const geometry = new InstancedBufferGeometry();
			geometry.setIndex([0, 1, 2, 0, 2, 3]);
			geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
			geometry.setAttribute('iCyl', new InstancedBufferAttribute(layer.cyl, 3));
			geometry.setAttribute('iColor', new InstancedBufferAttribute(layer.color, 3, true));
			geometry.setAttribute('iMeta', new InstancedBufferAttribute(layer.meta, 3));
			geometry.instanceCount = layer.count;
			return geometry;
		}
		const geometry = new BufferGeometry();
		// Cylindrical coordinates ride in `position` so three.js knows the vertex count.
		geometry.setAttribute('position', new BufferAttribute(layer.cyl, 3));
		geometry.setAttribute('aColor', new BufferAttribute(layer.color, 3, true));
		geometry.setAttribute('aMeta', new BufferAttribute(layer.meta, 3));
		return geometry;
	};

	const layers = {} as Record<LayerName, LayerObject>;
	for (const name of LAYER_NAMES) {
		const style = LAYER_STYLE[name];
		if (name === 'glow') {
			const material = new ShaderMaterial({
				vertexShader: GLOW_VERTEX,
				fragmentShader: GLOW_FRAGMENT,
				uniforms: {
					uTime: shared.uTime,
					uSizeMul: { value: 1 },
					uIntensity: { value: style.intensity },
					uNearFade: { value: style.nearFade },
				},
				transparent: true,
				depthTest: false,
				depthWrite: false,
				blending: AdditiveBlending,
				// In-plane quads are seen from both galactic hemispheres.
				side: DoubleSide,
			});
			const mesh = new Mesh(buildGeometry(name), material);
			mesh.frustumCulled = false;
			mesh.renderOrder = style.order;
			scene.add(mesh);
			layers[name] = { object: mesh, style };
			continue;
		}
		const material = new ShaderMaterial({
			vertexShader: POINT_VERTEX,
			fragmentShader: POINT_FRAGMENT,
			defines: { PROFILE: style.profile },
			uniforms: {
				...shared,
				uSizeMul: { value: 1 },
				uMaxPx: { value: 8 },
				uIntensity: { value: style.intensity },
				uNearFade: { value: style.nearFade },
			},
			transparent: true,
			depthTest: false,
			depthWrite: false,
			...blendingFor(style),
		});
		const points = new Points(buildGeometry(name), material);
		points.frustumCulled = false;
		points.renderOrder = style.order;
		scene.add(points);
		layers[name] = { object: points, style };
	}

	// --- Sgr A* -----------------------------------------------------------------
	const blackHoleMaterial = new ShaderMaterial({
		vertexShader: BLACK_HOLE_VERTEX,
		fragmentShader: BLACK_HOLE_FRAGMENT,
		uniforms: {
			uClock: shared.uClock,
			uRadius: { value: 10 },
			uRefDistance: { value: CAMERA_REFERENCE_DISTANCE },
			uSpin: { value: 1 },
			uDisk: { value: 1 },
			uFade: { value: 0 },
			uInner: { value: new Vector3() },
			uMid: { value: new Vector3() },
			uOuter: { value: new Vector3() },
		},
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: CustomBlending,
		blendEquation: AddEquation,
		blendSrc: OneFactor,
		blendDst: OneMinusSrcAlphaFactor,
	});
	const blackHole = new Mesh(new PlaneGeometry(2, 2), blackHoleMaterial);
	blackHole.frustumCulled = false;
	blackHole.renderOrder = 10;
	scene.add(blackHole);

	// --- Runtime state -------------------------------------------------------------
	let osReducedMotion = profile.reducedMotion;
	let reducedMotion = osReducedMotion && !config.overrideReducedMotion;
	let pendingCapture: ((blob: Blob | null) => void) | null = null;
	let lowPower = profile.saveData;
	let width = 1;
	let height = 1;
	let needsResize = true;
	let scrollTarget = 0;
	let scrollProgress = 0;
	let scrollY = window.scrollY;
	let viewportH = window.innerHeight;
	let lastScrollAt = 0;
	let dimNow = 0;
	let elapsedMyr = 0;
	let cameraSettled = true;
	let waypointVersion = -1;
	let sortedWaypoints: WaypointEntry[] = [];
	let sortedPoses: CameraPose[] = [];
	const defaultPoses = DEFAULT_PATH.map((name) => VIEWS[name]);
	let poseReady = false;
	const pointerTarget = { x: 0, y: 0 };
	const pointer = { x: 0, y: 0 };
	let lastInputAt = performance.now();
	let fade = 0;
	let clock = 0;
	let raf = 0;
	let lastRendered = 0;
	let framesSinceStats = 0;
	let lastStatsAt = performance.now();
	let lastStatsKey = '';
	let readySent = false;
	let regenerating = false;
	const pose = newPose();
	const desired = newPose();
	const target = new Vector3();
	const position = new Vector3();
	const up = new Vector3();
	const forward = new Vector3();
	const sunPosition = new Vector3(GALAXY.sunRadius, GALAXY.sunHeight, 0);
	const projected = new Vector3();

	const pixelRatio = () =>
		Math.min(window.devicePixelRatio || 1, TIERS[governor.state.tier].dprCap) * RESOLUTION_STEPS[governor.state.resolutionStep];

	const applyResolution = () => {
		width = Math.max(1, canvas.clientWidth || window.innerWidth);
		height = Math.max(1, canvas.clientHeight || window.innerHeight);
		const pr = pixelRatio();
		renderer.setPixelRatio(pr);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();

		const tanHalf = Math.tan((CAMERA_FOV * Math.PI) / 360);
		shared.uPixelScale.value = (height * pr) / (2 * tanHalf);
		shared.uMinPx.value = Math.max(1, pr * 0.8);
		const spec = TIERS[governor.state.tier];
		const caps: Record<SizeCap, number> = {
			star: Math.min(spec.maxPointSize, 7 * pr),
			glow: spec.maxGlowSize * Math.min(pr, 1.5),
			nebula: spec.maxPointSize * Math.min(pr, 1.5),
		};
		for (const name of LAYER_NAMES) {
			const maxPx = layers[name].object.material.uniforms.uMaxPx;
			if (maxPx) maxPx.value = Math.min(caps[layers[name].style.cap], hardwareMaxPoint);
		}

		// Black hole: `size` CSS px at the reference distance, scaled down on small screens.
		const screenScale = Math.min(1, Math.max(0.55, Math.min(width, height) / 900));
		const worldPerPx = (2 * CAMERA_REFERENCE_DISTANCE * tanHalf) / height;
		blackHoleMaterial.uniforms.uRadius.value = 3 * config.blackHole.size * screenScale * worldPerPx;
		needsResize = false;
	};

	const setCount = (name: LayerName, count: number) => {
		const geometry = layers[name].object.geometry;
		if (geometry instanceof InstancedBufferGeometry) geometry.instanceCount = count;
		else geometry.setDrawRange(0, count);
	};

	const applyQuality = () => {
		const tier = governor.state.tier;
		const spec = TIERS[tier];
		for (const name of LAYER_NAMES) {
			const { object, style } = layers[name];
			const available = data[name].count;
			const wanted = Math.floor(spec.counts[name] * (style.density ? config.starDensity : 1));
			const count = Math.min(available, wanted);
			setCount(name, count);
			if (name === 'glow' || name === 'dust') {
				// Sparser tiers draw fewer, larger sprites so haze and dust lanes keep their coverage.
				const coverage = Math.sqrt(TIERS.ultra.counts[name] / Math.max(count, 1));
				object.material.uniforms.uSizeMul.value = Math.min(name === 'glow' ? 3 : 2, coverage);
			}
			const enabled =
				name === 'glow' ? config.layers.glow
					: name === 'dust' ? config.layers.dust
						: name === 'hii' ? config.layers.nebulae
							: name === 'halo' ? config.layers.halo
								: true;
			object.visible = enabled && count > 0;
		}
		shared.uTwinkle.value = spec.twinkle && config.twinkle && !reducedMotion ? 0.12 : 0;
		needsResize = true;
	};

	const applyBlackHole = () => {
		const bh = config.blackHole;
		blackHole.visible = bh.isEnabled && bh.size > 0;
		blackHoleMaterial.uniforms.uSpin.value = bh.spin;
		blackHoleMaterial.uniforms.uDisk.value = bh.accretionDisk ? 1 : 0;
		blackHoleMaterial.uniforms.uInner.value.copy(colorVec(bh.colorPalette[0]));
		blackHoleMaterial.uniforms.uMid.value.copy(colorVec(bh.colorPalette[1]));
		blackHoleMaterial.uniforms.uOuter.value.copy(colorVec(bh.colorPalette[2]));
		needsResize = true;
	};

	const regenerate = async (tier: Tier) => {
		if (regenerating) return;
		regenerating = true;
		const next = await generateInWorker(TIERS[tier].counts);
		regenerating = false;
		if (disposed) return;
		data = next;
		generatedTier = tier;
		for (const name of LAYER_NAMES) {
			const old = layers[name].object.geometry;
			layers[name].object.geometry = buildGeometry(name);
			old.dispose();
		}
		applyQuality();
	};

	const syncTierWithConfig = () => {
		const manual = manualTier();
		governor.setEnabled(manual === null);
		if (manual) {
			governor.state = { tier: manual, resolutionStep: 0 };
			if (tierIndex(manual) > tierIndex(generatedTier)) void regenerate(manual);
		} else {
			governor.setCeiling(profile.ceiling);
			if (tierIndex(profile.ceiling) > tierIndex(generatedTier)) void regenerate(profile.ceiling);
		}
	};

	// --- Input --------------------------------------------------------------------
	const readScroll = () => {
		const doc = document.documentElement;
		const max = doc.scrollHeight - window.innerHeight;
		scrollTarget = max > 1 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
		scrollY = window.scrollY;
		viewportH = window.innerHeight;
		lastScrollAt = lastInputAt = performance.now();
	};
	const onPointer = (event: PointerEvent) => {
		pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
		pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
		lastInputAt = performance.now();
	};
	const onOrientation = (event: DeviceOrientationEvent) => {
		if (event.gamma === null || event.beta === null) return;
		pointerTarget.x = Math.max(-1, Math.min(1, event.gamma / 30));
		pointerTarget.y = Math.max(-1, Math.min(1, (event.beta - 45) / 30));
	};
	const onResize = () => {
		needsResize = true;
		readScroll();
	};
	const onVisibility = () => {
		if (!document.hidden) {
			lastRendered = 0;
			governor.reset();
		}
	};
	const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const onMotionChange = () => {
		osReducedMotion = motionQuery.matches;
		reducedMotion = osReducedMotion && !config.overrideReducedMotion;
		applyQuality();
	};
	const onContextLostEvent = (event: Event) => {
		event.preventDefault();
		cancelAnimationFrame(raf);
		onContextLost();
	};

	window.addEventListener('scroll', readScroll, { passive: true });
	window.addEventListener('resize', onResize, { passive: true });
	window.addEventListener('pointermove', onPointer, { passive: true });
	document.addEventListener('visibilitychange', onVisibility);
	motionQuery.addEventListener?.('change', onMotionChange);
	canvas.addEventListener('webglcontextlost', onContextLostEvent);
	// Gyro parallax only where it needs no permission prompt (not iOS).
	const OrientationEvent = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
	const useGyro = profile.mobile && OrientationEvent !== undefined && typeof OrientationEvent.requestPermission !== 'function';
	if (useGyro) window.addEventListener('deviceorientation', onOrientation, { passive: true });

	// Battery saver: cap at 30 fps when unplugged and low.
	interface BatteryLike extends EventTarget { charging: boolean; level: number }
	let battery: BatteryLike | null = null;
	const onBattery = () => {
		if (battery) lowPower = profile.saveData || (!battery.charging && battery.level < 0.2);
	};
	const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
	nav.getBattery?.().then((b) => {
		if (disposed) return;
		battery = b;
		b.addEventListener('levelchange', onBattery);
		b.addEventListener('chargingchange', onBattery);
		onBattery();
	}).catch(() => undefined);

	// --- Frame loop -------------------------------------------------------------------
	const targetFps = (now: number) => {
		const spec = TIERS[governor.state.tier];
		let fps = lowPower ? Math.min(30, spec.targetFps) : spec.targetFps;
		const idle = now - lastInputAt > 8000 && cameraSettled && !galaxyBus.explore?.active;
		if (idle && reducedMotion) fps = 10;
		else if (idle && tierIndex(governor.state.tier) <= tierIndex('low')) fps = 20;
		return fps;
	};

	/** Where the camera wants to be: explore target, else the page's waypoints, else the default journey. */
	const resolveDesiredPose = () => {
		const explore = galaxyBus.explore;
		if (explore?.active) {
			Object.assign(desired, explore.target);
			return;
		}
		if (!config.scrollCamera) {
			Object.assign(desired, sortedWaypoints.length ? VIEWS[sortedWaypoints[0].view] : VIEWS['face-on']);
			return;
		}
		if (waypointVersion !== galaxyBus.version) {
			waypointVersion = galaxyBus.version;
			sortedWaypoints = [...galaxyBus.waypoints.values()].sort((a, b) => a.y - b.y);
			sortedPoses = sortedWaypoints.map((w) => VIEWS[w.view]);
		}
		if (sortedWaypoints.length === 0) {
			poseAlong(defaultPoses, scrollProgress, desired);
			return;
		}
		const centre = scrollY + viewportH * 0.5;
		const first = sortedWaypoints[0];
		const last = sortedWaypoints[sortedWaypoints.length - 1];
		if (centre <= first.y) return void Object.assign(desired, sortedPoses[0]);
		if (centre >= last.y) return void Object.assign(desired, sortedPoses[sortedPoses.length - 1]);
		let i = 0;
		while (i < sortedWaypoints.length - 2 && centre >= sortedWaypoints[i + 1].y) i++;
		const span = Math.max(1, sortedWaypoints[i + 1].y - sortedWaypoints[i].y);
		// Hold each view while its section is centred; the flight happens between sections.
		const t = smootherstep(((centre - sortedWaypoints[i].y) / span - 0.2) / 0.6);
		poseBetween(sortedPoses, i, t, desired);
	};

	const updateCamera = (dt: number) => {
		scrollProgress = damp(scrollProgress, scrollTarget, 5, dt);
		const parallax = reducedMotion ? 0 : config.parallax;
		pointer.x = damp(pointer.x, pointerTarget.x, 3, dt);
		pointer.y = damp(pointer.y, pointerTarget.y, 3, dt);

		const exploring = !!galaxyBus.explore?.active;
		resolveDesiredPose();
		if (!poseReady) {
			Object.assign(pose, desired);
			poseReady = true;
		} else {
			const before = pose.logDistance + pose.polar + pose.azimuth + pose.targetX + pose.targetY + pose.targetZ + pose.roll;
			dampPose(pose, desired, reducedMotion ? 14 : exploring ? 7 : 4.5, dt);
			const after = pose.logDistance + pose.polar + pose.azimuth + pose.targetX + pose.targetY + pose.targetZ + pose.roll;
			cameraSettled = Math.abs(after - before) < 1e-5;
		}

		// Portrait screens: pull back so the disk fits, but not for close-up views.
		const aspect = width / height;
		const fit = aspect < 1 ? Math.pow(1 / aspect, 0.55) : 1;
		const rawDistance = Math.exp(pose.logDistance);
		const fitApplied = 1 + (fit - 1) * Math.min(1, Math.max(0, (rawDistance - 300) / 330));
		const distance = rawDistance * fitApplied;
		const polar = pose.polar + pointer.y * 0.05 * parallax;
		const azimuth = pose.azimuth + pointer.x * 0.07 * parallax + (reducedMotion ? 0 : Math.sin(clock * 0.05) * 0.01);

		target.set(pose.targetX, pose.targetY, pose.targetZ);
		const sp = Math.sin(polar);
		const cp = Math.cos(polar);
		const sa = Math.sin(azimuth);
		const ca = Math.cos(azimuth);
		position.set(sp * ca, cp, -sp * sa).multiplyScalar(distance).add(target);
		up.set(-cp * ca, sp, cp * sa);
		// Roll: views carry roll for a 360° budget; the setting scales it, phones get half, and
		// reduced motion removes it. Explore mode keeps its own (usually zero) roll.
		const rollScale = exploring ? 1 : reducedMotion ? 0 : (config.scrollRoll / 360) * (profile.mobile ? 0.5 : 1);
		forward.subVectors(target, position).normalize();
		up.applyAxisAngle(forward, pose.roll * rollScale);
		camera.position.copy(position);
		camera.up.copy(up);
		camera.lookAt(target);
	};

	const updateSunMarker = () => {
		if (!sunMarker) return;
		const tooClose = camera.position.distanceTo(sunPosition) < 25;
		projected.copy(sunPosition).project(camera);
		const visible = config.showSunMarker && !tooClose && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
		sunMarker.style.opacity = visible ? '1' : '0';
		if (visible) {
			const x = (projected.x * 0.5 + 0.5) * width;
			const y = (-projected.y * 0.5 + 0.5) * height;
			sunMarker.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
		}
	};

	const publishStats = (now: number) => {
		const elapsed = now - lastStatsAt;
		if (elapsed < 1000) return;
		const fps = Math.round((framesSinceStats * 1000) / elapsed);
		framesSinceStats = 0;
		lastStatsAt = now;
		const stars = STAR_LAYERS.reduce((sum, name) => {
			const { object } = layers[name];
			return sum + (object.visible ? Math.min(object.geometry.drawRange.count, data[name].count) : 0);
		}, 0);
		const stats: StarfieldStats = {
			mode: governor.state.tier,
			ceiling: profile.ceiling,
			fps,
			stars,
			drawCalls: renderer.info.render.calls,
			resolution: RESOLUTION_STEPS[governor.state.resolutionStep],
			reasons: profile.reasons,
		};
		if (statsOverlay) {
			statsOverlay.style.display = config.showStats ? 'block' : 'none';
			if (config.showStats) {
				statsOverlay.textContent =
					`tier ${stats.mode} (max ${stats.ceiling})  ${fps} fps\n` +
					`${stars.toLocaleString()} stars  ${stats.drawCalls} draws\n` +
					`dpr ${pixelRatio().toFixed(2)}  scroll ${(scrollProgress * 100).toFixed(0)}%`;
			}
		}
		const key = `${stats.mode}|${stats.fps}|${stats.stars}|${stats.resolution}|${stats.drawCalls}`;
		if (key !== lastStatsKey) {
			lastStatsKey = key;
			onStats(stats);
		}
	};

	const frame = (now: number) => {
		raf = requestAnimationFrame(frame);
		if (galaxyBus.paused) {
			lastRendered = 0;
			return;
		}
		const interval = 1000 / targetFps(now);
		const since = now - lastRendered;
		if (lastRendered && since < interval - 2) return;
		const frameMs = lastRendered ? since : interval;
		lastRendered = now;
		const dt = Math.min(frameMs, 100) / 1000;

		if (needsResize) applyResolution();

		clock = (clock + dt) % 6283;
		const orbitSeconds = Math.max(10, config.orbitMinutes * 60);
		const explore = galaxyBus.explore;
		const timeScale = explore?.active ? explore.timeScale : 1;
		if (config.rotation) {
			const step = dt * ((2 * Math.PI) / orbitSeconds) * (reducedMotion ? 0.1 : 1) * timeScale;
			shared.uTime.value += step;
			elapsedMyr += (step / (2 * Math.PI)) * 230; // one solar orbit ≈ 230 Myr
		}
		// Dim the galaxy for reading, but never on the hero or in explore mode.
		const reading =
			config.dimWhenReading && !explore?.active && scrollY > viewportH * 0.6 && now - lastScrollAt > 2500;
		dimNow = damp(dimNow, Math.max(galaxyBus.dim * 0.6, reading ? 0.28 : 0), 2, dt);
		shared.uClock.value = clock;
		fade = Math.min(1, fade + dt / 1.2);
		const eased = (fade * fade * (3 - 2 * fade)) * (1 - dimNow);

		for (const name of LAYER_NAMES) {
			const { object, style } = layers[name];
			const u = object.material.uniforms;
			const isStar = style.profile === 0;
			if (isStar) u.uSizeMul.value = config.starSize;
			u.uIntensity.value =
				style.intensity * eased *
				(isStar ? config.brightness : name === 'glow' ? config.glowIntensity : name === 'dust' ? 1 : config.brightness);
		}
		blackHoleMaterial.uniforms.uFade.value = eased;

		updateCamera(dt);
		updateSunMarker();
		renderer.render(scene, camera);
		if (pendingCapture) {
			// Must run in the same task as the render, while the drawing buffer is still valid.
			const resolve = pendingCapture;
			pendingCapture = null;
			canvas.toBlob((blob) => resolve(blob), 'image/png');
		}

		if (!readySent) {
			readySent = true;
			onReady();
		}
		framesSinceStats++;
		if (governor.sample(frameMs, interval, now) === 'changed') applyQuality();
		publishStats(now);
	};

	// --- Public API -----------------------------------------------------------------
	const setConfig = (next: StarfieldConfig) => {
		config = next;
		reducedMotion = osReducedMotion && !config.overrideReducedMotion;
		syncTierWithConfig();
		applyQuality();
		applyBlackHole();
	};

	setConfig(config);
	readScroll();
	scrollProgress = scrollTarget;

	const api: GalaxyApi = {
		project(x, y, z) {
			const distance = camera.position.distanceTo(projected.set(x, y, z));
			projected.project(camera);
			return {
				x: (projected.x * 0.5 + 0.5) * width,
				y: (-projected.y * 0.5 + 0.5) * height,
				visible: projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15,
				distance,
			};
		},
		elapsedMyr: () => elapsedMyr,
		cameraDistanceLy: () => camera.position.distanceTo(target) * LY_PER_UNIT,
		pose: () => clonePose(pose),
		capture: () => new Promise<Blob | null>((resolve) => { pendingCapture = resolve; }),
	};
	galaxyBus.attach(api);
	raf = requestAnimationFrame(frame);

	return {
		setConfig,
		dispose: () => {
			disposed = true;
			cancelAnimationFrame(raf);
			galaxyBus.detach();
			window.removeEventListener('scroll', readScroll);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('pointermove', onPointer);
			window.removeEventListener('deviceorientation', onOrientation);
			document.removeEventListener('visibilitychange', onVisibility);
			motionQuery.removeEventListener?.('change', onMotionChange);
			canvas.removeEventListener('webglcontextlost', onContextLostEvent);
			if (battery) {
				battery.removeEventListener('levelchange', onBattery);
				battery.removeEventListener('chargingchange', onBattery);
			}
			for (const name of LAYER_NAMES) {
				layers[name].object.geometry.dispose();
				layers[name].object.material.dispose();
			}
			blackHole.geometry.dispose();
			blackHoleMaterial.dispose();
			renderer.dispose();
		},
	};
}
