import { Cartesian3, Ion, Terrain, Viewer } from "cesium";
import { isMobile } from "@/device";

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

export function createViewer(container: HTMLElement): Viewer {
  if (ionToken) {
    Ion.defaultAccessToken = ionToken;
  }

  const viewer = new Viewer(container, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    useBrowserRecommendedResolution: isMobile,
  });

  if (ionToken) {
    viewer.scene.setTerrain(Terrain.fromWorldTerrain());
  }

  viewer.resolutionScale = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  viewer.scene.msaaSamples = isMobile ? 1 : 4;
  viewer.scene.postProcessStages.fxaa.enabled = true;
  viewer.scene.globe.maximumScreenSpaceError = isMobile ? 3 : 2;
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const controller = viewer.scene.screenSpaceCameraController;
  controller.minimumZoomDistance = 150;
  controller.maximumZoomDistance = 25_000_000;

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(25, 30, 22_000_000),
  });

  return viewer;
}
