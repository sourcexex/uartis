/**
 * Cross-module constants that more than one layer needs to agree on.
 * Keep them tiny and dependency-free — this file must stay importable from
 * hooks, components and plain utilities alike.
 */

/** Backend clamps the log limit to this range (`SerialManager::set_max_log_entries`). */
export const MIN_LOG_LIMIT = 100;
export const MAX_LOG_LIMIT = 10000;

/** Default log limit used when the backend cannot be asked (older builds). */
export const FALLBACK_LOG_LIMIT = 1000;

/**
 * `window` event dispatched after the log limit was changed in Settings.
 * `useSerialLogs` listens for it so the in-memory buffer follows the new
 * limit without polling.
 */
export const LOG_LIMIT_CHANGED_EVENT = 'uartis:log-limit-changed';

export function clampLogLimit(value: number): number {
  if (Number.isNaN(value)) return FALLBACK_LOG_LIMIT;
  return Math.min(MAX_LOG_LIMIT, Math.max(MIN_LOG_LIMIT, Math.round(value)));
}
