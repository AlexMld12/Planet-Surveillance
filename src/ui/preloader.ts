import type { Viewer } from "cesium";

const STAR_COUNT = 180;

const PRELOADER_SVG = `
<svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5,400 A395,395 0 0,1 795,400 A395,395 0 0,1 5,400"/>
  <path d="M119,400 A281,395 0 0,1 681,400 A281,395 0 0,1 119,400"/>
  <path d="M230,400 A170,395 0 0,1 570,400 A170,395 0 0,1 230,400"/>
  <path d="M345,400 A55,395 0 0,1 455,400 A55,395 0 0,1 345,400"/>
  <path d="M5,400 A395,45 0 0,1 795,400 A395,45 0 0,1 5,400"/>
  <path d="M58,207 A342,26 0 0,1 742,207 A342,26 0 0,1 58,207"/>
  <path d="M221,52 A179,4 0 0,1 579,52 A179,4 0 0,1 221,52"/>
  <path d="M58,593 A342,26 0 0,1 742,593 A342,26 0 0,1 58,593"/>
  <path d="M221,748 A179,4 0 0,1 579,748 A179,4 0 0,1 221,748"/>
</svg>`;

export interface PreloaderHandle {
  setSphereSize: (sizePx: number) => void;
  hide: () => void;
}

export function initPreloader(): PreloaderHandle {
  const root = document.createElement("div");
  root.className = "preloader";
  root.appendChild(buildStars());

  const sphere = document.createElement("div");
  sphere.className = "preloader-sphere";
  sphere.innerHTML = PRELOADER_SVG;
  root.appendChild(sphere);

  document.body.appendChild(root);

  return {
    setSphereSize: (sizePx: number): void => {
      sphere.style.width = `${sizePx}px`;
      sphere.style.height = `${sizePx}px`;
    },
    hide: (): void => {
      root.classList.add("preloader--out");
      window.setTimeout(() => root.remove(), 1400);
    },
  };
}

function buildStars(): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "preloader-stars";
  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement("span");
    star.className = "preloader-star";
    const size = 1 + Math.random() * 1.6;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.opacity = String(0.25 + Math.random() * 0.7);
    star.style.animationDelay = `${Math.random() * 5}s`;
    layer.appendChild(star);
  }
  return layer;
}

export function waitForTilesLoaded(viewer: Viewer): Promise<void> {
  return new Promise((resolve) => {
    if (viewer.scene.globe.tilesLoaded) {
      resolve();
      return;
    }
    const handler = (): void => {
      if (viewer.scene.globe.tilesLoaded) {
        viewer.scene.globe.tileLoadProgressEvent.removeEventListener(handler);
        resolve();
      }
    };
    viewer.scene.globe.tileLoadProgressEvent.addEventListener(handler);
  });
}
