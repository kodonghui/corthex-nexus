// SPEC-053: the geometry is kept separate from the picture so viewing never writes a saved position.
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.1;

export function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

// Coarse steps at normal magnifications and smaller, reversible steps for very large diagrams.
export function zoomStep(value, direction) {
  const step = (number) => clampZoom(Math.round(number * 1000) / 1000);
  if (direction < 0) {
    if (value <= 0.025) return MIN_ZOOM;
    if (Math.round(value * 1000) <= 100) return step(value / 2);
    return step(Math.max(0.1, value - ZOOM_STEP));
  }
  if (value <= MIN_ZOOM) return 0.025;
  if (value < 0.1) return step(value * 2);
  return step(value + ZOOM_STEP);
}

export function fitZoom(width, height, availableWidth, availableHeight) {
  if (width <= 0 || height <= 0 || availableWidth <= 0 || availableHeight <= 0) return 1;
  return clampZoom(Math.floor(Math.min(availableWidth / width, availableHeight / height) * 1000) / 1000);
}

// Keep the point beneath the pointer in the same place in the viewport after a scale change.
export function zoomScroll(scroll, pointer, oldScale, newScale) {
  return Math.max(0, (scroll + pointer) * newScale / oldScale - pointer);
}
