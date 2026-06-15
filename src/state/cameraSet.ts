import type { Webcam } from "@/types/windy";

export const SLOT_COUNT = 4;

export interface CameraSetLocation {
  lat: number;
  lng: number;
}

export interface NotFoundPlace {
  city: string | null;
  country: string | null;
}

export interface CameraSetState {
  webcams: Webcam[];
  slots: number[];
  location: CameraSetLocation | null;
  loading: boolean;
  notFound: NotFoundPlace | null;
}

let state: CameraSetState = {
  webcams: [],
  slots: [],
  location: null,
  loading: false,
  notFound: null,
};
const listeners = new Set<() => void>();

export function getState(): CameraSetState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function startLoading(location: CameraSetLocation): void {
  state = { webcams: [], slots: [], location, loading: true, notFound: null };
  emit();
}

export function setWebcams(webcams: Webcam[], location: CameraSetLocation): void {
  const initial = Array.from({ length: Math.min(SLOT_COUNT, webcams.length) }, (_, i) => i);
  state = { webcams, slots: initial, location, loading: false, notFound: null };
  emit();
}

export function setNotFound(location: CameraSetLocation, place: NotFoundPlace): void {
  state = { webcams: [], slots: [], location, loading: false, notFound: place };
  emit();
}

export function navigateSlot(slot: number, delta: number): void {
  const total = state.webcams.length;
  if (total === 0 || slot < 0 || slot >= state.slots.length) return;

  let idx = state.slots[slot];
  for (let step = 0; step < total; step++) {
    idx = (idx + delta + total) % total;
    const occupied = state.slots.some((other, i) => i !== slot && other === idx);
    if (!occupied) {
      const next = state.slots.slice();
      next[slot] = idx;
      state = { ...state, slots: next };
      emit();
      return;
    }
  }

  const next = state.slots.slice();
  next[slot] = (state.slots[slot] + delta + total) % total;
  state = { ...state, slots: next };
  emit();
}

export function clearSet(): void {
  state = { webcams: [], slots: [], location: null, loading: false, notFound: null };
  emit();
}
