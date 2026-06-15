import type { Webcam } from "@/types/windy";
import { clearSet, getState, navigateSlot, subscribe, type NotFoundPlace } from "@/state/cameraSet";
import { isMobile } from "@/device";

const POPUP_W = 340;
const POPUP_H = 290;
const MARGIN = 20;
const ENTER_MS = 320;
const SWAP_MS = 200;
const STAGGER_MS = 120;

const RESERVED_TL = { w: 360, h: 90 };
const RESERVED_BL = { w: 360, h: 220 };
const RESERVED_BR = { w: 280, h: 90 };

const MAX_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" class="cam-icon cam-icon--max" aria-hidden="true"><path d="M3 6V3h3M13 6V3h-3M3 10v3h3M13 10v3h-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

const RESTORE_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" class="cam-icon cam-icon--restore" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SlotEl {
  popup: HTMLElement;
  content: HTMLElement;
  rect: Rect;
  currentId: string;
}

export function initCameraPopups(): void {
  const slots: SlotEl[] = [];
  let lastWebcams: Webcam[] | null = null;
  let lastNotFound: NotFoundPlace | null = null;

  subscribe(render);
  render();

  function render(): void {
    const { webcams, slots: indices, notFound } = getState();
    const sourceChanged = webcams !== lastWebcams || notFound !== lastNotFound;
    lastWebcams = webcams;
    lastNotFound = notFound;

    if (sourceChanged) {
      while (slots.length) {
        const removed = slots.pop();
        if (!removed) break;
        removed.popup.classList.remove("cam-popup--in");
        removed.popup.classList.remove("cam-popup--max");
        const node = removed.popup;
        window.setTimeout(() => node.remove(), ENTER_MS);
      }
      syncBodyMaxed();
    }

    if (notFound) {
      if (slots.length === 0) {
        const rect = isMobile ? mobileRect() : findPosition([]);
        const slot = createSlot(0, rect);
        document.body.appendChild(slot.popup);
        slots.push(slot);
        window.setTimeout(() => slot.popup.classList.add("cam-popup--in"), 0);
      }
      fillNotFound(slots[0], notFound);
      return;
    }

    const needed = isMobile ? Math.min(1, indices.length) : indices.length;
    if (needed === 0) return;

    if (slots.length === 0) {
      const taken: Rect[] = [];
      for (let i = 0; i < needed; i++) {
        const rect = isMobile ? mobileRect() : findPosition(taken);
        taken.push(rect);
        const slot = createSlot(i, rect);
        document.body.appendChild(slot.popup);
        slots.push(slot);
        window.setTimeout(() => slot.popup.classList.add("cam-popup--in"), i * STAGGER_MS);
      }
    }

    const hideNav = webcams.length <= slots.length;
    for (let i = 0; i < slots.length; i++) {
      const webcam = webcams[indices[i]];
      if (!webcam) continue;
      swap(slots[i], webcam, i);
      slots[i].popup.classList.toggle("cam-popup--no-nav", hideNav);
      slots[i].popup.classList.remove("cam-popup--404");
    }
  }
}

function createSlot(index: number, rect: Rect): SlotEl {
  const popup = document.createElement("div");
  popup.className = isMobile ? "cam-popup cam-popup--center" : "cam-popup";
  if (!isMobile) {
    popup.style.left = `${rect.x}px`;
    popup.style.top = `${rect.y}px`;
  }
  popup.innerHTML = `
    <div class="cam-popup-head">
      <span class="cam-tag" data-cam>// CAM${index + 1}</span>
      <span class="cam-tag cam-tag--place" data-place></span>
      <button class="cam-popup-close" data-close aria-label="Close">×</button>
      <button class="cam-popup-max" data-maximize aria-label="Maximize">${MAX_ICON}${RESTORE_ICON}</button>
    </div>
    <div class="cam-popup-content" data-content></div>
    <div class="cam-popup-foot">
      <button class="cam-popup-nav" data-prev aria-label="Previous camera">‹</button>
      <button class="cam-popup-nav" data-next aria-label="Next camera">›</button>
    </div>
  `;
  popup.querySelector("[data-prev]")?.addEventListener("click", () => navigateSlot(index, -1));
  popup.querySelector("[data-next]")?.addEventListener("click", () => navigateSlot(index, 1));
  popup.querySelector("[data-close]")?.addEventListener("click", () => clearSet());
  popup.querySelector("[data-maximize]")?.addEventListener("click", () => {
    const willMaximize = !popup.classList.contains("cam-popup--max");
    if (willMaximize) {
      document.querySelectorAll(".cam-popup--max").forEach((el) => el.classList.remove("cam-popup--max"));
    }
    popup.classList.toggle("cam-popup--max", willMaximize);
    syncBodyMaxed();
  });

  if (!isMobile) makeDraggable(popup);

  return {
    popup,
    content: popup.querySelector<HTMLElement>("[data-content]")!,
    rect,
    currentId: "",
  };
}

function swap(slot: SlotEl, webcam: Webcam, slotIndex: number): void {
  const id = String(webcam.webcamId);
  if (slot.currentId === id) return;

  const camEl = slot.popup.querySelector<HTMLElement>("[data-cam]");
  if (camEl) camEl.textContent = `// CAM${slotIndex + 1}`;

  const placeEl = slot.popup.querySelector<HTMLElement>("[data-place]");
  if (placeEl) placeEl.textContent = formatPlace(webcam.location.city, webcam.location.country);

  if (slot.currentId === "") {
    slot.content.innerHTML = renderMedia(webcam);
    slot.currentId = id;
    return;
  }

  slot.content.classList.add("cam-popup-content--out");
  slot.currentId = id;
  window.setTimeout(() => {
    if (slot.currentId !== id) return;
    slot.content.innerHTML = renderMedia(webcam);
    slot.content.classList.remove("cam-popup-content--out");
  }, SWAP_MS);
}

