import type { VercelRequest, VercelResponse } from "@vercel/node";

const WINDY_ENDPOINT = "https://api.windy.com/webcams/api/v3/webcams";

const RADIUS_MIN_KM = 1;
const RADIUS_MAX_KM = 250;
const LIMIT_MIN = 1;
const LIMIT_MAX = 50;

interface WebcamQuery {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
}

class WindyRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WindyRequestError";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseQuery(params: URLSearchParams): WebcamQuery | null {
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

async function fetchWebcams(query: WebcamQuery, apiKey: string): Promise<unknown> {
  const url = new URL(WINDY_ENDPOINT);
  url.searchParams.set("nearby", `${query.lat.toFixed(5)},${query.lng.toFixed(5)},${query.radius}`);
  url.searchParams.set("limit", String(query.limit));
  url.searchParams.set("include", "images,location,player");

  const response = await fetch(url, { headers: { "x-windy-api-key": apiKey } });

  if (!response.ok) {
    throw new WindyRequestError(response.status, `Windy responded with status ${response.status}`);
  }

  return await response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = process.env.WINDY_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "WINDY_API_KEY missing on server" });
      return;
    }

    const host = req.headers.host ?? "localhost";
    const params = new URL(req.url ?? "", `http://${host}`).searchParams;
    const query = parseQuery(params);
    if (!query) {
      res.status(400).json({ error: "Invalid parameters (lat/lng required)" });
      return;
    }

    const data = await fetchWebcams(query, apiKey);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(data);
  } catch (error) {
    const status = error instanceof WindyRequestError ? 502 : 500;
    const message = error instanceof Error ? error.message : String(error);
    res.status(status).json({ error: "Function crashed", message });
  }
}
