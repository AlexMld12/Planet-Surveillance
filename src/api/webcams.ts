import type { WebcamsResponse } from "@/types/windy";

export interface NearbyParams {
  lat: number;
  lng: number;
  radiusKm: number;
  limit: number;
}

export async function fetchNearbyWebcams(params: NearbyParams, signal: AbortSignal): Promise<WebcamsResponse> {
  const query = new URLSearchParams({
    lat: params.lat.toFixed(5),
    lng: params.lng.toFixed(5),
    radius: String(Math.round(params.radiusKm)),
    limit: String(params.limit),
  });

  const response = await fetch(`/api/webcams?${query}`, { signal });
  if (!response.ok) {
    throw new Error(`Proxy webcams a raspuns cu status ${response.status}`);
  }

  return (await response.json()) as WebcamsResponse;
}