function fillNotFound(slot: SlotEl, notFound: NotFoundPlace): void {
  const camEl = slot.popup.querySelector<HTMLElement>("[data-cam]");
  if (camEl) camEl.textContent = "// CAM404";

  const placeEl = slot.popup.querySelector<HTMLElement>("[data-place]");
  if (placeEl) placeEl.textContent = formatPlace(notFound.city, notFound.country);

  slot.content.innerHTML = `<div class="cam-popup-not-found">No CAM found in this region</div>`;
  slot.currentId = "404";
  slot.popup.classList.add("cam-popup--404");
  slot.popup.classList.remove("cam-popup--no-nav");
}

function renderMedia(webcam: Webcam): string {
  if (webcam.player?.live) {
    return `<iframe src="${webcam.player.live}" allow="autoplay; fullscreen" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  }
  const image = webcam.images?.current.preview;
  if (image) {
    return `<img src="${image}" alt="${escapeHtml(webcam.title)}" loading="lazy" />`;
  }
  return `<div class="cam-popup-not-found">No stream available</div>`;
}

function formatPlace(city: string | null | undefined, country: string | null | undefined): string {
  const parts = [city, country].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase());
  return parts.length ? `// ${parts.join(", ")}` : "// UNKNOWN REGION";
}

function makeDraggable(popup: HTMLElement): void {
  const head = popup.querySelector<HTMLElement>(".cam-popup-head");
  if (!head) return;

  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  let active = false;

  head.addEventListener("pointerdown", (event) => {
    if (popup.classList.contains("cam-popup--max")) return;
    const target = event.target as Element | null;
    if (target && target.closest("button")) return;

    active = true;
    startX = event.clientX;
    startY = event.clientY;
    baseX = popup.offsetLeft;
    baseY = popup.offsetTop;
    head.setPointerCapture(event.pointerId);
    popup.classList.add("cam-popup--dragging");
    event.preventDefault();
  });

  head.addEventListener("pointermove", (event) => {
    if (!active) return;
    const maxX = window.innerWidth - popup.offsetWidth - 4;
    const maxY = window.innerHeight - popup.offsetHeight - 4;
    const x = clamp(baseX + (event.clientX - startX), 4, Math.max(4, maxX));
    const y = clamp(baseY + (event.clientY - startY), 4, Math.max(4, maxY));
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
  });

  const endDrag = (event: PointerEvent): void => {
    if (!active) return;
    active = false;
    popup.classList.remove("cam-popup--dragging");
    try {
      head.releasePointerCapture(event.pointerId);
    } catch {}
  };

  head.addEventListener("pointerup", endDrag);
  head.addEventListener("pointercancel", endDrag);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function syncBodyMaxed(): void {
  const hasMaxed = document.querySelector(".cam-popup.cam-popup--max") !== null;
  document.body.classList.toggle("has-maxed-popup", hasMaxed);
}

function findPosition(taken: Rect[]): Rect {
  const reserved = reservedZones();
  const maxX = window.innerWidth - POPUP_W - MARGIN;
  const maxY = window.innerHeight - POPUP_H - MARGIN;
  if (maxX <= MARGIN || maxY <= MARGIN) return mobileRect();

  for (let attempt = 0; attempt < 80; attempt++) {
    const x = MARGIN + Math.floor(Math.random() * (maxX - MARGIN));
    const y = MARGIN + Math.floor(Math.random() * (maxY - MARGIN));
    const rect: Rect = { x, y, w: POPUP_W, h: POPUP_H };
    if (reserved.every((r) => !overlaps(rect, r)) && taken.every((r) => !overlaps(rect, r))) {
      return rect;
    }
  }

  const idx = taken.length;
  const cols = Math.max(1, Math.floor((window.innerWidth - MARGIN) / (POPUP_W + 16)));
  return {
    x: MARGIN + (idx % cols) * (POPUP_W + 16),
    y: MARGIN + Math.floor(idx / cols) * (POPUP_H + 16),
    w: POPUP_W,
    h: POPUP_H,
  };
}

function reservedZones(): Rect[] {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return [
    { x: 0, y: 0, w: RESERVED_TL.w, h: RESERVED_TL.h },
    { x: 0, y: H - RESERVED_BL.h, w: RESERVED_BL.w, h: RESERVED_BL.h },
    { x: W - RESERVED_BR.w, y: H - RESERVED_BR.h, w: RESERVED_BR.w, h: RESERVED_BR.h },
  ];
}

function overlaps(a: Rect, b: Rect): boolean {
  return !(a.x + a.w + 12 < b.x || b.x + b.w + 12 < a.x || a.y + a.h + 12 < b.y || b.y + b.h + 12 < a.y);
}

function mobileRect(): Rect {
  const w = Math.min(POPUP_W, window.innerWidth - 24);
  return { x: (window.innerWidth - w) / 2, y: (window.innerHeight - POPUP_H) / 2, w, h: POPUP_H };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return "&quot;";
    }
  });
}
