import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  Material,
  Math as CesiumMath,
  PolylineMaterialAppearance,
  type Viewer,
} from "cesium";
import { isMobile } from "@/device";
import { cameraAltitude, centerCoordinates } from "@/globe/geo";
import { loadStateLines } from "@/globe/geoData";
import { findCounty } from "@/globe/reverseGeo";

const MAX_ALTITUDE_M = 2_500_000;
const PAD_DEG = 3;
const FADE_MS = 350;
const TARGET_ALPHA = 0.85;
const DASH_LENGTH = 12;
const WIDTH = 2;

interface CountryState {
  name: string;
  lines: number[][][];
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  primitive: GroundPolylinePrimitive | null;
  material: Material | null;
  alpha: number;
  targetAlpha: number;
  fadeStart: number;
  fadeFrom: number;
}

interface LineGeometry {
  type: string;
  coordinates: unknown;
}

interface LineFeature {
  geometry: LineGeometry | null;
  properties: Record<string, unknown>;
}

const states: CountryState[] = [];

export async function initStates(viewer: Viewer): Promise<void> {
  if (isMobile) return;
  const data = await loadStateLines();
  buildIndex(data.features as LineFeature[]);

  let rafRunning = false;

  const tick = (): void => {
    const now = performance.now();
    let animating = false;
    for (const state of states) {
      if (state.alpha === state.targetAlpha) continue;
      const t = Math.min(1, (now - state.fadeStart) / FADE_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      state.alpha = t >= 1 ? state.targetAlpha : state.fadeFrom + (state.targetAlpha - state.fadeFrom) * eased;
      if (t < 1) animating = true;
      if (state.material) state.material.uniforms.color = Color.WHITE.withAlpha(state.alpha);
      if (state.primitive) state.primitive.show = state.alpha > 0.005;
    }
    viewer.scene.requestRender();
    if (animating) requestAnimationFrame(tick);
    else rafRunning = false;
  };

  const ensureRaf = (): void => {
    if (!rafRunning) {
      rafRunning = true;
      requestAnimationFrame(tick);
    }
  };

  const startFade = (state: CountryState, target: number): void => {
    if (state.targetAlpha === target) return;
    state.fadeFrom = state.alpha;
    state.targetAlpha = target;
    state.fadeStart = performance.now();
    if (target > 0 && !state.primitive) buildPrimitive(viewer, state);
    ensureRaf();
  };

  const update = (): void => {
    const tooHigh = cameraAltitude(viewer) > MAX_ALTITUDE_M;
    const center = tooHigh ? null : centerCoordinates(viewer);
    for (const state of states) {
      const inside =
        center !== null &&
        center.lon >= state.minLng - PAD_DEG &&
        center.lon <= state.maxLng + PAD_DEG &&
        center.lat >= state.minLat - PAD_DEG &&
        center.lat <= state.maxLat + PAD_DEG;
      startFade(state, inside ? TARGET_ALPHA : 0);
    }
  };

  viewer.camera.moveEnd.addEventListener(update);
  update();
  setupCursorHover(viewer);
}

function setupCursorHover(viewer: Viewer): void {
  const canvas = viewer.scene.canvas;
  let pending = false;
  let lastX = 0;
  let lastY = 0;

  const flush = async (): Promise<void> => {
    pending = false;
    if (cameraAltitude(viewer) > MAX_ALTITUDE_M) {
      canvas.style.cursor = "";
      return;
    }
    const ray = viewer.camera.getPickRay(new Cartesian2(lastX, lastY));
    if (!ray) {
      canvas.style.cursor = "";
      return;
    }
    const position = viewer.scene.globe.pick(ray, viewer.scene);
    if (!position) {
      canvas.style.cursor = "";
      return;
    }
    const carto = Cartographic.fromCartesian(position);
    const lat = CesiumMath.toDegrees(carto.latitude);
    const lng = CesiumMath.toDegrees(carto.longitude);

    const county = await findCounty(lat, lng);
    canvas.style.cursor = county ? "pointer" : "";
  };

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    lastX = event.clientX - rect.left;
    lastY = event.clientY - rect.top;
    if (pending) return;
    pending = true;
    requestAnimationFrame(flush);
  });

  canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "";
  });
}

function buildIndex(features: LineFeature[]): void {
  const map = new Map<string, CountryState>();
  for (const feature of features) {
    if (!feature.geometry) continue;
    const name = feature.properties.ADM0_NAME;
    if (typeof name !== "string") continue;

    let state = map.get(name);
    if (!state) {
      state = {
        name,
        lines: [],
        minLng: Infinity,
        minLat: Infinity,
        maxLng: -Infinity,
        maxLat: -Infinity,
        primitive: null,
        material: null,
        alpha: 0,
        targetAlpha: 0,
        fadeStart: 0,
        fadeFrom: 0,
      };
      map.set(name, state);
    }

    for (const line of extractLines(feature.geometry)) {
      state.lines.push(line);
      for (const point of line) {
        if (point[0] < state.minLng) state.minLng = point[0];
        if (point[0] > state.maxLng) state.maxLng = point[0];
        if (point[1] < state.minLat) state.minLat = point[1];
        if (point[1] > state.maxLat) state.maxLat = point[1];
      }
    }
  }
  for (const state of map.values()) states.push(state);
}

function extractLines(geometry: LineGeometry): number[][][] {
  if (geometry.type === "LineString") return [geometry.coordinates as number[][]];
  if (geometry.type === "MultiLineString") return geometry.coordinates as number[][][];
  return [];
}

function buildPrimitive(viewer: Viewer, state: CountryState): void {
  const instances: GeometryInstance[] = [];
  for (const line of state.lines) {
    if (line.length < 2) continue;
    const positions = new Array<Cartesian3>(line.length);
    for (let i = 0; i < line.length; i++) {
      positions[i] = Cartesian3.fromDegrees(line[i][0], line[i][1]);
    }
    instances.push(
      new GeometryInstance({ geometry: new GroundPolylineGeometry({ positions, width: WIDTH }) }),
    );
  }
  if (instances.length === 0) return;

  state.material = Material.fromType(Material.PolylineDashType, {
    color: Color.WHITE.withAlpha(state.alpha),
    dashLength: DASH_LENGTH,
  });
  state.primitive = new GroundPolylinePrimitive({
    geometryInstances: instances,
    appearance: new PolylineMaterialAppearance({ material: state.material }),
  });
  state.primitive.show = state.alpha > 0.005;
  viewer.scene.primitives.add(state.primitive);
}
