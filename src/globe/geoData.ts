export interface GeoFeature {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
}

export interface GeoCollection {
  features: GeoFeature[];
}

import { isMobile } from "@/device";

let countries: Promise<GeoCollection> | null = null;
let cities: Promise<GeoCollection> | null = null;
let statePolygons: Promise<GeoCollection> | null = null;
let stateLines: Promise<GeoCollection> | null = null;

export function loadCountries(): Promise<GeoCollection> {
  countries ??= fetchJson(isMobile ? "/data/countries-110m.geojson" : "/data/countries-50m.geojson");
  return countries;
}

export function loadCities(): Promise<GeoCollection> {
  cities ??= fetchJson(isMobile ? "/data/cities-mobile.geojson" : "/data/cities-10m.geojson");
  return cities;
}

export function loadStatePolygons(): Promise<GeoCollection> {
  if (isMobile) return Promise.resolve({ features: [] });
  statePolygons ??= fetchJson("/data/states-polygons.geojson");
  return statePolygons;
}

export function loadStateLines(): Promise<GeoCollection> {
  if (isMobile) return Promise.resolve({ features: [] });
  stateLines ??= fetchJson("/data/states-10m.geojson");
  return stateLines;
}

async function fetchJson(url: string): Promise<GeoCollection> {
  const response = await fetch(url);
  if (!response.ok) return { features: [] };
  return (await response.json()) as GeoCollection;
}
