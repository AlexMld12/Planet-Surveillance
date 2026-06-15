import {
  Cartographic,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from "cesium";
import { fetchNearbyWebcams } from "@/api/webcams";
import { clearSet, setNotFound, setWebcams, startLoading } from "@/state/cameraSet";
import {
  findCountry,
  findCounty,
  findNearestCity,
  haversineKm,
  normalizeName,
  type CountryHit,
  type CountyHit,
} from "@/globe/reverseGeo";
import type { Webcam } from "@/types/windy";

const RADIUS_KM = 250;
const FETCH_LIMIT = 50;

export function initGlobeClick(viewer: Viewer): void {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  let inFlight: AbortController | null = null;

  handler.setInputAction(async (event: ScreenSpaceEventHandler.PositionedEvent) => {
    const ray = viewer.camera.getPickRay(event.position);
    if (!ray) {
      clearSet();
      return;
    }
    const position = viewer.scene.globe.pick(ray, viewer.scene);
    if (!position) {
      clearSet();
      return;
    }

    const carto = Cartographic.fromCartesian(position);
    const lat = CesiumMath.toDegrees(carto.latitude);
    const lng = CesiumMath.toDegrees(carto.longitude);

    const country = await findCountry(lat, lng);
    if (!country) {
      clearSet();
      return;
    }

    inFlight?.abort();
    inFlight = new AbortController();
    const signal = inFlight.signal;
    startLoading({ lat, lng });

    const countyPromise = findCounty(lat, lng).catch(() => null);

    let data;
    try {
      data = await fetchNearbyWebcams({ lat, lng, radiusKm: RADIUS_KM, limit: FETCH_LIMIT }, signal);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      const city = await findNearestCity(lat, lng);
      setNotFound({ lat, lng }, { city, country: country.name });
      return;
    }

    const county = await countyPromise;

    const filtered = data.webcams.filter((webcam) => {
      if (!matchesCountry(webcam, country)) return false;
      if (county && !matchesCounty(webcam, county)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const da = haversineKm(lat, lng, a.location.latitude, a.location.longitude);
      const db = haversineKm(lat, lng, b.location.latitude, b.location.longitude);
      return da - db;
    });

    if (filtered.length === 0) {
      const city = await findNearestCity(lat, lng);
      setNotFound({ lat, lng }, { city, country: county?.name ?? country.name });
    } else {
      setWebcams(filtered, { lat, lng });
    }
  }, ScreenSpaceEventType.LEFT_CLICK);
}

function matchesCountry(webcam: Webcam, country: CountryHit): boolean {
  if (country.iso2 && webcam.location.country_code) {
    return webcam.location.country_code.toUpperCase() === country.iso2.toUpperCase();
  }
  return normalizeName(webcam.location.country) === normalizeName(country.name);
}

function matchesCounty(webcam: Webcam, county: CountyHit): boolean {
  if (!webcam.location.region) return false;
  return normalizeName(webcam.location.region) === normalizeName(county.name);
}
