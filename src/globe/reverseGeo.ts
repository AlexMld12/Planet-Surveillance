import { loadCities, loadCountries, loadStatePolygons } from "@/globe/geoData";

export interface CountryHit {
  name: string;
  iso2: string | null;
}

export interface CountyHit {
  name: string;
  iso2: string | null;
}

interface PreparedState {
  name: string;
  iso2: string | null;
  geometry: { type: string; coordinates: unknown };
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

const CITY_MAX_DISTANCE_KM = 80;

let preparedStates: Promise<PreparedState[]> | null = null;

export async function findCountry(lat: number, lng: number): Promise<CountryHit | null> {
  const data = await loadCountries();
  for (const feature of data.features) {
    if (!feature.geometry) continue;
    if (containsPoint(feature.geometry.type, feature.geometry.coordinates, lng, lat)) {
      const name = feature.properties.NAME;
      if (typeof name === "string") {
        return { name, iso2: resolveIso2(feature.properties) };
      }
    }
  }
  return null;
}

function resolveIso2(properties: Record<string, unknown>): string | null {
  const primary = properties.ISO_A2;
  if (typeof primary === "string" && primary !== "-99") return primary;
  const fallback = properties.ISO_A2_EH;
  if (typeof fallback === "string" && fallback !== "-99") return fallback;
  return null;
}

export async function findCounty(lat: number, lng: number): Promise<CountyHit | null> {
  const states = await getPreparedStates();
  for (const state of states) {
    if (lng < state.minLng || lng > state.maxLng || lat < state.minLat || lat > state.maxLat) continue;
    if (containsPoint(state.geometry.type, state.geometry.coordinates, lng, lat)) {
      return { name: state.name, iso2: state.iso2 };
    }
  }
  return null;
}

export async function findNearestCity(lat: number, lng: number): Promise<string | null> {
  const data = await loadCities();
  let best = Infinity;
  let city: string | null = null;
  for (const feature of data.features) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords)) continue;
    const cityLng = Number(coords[0]);
    const cityLat = Number(coords[1]);
    if (!isFinite(cityLng) || !isFinite(cityLat)) continue;
    const distance = haversineKm(lat, lng, cityLat, cityLng);
    if (distance < best && distance <= CITY_MAX_DISTANCE_KM) {
      best = distance;
      const name = feature.properties.name;
      if (typeof name === "string") city = name;
    }
  }
  return city;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function getPreparedStates(): Promise<PreparedState[]> {
  preparedStates ??= buildPreparedStates();
  return preparedStates;
}

async function buildPreparedStates(): Promise<PreparedState[]> {
  const data = await loadStatePolygons();
  const result: PreparedState[] = [];
  for (const feature of data.features) {
    if (!feature.geometry) continue;
    const name = feature.properties.name;
    const iso = feature.properties.iso_a2;
    if (typeof name !== "string") continue;
    const bbox = computeBbox(feature.geometry);
    if (!bbox) continue;
    result.push({
      name,
      iso2: typeof iso === "string" ? iso : null,
      geometry: feature.geometry,
      minLng: bbox[0],
      minLat: bbox[1],
      maxLng: bbox[2],
      maxLat: bbox[3],
    });
  }
  return result;
}

function computeBbox(
  geometry: { type: string; coordinates: unknown },
): [number, number, number, number] | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const walkRings = (rings: number[][][]): void => {
    for (const ring of rings) {
      for (const point of ring) {
        if (point[0] < minLng) minLng = point[0];
        if (point[0] > maxLng) maxLng = point[0];
        if (point[1] < minLat) minLat = point[1];
        if (point[1] > maxLat) maxLat = point[1];
      }
    }
  };
  if (geometry.type === "Polygon") {
    walkRings(geometry.coordinates as number[][][]);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates as number[][][][]) walkRings(polygon);
  } else {
    return null;
  }
  if (!isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function containsPoint(type: string, coordinates: unknown, lng: number, lat: number): boolean {
  if (type === "Polygon") return polygonContains(coordinates as number[][][], lng, lat);
  if (type === "MultiPolygon") {
    return (coordinates as number[][][][]).some((polygon) => polygonContains(polygon, lng, lat));
  }
  return false;
}

function polygonContains(rings: number[][][], lng: number, lat: number): boolean {
  if (rings.length === 0 || !ringContains(rings[0], lng, lat)) return false;
  for (let i = 1; i < rings.length; i++) {
    if (ringContains(rings[i], lng, lat)) return false;
  }
  return true;
}

function ringContains(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
