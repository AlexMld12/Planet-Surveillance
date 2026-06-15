import { getState, subscribe } from "@/state/cameraSet";
import type { Webcam } from "@/types/windy";
import { isMobile } from "@/device";

type MediaKind = "live" | "timelapse" | "image" | "none";

const BADGE_LABEL: Record<MediaKind, string> = {
  live: "● LIVE",
  timelapse: "TIMELAPSE",
  image: "IMAGINE",
  none: "—",
};

export function initCameraInfoModal(): void {
  const modal = document.createElement("div");
  modal.className = "cam-info";
  modal.innerHTML = `
    <div class="cam-info-place" data-place></div>
    <ul class="cam-info-list" data-list></ul>
  `;
  document.body.appendChild(modal);

  const placeEl = modal.querySelector<HTMLElement>("[data-place]")!;
  const listEl = modal.querySelector<HTMLUListElement>("[data-list]")!;

  subscribe(render);
  render();

  function render(): void {
    const { webcams, slots, loading, notFound } = getState();

    if (webcams.length === 0 && !loading && !notFound) {
      modal.classList.remove("cam-info--visible");
      return;
    }
    modal.classList.add("cam-info--visible");

    if (loading && webcams.length === 0) {
      placeEl.textContent = "// SEARCHING CAMERAS...";
      listEl.innerHTML = "";
      return;
    }

    if (notFound) {
      placeEl.textContent = formatPlace(notFound.city, notFound.country);
      listEl.innerHTML = "";
      const li = document.createElement("li");
      li.className = "cam-info-row";
      li.innerHTML = `
        <span class="cam-info-tag">CAM404</span>
        <span class="cam-info-title"></span>
      `;
      const titleEl = li.querySelector<HTMLElement>(".cam-info-title");
      if (titleEl) titleEl.textContent = "No CAM found in this region";
      listEl.appendChild(li);
      return;
    }

    const first = webcams[0];
    placeEl.textContent = formatPlace(first.location.city, first.location.country, first.location.region);

    listEl.innerHTML = "";
    const visibleSlots = isMobile ? Math.min(1, slots.length) : slots.length;
    for (let i = 0; i < visibleSlots; i++) {
      const webcam = webcams[slots[i]];
      if (!webcam) continue;
      const kind = mediaKind(webcam);
      const li = document.createElement("li");
      li.className = "cam-info-row";
      li.innerHTML = `
        <span class="cam-info-tag">CAM${i + 1}</span>
        <span class="cam-info-badge cam-info-badge--${kind}">${BADGE_LABEL[kind]}</span>
        <span class="cam-info-title"></span>
      `;
      const titleEl = li.querySelector<HTMLElement>(".cam-info-title");
      if (titleEl) titleEl.textContent = webcam.title;
      listEl.appendChild(li);
    }
  }
}

function formatPlace(...parts: (string | null | undefined)[]): string {
  const filtered = parts.filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase());
  return filtered.length ? `// ${filtered.join(", ")}` : "// UNKNOWN REGION";
}

function mediaKind(webcam: Webcam): MediaKind {
  if (webcam.player?.live) return "live";
  if (webcam.images?.current.preview) return webcam.player?.day ? "timelapse" : "image";
  return "none";
}
