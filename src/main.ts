import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";
import { Cartesian3, Ellipsoid, PerspectiveFrustum, type Viewer } from "cesium";
import { createViewer } from "@/globe/viewer";
import { initHud } from "@/globe/hud";
import { initBorders } from "@/globe/borders";
import { initStates } from "@/globe/states";
import { initLabels } from "@/globe/labels";
import { initClouds } from "@/globe/clouds";
import { initGlobeClick } from "@/globe/globeClick";
import { initCameraPopups } from "@/ui/cameraPopup";
import { initCameraInfoModal } from "@/ui/cameraInfoModal";
import { initSearchBar } from "@/ui/searchBar";
import { initPreloader, waitForTilesLoaded } from "@/ui/preloader";
import { clearSet } from "@/state/cameraSet";

const MAX_PRELOADER_MS = 30_000;
const MIN_PRELOADER_MS = 2_700;

const container = document.querySelector<HTMLDivElement>("#app");
if (container) void boot(container);

async function boot(host: HTMLDivElement): Promise<void> {
  const preloader = initPreloader();
  const minDelay = wait(MIN_PRELOADER_MS);

  const viewer = createViewer(host);

  const applyGlobeSize = (): void => {
    preloader.setSphereSize(computeGlobeScreenSize(viewer));
  };
  applyGlobeSize();
  window.addEventListener("resize", applyGlobeSize);

  initHud(viewer);
  initClouds(viewer);
  initCameraPopups();
  initCameraInfoModal();
  initSearchBar(viewer);
  initGlobeClick(viewer);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSet();
  });

  const ready = Promise.all([
    waitForTilesLoaded(viewer),
    initBorders(viewer).catch(() => {}),
    initStates(viewer).catch(() => {}),
    initLabels(viewer).catch(() => {}),
  ]);

  try {
    await Promise.race([ready, wait(MAX_PRELOADER_MS)]);
  } catch {}

  await minDelay;
  preloader.hide();
  window.removeEventListener("resize", applyGlobeSize);
}

function computeGlobeScreenSize(viewer: Viewer): number {
  const cameraPosition = viewer.camera.positionWC;
  const cameraDistance = Cartesian3.magnitude(cameraPosition);
  const earthRadius = Ellipsoid.WGS84.maximumRadius;
  const canvasHeight = viewer.scene.canvas.clientHeight;
  if (cameraDistance <= earthRadius) return canvasHeight;

  const halfAngle = Math.asin(earthRadius / cameraDistance);
  const angularDiameter = 2 * halfAngle;

  const frustum = viewer.camera.frustum;
  const fovy = frustum instanceof PerspectiveFrustum && frustum.fovy ? frustum.fovy : Math.PI / 3;

  return (angularDiameter / fovy) * canvasHeight;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
