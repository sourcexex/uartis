/**
 * Glass-material capability helpers.
 *
 * `resolveReducedTransparency` is pure so the fallback logic can be unit
 * tested without a real browser.
 */
export function supportsBackdropFilter(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
}

export function prefersReducedTransparency(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
}

/**
 * Priority:
 * 1. explicit user preference (localStorage)
 * 2. OS reduced-transparency preference
 * 3. no backdrop-filter support -> solid fallback
 */
export function resolveReducedTransparency(
  stored: string | null,
  mediaReduced: boolean,
  supported: boolean = supportsBackdropFilter()
): boolean {
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return mediaReduced || !supported;
}
