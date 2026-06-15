import { Cartesian3, Cartographic, IonGeocoderService, Rectangle, type Viewer } from "cesium";

export function initSearchBar(viewer: Viewer): void {
  const wrap = document.createElement("div");
  wrap.className = "search-bar";
  wrap.innerHTML = `
    <input type="text" class="search-bar-input" placeholder="Type a country or city to surveile" />
    <div class="search-bar-status" data-status></div>
  `;
  document.body.appendChild(wrap);

  const input = wrap.querySelector<HTMLInputElement>(".search-bar-input")!;
  const status = wrap.querySelector<HTMLElement>("[data-status]")!;
  const service = new IonGeocoderService({ scene: viewer.scene });

  input.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    const query = input.value.trim();
    if (!query) return;

    status.textContent = "Searching...";
    try {
      const results = await service.geocode(query);
      if (results.length === 0) {
        status.textContent = "No results found";
        return;
      }
      const destination = liftDestination(results[0].destination);
      status.textContent = "";
      void viewer.camera.flyTo({ destination, duration: 1.5 });
    } catch {
      status.textContent = "Search failed";
    }
  });
}

function liftDestination(destination: Cartesian3 | Rectangle): Cartesian3 | Rectangle {
  if (destination instanceof Rectangle) return destination;
  const carto = Cartographic.fromCartesian(destination);
  return Cartesian3.fromRadians(carto.longitude, carto.latitude, 80_000);
}
