import type { WebcamsResponse } from "../src/types/windy";

const WINDY_ENDPOINT = "https://api.windy.com/webcams/api/v3/webcams";

const RADIUS_MIN_KM = 1;
const RADIUS_MAX_KM = 250;
const LIMIT_MIN = 1;
const LIMIT_MAX = 50;

export interface WebcamQuery {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
}

export class WindyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WindyRequestError";
  }
}

export function parseQuery(params: URLSearchParams): WebcamQuery | null {
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const radius = Number(params.get("radius"));
  const limit = Number(params.get("limit"));

  if (!isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!isFinite(lng) || lng < -180 || lng > 180) return null;

  return {
    lat,
    lng,
    radius: clamp(isFinite(radius) ? radius : 50, RADIUS_MIN_KM, RADIUS_MAX_KM),
    limit: clamp(isFinite(limit) ? limit : 25, LIMIT_MIN, LIMIT_MAX),
  };
}

export async function fetchWebcams(query: WebcamQuery, apiKey: string): Promise<WebcamsResponse> {
  const url = new URL(WINDY_ENDPOINT);
  url.searchParams.set("nearby", `${query.lat.toFixed(5)},${query.lng.toFixed(5)},${query.radius}`);
  url.searchParams.set("limit", String(query.limit));
  url.searchParams.set("include", "images,location,player");

  const response = await fetch(url, { headers: { "x-windy-api-key": apiKey } });

  if (!response.ok) {
    throw new WindyRequestError(response.status, `Windy a raspuns cu status ${response.status}`);
  }

  return (await response.json()) as WebcamsResponse;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
