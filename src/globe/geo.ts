import { Cartesian2, Cartographic, Math as CesiumMath, type Viewer } from "cesium";

export interface Coords {
  lat: number;
  lon: number;
}

export function cameraAltitude(viewer: Viewer): number {
  const carto = viewer.camera.positionCartographic;
  const ground = viewer.scene.globe.getHeight(carto) ?? 0;
  return Math.max(0, carto.height - ground);
}

export function centerCoordinates(viewer: Viewer): Coords | null {
  const canvas = viewer.scene.canvas;
  const screenCenter = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const ray = viewer.camera.getPickRay(screenCenter);
  if (!ray) return null;

  const position = viewer.scene.globe.pick(ray, viewer.scene);
  if (!position) return null;

  const carto = Cartographic.fromCartesian(position);
  return {
    lat: CesiumMath.toDegrees(carto.latitude),
    lon: CesiumMath.toDegrees(carto.longitude),
  };
}
