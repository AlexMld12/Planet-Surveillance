import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  Ellipsoid,
  LabelStyle,
  NearFarScalar,
  VerticalOrigin,
  type Entity,
  type Viewer,
} from "cesium";
import { loadCities, loadCountries } from "@/globe/geoData";

const OUTLINE = Color.fromCssColorString("#05070d").withAlpha(0.9);
const ALWAYS_ON_TOP = Number.POSITIVE_INFINITY;

interface ManagedLabel {
  entity: Entity;
  position: Cartesian3;
  normal: Cartesian3;
  priority: number;
  maxDistance: number;
  minDx: number;
  minDy: number;
}

export async function initLabels(viewer: Viewer): Promise<void> {
  const source = new CustomDataSource("labels");
  void viewer.dataSources.add(source);

  const managed: ManagedLabel[] = [];
  await Promise.all([addCountryLabels(source, managed), addCityLabels(source, managed)]);

  const declutter = (): void => runDeclutter(viewer, managed);
  declutter();
  viewer.camera.moveEnd.addEventListener(declutter);
  viewer.scene.requestRender();
}

async function addCountryLabels(source: CustomDataSource, managed: ManagedLabel[]): Promise<void> {
  const data = await loadCountries();

  for (const feature of data.features) {
    const name = feature.properties.NAME;
    const lon = Number(feature.properties.LABEL_X);
    const lat = Number(feature.properties.LABEL_Y);
    if (typeof name !== "string" || !isFinite(lon) || !isFinite(lat)) continue;

    const rank = Number(feature.properties.LABELRANK ?? 6);
    const max = countryMaxDistance(rank);
    const position = Cartesian3.fromDegrees(lon, lat);

    const entity = source.entities.add({
      position,
      label: {
        text: name.toUpperCase(),
        font: "600 15px 'Segoe UI', system-ui, sans-serif",
        fillColor: Color.WHITE,
        outlineColor: OUTLINE,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: ALWAYS_ON_TOP,
        translucencyByDistance: new NearFarScalar(max * 0.55, 1, max, 0),
        distanceDisplayCondition: new DistanceDisplayCondition(0, max),
      },
    });

    managed.push({
      entity,
      position,
      normal: Ellipsoid.WGS84.geodeticSurfaceNormal(position, new Cartesian3()),
      priority: rank,
      maxDistance: max,
      minDx: 140,
      minDy: 22,
    });
  }
}

async function addCityLabels(source: CustomDataSource, managed: ManagedLabel[]): Promise<void> {
  const data = await loadCities();

  for (const feature of data.features) {
    const coords = feature.geometry?.coordinates;
    const name = feature.properties.name;
    if (typeof name !== "string" || !Array.isArray(coords)) continue;

    const rank = Number(feature.properties.scalerank ?? 10);
    const max = cityMaxDistance(rank);
    const position = Cartesian3.fromDegrees(Number(coords[0]), Number(coords[1]));

    const entity = source.entities.add({
      position,
      label: {
        text: name,
        font: "500 13px 'Segoe UI', system-ui, sans-serif",
        fillColor: Color.fromCssColorString("#eaf2ff"),
        outlineColor: OUTLINE,
        outlineWidth: 2.5,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.CENTER,
        disableDepthTestDistance: ALWAYS_ON_TOP,
        translucencyByDistance: new NearFarScalar(6_000, 1, max, 0),
        distanceDisplayCondition: new DistanceDisplayCondition(0, max),
      },
    });

    managed.push({
      entity,
      position,
      normal: Ellipsoid.WGS84.geodeticSurfaceNormal(position, new Cartesian3()),
      priority: 10 + rank,
      maxDistance: max,
      minDx: 90,
      minDy: 16,
    });
  }
}

function runDeclutter(viewer: Viewer, managed: ManagedLabel[]): void {
  const canvas = viewer.scene.canvas;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const camera = viewer.camera.positionWC;

  const candidates: { m: ManagedLabel; x: number; y: number }[] = [];
  const screen = new Cartesian2();

  for (const m of managed) {
    const dx = camera.x - m.position.x;
    const dy = camera.y - m.position.y;
    const dz = camera.z - m.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > m.maxDistance * m.maxDistance) {
      setShow(m, false);
      continue;
    }

    if (dx * m.normal.x + dy * m.normal.y + dz * m.normal.z < 0) {
      setShow(m, false);
      continue;
    }

    const projected = viewer.scene.cartesianToCanvasCoordinates(m.position, screen);
    if (!projected || projected.x < -50 || projected.y < -10 || projected.x > w + 50 || projected.y > h + 10) {
      setShow(m, false);
      continue;
    }

    candidates.push({ m, x: projected.x, y: projected.y });
  }

  candidates.sort((a, b) => a.m.priority - b.m.priority);

  const shown: { x: number; y: number; minDx: number; minDy: number }[] = [];
  for (const c of candidates) {
    let overlap = false;
    for (const s of shown) {
      const reqDx = Math.max(s.minDx, c.m.minDx);
      const reqDy = Math.max(s.minDy, c.m.minDy);
      if (Math.abs(s.x - c.x) < reqDx && Math.abs(s.y - c.y) < reqDy) {
        overlap = true;
        break;
      }
    }
    setShow(c.m, !overlap);
    if (!overlap) shown.push({ x: c.x, y: c.y, minDx: c.m.minDx, minDy: c.m.minDy });
  }

  viewer.scene.requestRender();
}

function setShow(m: ManagedLabel, visible: boolean): void {
  if (m.entity.label) m.entity.label.show = new ConstantProperty(visible);
}

function countryMaxDistance(labelRank: number): number {
  if (labelRank <= 1) return 30_000_000;
  if (labelRank <= 2) return 18_000_000;
  if (labelRank <= 3) return 9_000_000;
  if (labelRank <= 4) return 5_000_000;
  if (labelRank <= 5) return 2_800_000;
  if (labelRank <= 6) return 1_500_000;
  return 800_000;
}

function cityMaxDistance(scaleRank: number): number {
  if (scaleRank <= 2) return 2_000_000;
  if (scaleRank <= 4) return 1_000_000;
  if (scaleRank <= 6) return 500_000;
  if (scaleRank <= 7) return 250_000;
  if (scaleRank <= 8) return 130_000;
  return 70_000;
}
