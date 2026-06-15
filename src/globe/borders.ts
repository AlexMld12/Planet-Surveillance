import { ArcType, Cartesian3, Color, ColorMaterialProperty, CustomDataSource, type Viewer } from "cesium";
import { loadCountries } from "@/globe/geoData";

type LinearRing = number[][];
type PolygonCoords = LinearRing[];

export async function initBorders(viewer: Viewer): Promise<void> {
  const data = await loadCountries();
  const source = new CustomDataSource("borders");
  const stroke = new ColorMaterialProperty(Color.WHITE.withAlpha(0.8));

  for (const feature of data.features) {
    if (!feature.geometry) continue;
    for (const rings of toPolygons(feature.geometry.type, feature.geometry.coordinates)) {
      for (const ring of rings) {
        addRing(source, ring, stroke);
      }
    }
  }

  void viewer.dataSources.add(source);
  viewer.scene.requestRender();
}

function toPolygons(type: string, coordinates: unknown): PolygonCoords[] {
  if (type === "Polygon") return [coordinates as PolygonCoords];
  if (type === "MultiPolygon") return coordinates as PolygonCoords[];
  return [];
}

function addRing(source: CustomDataSource, ring: LinearRing, material: ColorMaterialProperty): void {
  const flat: number[] = [];
  for (const point of ring) {
    flat.push(point[0], point[1]);
  }
  if (flat.length < 6) return;

  source.entities.add({
    polyline: {
      positions: Cartesian3.fromDegreesArray(flat),
      width: 1.4,
      material,
      clampToGround: true,
      arcType: ArcType.GEODESIC,
    },
  });
}
