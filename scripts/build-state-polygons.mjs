import fs from "node:fs";
import path from "node:path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const OUTPUT = path.resolve("public/data/states-polygons.geojson");
const TOLERANCE = 0.03;
const DECIMALS = 3;

const DEC_FACTOR = 10 ** DECIMALS;
const round = (value) => Math.round(value * DEC_FACTOR) / DEC_FACTOR;

function distFromSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function dp(points, eps) {
  if (points.length <= 2) return points.slice();
  let maxDistance = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const distance = distFromSegment(points[i], points[0], points[last]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance > eps) {
    const left = dp(points.slice(0, index + 1), eps);
    const right = dp(points.slice(index), eps);
    return left.concat(right.slice(1));
  }
  return [points[0], points[last]];
}

function simplifyRing(ring) {
  const simplified = dp(ring, TOLERANCE);
  if (simplified.length < 4) return null;
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([first[0], first[1]]);
  return simplified.map((p) => [round(p[0]), round(p[1])]);
}

function simplifyPolygon(rings) {
  const out = [];
  for (const ring of rings) {
    const result = simplifyRing(ring);
    if (result && result.length >= 4) out.push(result);
  }
  return out.length > 0 ? out : null;
}

function simplifyGeometry(geometry) {
  if (geometry.type === "Polygon") {
    const polygon = simplifyPolygon(geometry.coordinates);
    return polygon ? { type: "Polygon", coordinates: polygon } : null;
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates.map(simplifyPolygon).filter(Boolean);
    return polygons.length > 0 ? { type: "MultiPolygon", coordinates: polygons } : null;
  }
  return null;
}

console.log("Fetching admin_1 polygons (10m)...");
const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Fetch failed: ${response.status}`);
}
const text = await response.text();
console.log(`Source: ${(text.length / 1024 / 1024).toFixed(1)} MB`);
const data = JSON.parse(text);
console.log(`Features: ${data.features.length}`);

const out = [];
for (const feature of data.features) {
  if (!feature.geometry) continue;
  const geometry = simplifyGeometry(feature.geometry);
  if (!geometry) continue;
  out.push({
    type: "Feature",
    properties: {
      name: feature.properties.name,
      admin: feature.properties.admin,
      iso_a2: feature.properties.iso_a2,
    },
    geometry,
  });
}

const output = { type: "FeatureCollection", features: out };
const json = JSON.stringify(output);
fs.writeFileSync(OUTPUT, json);
console.log(`Wrote ${out.length} features, ${(json.length / 1024 / 1024).toFixed(2)} MB to ${OUTPUT}`);
