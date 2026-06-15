import { Cartesian2, Cartographic, Math as CesiumMath, type Viewer } from "cesium";
import { cameraAltitude, centerCoordinates, type Coords } from "@/globe/geo";

export function initHud(viewer: Viewer): void {
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="hud-row"><span class="hud-label">Coord</span><span class="hud-value" data-coords>—</span></div>
    <div class="hud-row"><span class="hud-label">Altitude</span><span class="hud-value" data-alt>—</span></div>
  `;
  document.body.appendChild(hud);

  const coordsEl = hud.querySelector<HTMLSpanElement>("[data-coords]")!;
  const altEl = hud.querySelector<HTMLSpanElement>("[data-alt]")!;

  const canvas = viewer.scene.canvas;
  const cursor = new Cartesian2();
  let hasCursor = false;
  let scheduled = false;

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  };

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = event.clientX - rect.left;
    cursor.y = event.clientY - rect.top;
    hasCursor = true;
    schedule();
  });

  canvas.addEventListener("mouseleave", () => {
    hasCursor = false;
    schedule();
  });

  const update = (): void => {
    altEl.textContent = formatAltitude(cameraAltitude(viewer));
    const coords = (hasCursor ? pickGlobe(viewer, cursor) : null) ?? centerCoordinates(viewer);
    coordsEl.textContent = coords ? formatCoords(coords) : "—";
  };

  viewer.scene.postRender.addEventListener(update);
  update();
}

function pickGlobe(viewer: Viewer, screen: Cartesian2): Coords | null {
  const ray = viewer.camera.getPickRay(screen);
  if (!ray) return null;
  const position = viewer.scene.globe.pick(ray, viewer.scene);
  if (!position) return null;
  const carto = Cartographic.fromCartesian(position);
  return {
    lat: CesiumMath.toDegrees(carto.latitude),
    lon: CesiumMath.toDegrees(carto.longitude),
  };
}

function formatCoords({ lat, lon }: Coords): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

function formatAltitude(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(meters).toLocaleString("en-US")} m`;
}
