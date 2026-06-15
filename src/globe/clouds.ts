import {
  Cartesian3,
  Color,
  ConstantProperty,
  Ellipsoid,
  ImageMaterialProperty,
  type Viewer,
} from "cesium";
import { cameraAltitude } from "@/globe/geo";

const SHELL_HEIGHT_M = 18_000;
const FADE_START_M = 800_000;
const FADE_END_M = 3_000_000;
const MAX_ALPHA = 0.5;

export function initClouds(viewer: Viewer): void {
  const radii = Cartesian3.add(
    Ellipsoid.WGS84.radii,
    new Cartesian3(SHELL_HEIGHT_M, SHELL_HEIGHT_M, SHELL_HEIGHT_M),
    new Cartesian3(),
  );

  const material = new ImageMaterialProperty({
    image: "/textures/clouds.png",
    transparent: true,
    color: new ConstantProperty(Color.WHITE.withAlpha(0)),
  });

  const entity = viewer.entities.add({
    position: Cartesian3.ZERO,
    ellipsoid: {
      radii,
      material,
      slicePartitions: 64,
      stackPartitions: 64,
      outline: false,
    },
  });

  let lastAlpha = -1;
  viewer.scene.preRender.addEventListener(() => {
    const alpha = cloudAlpha(cameraAltitude(viewer));
    if (Math.abs(alpha - lastAlpha) < 0.004) return;
    lastAlpha = alpha;
    material.color = new ConstantProperty(Color.WHITE.withAlpha(alpha));
    entity.show = alpha > 0.002;
  });
}

function cloudAlpha(altitudeMeters: number): number {
  if (altitudeMeters <= FADE_START_M) return 0;
  if (altitudeMeters >= FADE_END_M) return MAX_ALPHA;
  return (MAX_ALPHA * (altitudeMeters - FADE_START_M)) / (FADE_END_M - FADE_START_M);
}
