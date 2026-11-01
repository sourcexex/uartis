import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { LogEntry } from '../types';
import { useTranslation } from '../i18n';
import { FALLBACK_LOG_LIMIT, LOG_LIMIT_CHANGED_EVENT, clampLogLimit } from '../constants';

/**
 * Event-driven serial log state (RFC #3 Step 4): replaces the 100 ms
 * full-clone polling of `get_logs` with a one-shot snapshot + incremental
 * `serial://frames` batches.
 *
 * Invariants:
 * - Snapshot carries (epoch, session); a snapshot that raced a `clear_logs`
 *   (epoch mismatch) or a newer snapshot (ticket) is discarded — cleared
 *   logs never resurrect.
 * - Dedupe is keyed by `(session, seq)`: `seq` restarts at 1 for every
 *   connection, so a plain `seq <= lastSeq` check would drop the first
 *   frames of a new session after a reconnect (S1-01).
 * - A batch whose session differs from the current one triggers a resync
 *   snapshot instead of an append. Batches arriving while the resync is in
 *   flight are queued (not dropped) and replayed once the snapshot lands.
 * - Old-session entries already on screen are kept as history; the snapshot
 *   only *appends* missing entries of the current session, so a reconnect
 *   never resurrects or reorders old rows.
 * - `dropped_before > 0` inserts a placeholder row so channel overload is
 *   visible instead of silent.
 * - The buffer cap comes from the backend (`get_log_limit`), so the setting,
 *   the UI and the exported file all agree (S1-04).
 */

interface FrameDto {
  session: number;
  seq: number;
  direction: 'Sent' | 'Received';
  len: number;
  timestamp: string;
  display_text: string;
  timestamp_formatted: string | null;
}

interface FrameBatchDto {
  session: number;
  first_seq: number;
  dropped_before: number;
  frames: FrameDto[];
}

interface LogsSnapshot {
  epoch: number;
  session: number;
  entries: LogEntry[];
}

/** How many batches to hold while a resync snapshot is in flight. */
const MAX_DEFERRED_BATCHES = 256;

export function useSerialLogs(enabled: boolean) {
  const { t } = useTranslation();
  // Async callbacks (event listener, snapshot) must not freeze the language
  // they were created with; read through a ref instead.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const epochRef = useRef(0);
  const sessionRef = useRef(0);
  const lastSeqRef = useRef(0);
  const clearedSeqRef = useRef(0);
  const pendingRef = useRef<LogEntry[]>([]);
  const rafRef = useRef<number | null>(null);
  const snapTicketRef = useRef(0);
  const maxEntriesRef = useRef(FALLBACK_LOG_LIMIT);
  const resyncRef = useRef(false);
  /** Timestamp gate: avoid a hot retry loop when the snapshot command fails. */
  const snapshotRetryAfterRef = useRef(0);
  const deferredBatchesRef = useRef<FrameBatchDto[]>([]);
  const disposedRef = useRef(false);
  // Provides the "latest" batch processor to the stable event listener and
  // to the deferred-replay loop without re-subscribing on every render.
  const processBatchRef = useRef<(batch: FrameBatchDto) => void>(() => {});

  const trim = useCallback((entries: LogEntry[]): LogEntry[] => {
    const max = maxEntriesRef.current;
    return entries.length > max ? entries.slice(entries.length - max) : entries;
  }, []);

  const flushPending = useCallback(() => {
    rafRef.current = null;
    if (pendingRef.current.length === 0) return;
    const batch = pendingRef.current;
    pendingRef.current = [];
    setLogs((prev) => trim([...prev, ...batch]));
  }, [trim]);

  const ensureFlushScheduled = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPending);
    }
  }, [flushPending]);

  /**
   * Snapshot = authoritative alignment for the *current* session.
   * - initial mount (empty state): show the whole backend buffer, including
   *   older sessions, so history survives a reload;
   * - reconnect (non-empty state): keep what we already have and append only
   *   the current-session entries with `seq` above what is already displayed.
   */
  const takeSnapshot = useCallback(async (): Promise<boolean> => {
    const ticket = ++snapTicketRef.current;
    try {
      const snap = await invoke<LogsSnapshot>('get_logs_snapshot');
      if (disposedRef.current) return false;
      if (ticket !== snapTicketRef.current) return true; // a newer snapshot wins
      if (snap.epoch !== epochRef.current) return false; // raced a clear: retry later
      epochRef.current = snap.epoch;
      sessionRef.current = snap.session;

      const entries = snap.entries ?? [];
      const snapshotSession = snap.session;
      const currentSessionEntries = entries.filter((entry) => (entry.session ?? snapshotSession) === snapshotSession);
      lastSeqRef.current = currentSessionEntries.reduce((max, entry) => Math.max(max, entry.seq ?? 0), 0);
      clearedSeqRef.current = 0;

      setLogs((prev) => {
        if (prev.length === 0) return trim(entries);
        const prevCurrentMax = prev.reduce(
          (max, entry) =>
            (entry.session ?? snapshotSession) === snapshotSession ? Math.max(max, entry.seq ?? 0) : max,
          0
        );
        const additions = currentSessionEntries.filter((entry) => (entry.seq ?? 0) > prevCurrentMax);
        if (additions.length === 0) return prev;
        return trim([...prev, ...additions]);
      });
      return true;
    } catch (error) {
      console.error('Failed to take logs snapshot:', error);
      return false;
    }
  }, [trim]);

  const processBatch = useCallback(
    (batch: FrameBatchDto) => {
      if (disposedRef.current) return;

      if (batch.session !== sessionRef.current) {
        // Keep the triggering batch as well: if the snapshot was taken just
        // before these frames were published, replaying it after the snapshot
        // appends them instead of losing them.
        if (deferredBatchesRef.current.length < MAX_DEFERRED_BATCHES) {
          deferredBatchesRef.current.push(batch);
        }
        if (resyncRef.current) return; // snapshot already in flight
        if (Date.now() < snapshotRetryAfterRef.current) return; // backoff
        resyncRef.current = true;
        // New session: seq restarts at 1, so the old high-water marks are
        // meaningless and must be reset *before* the snapshot is applied.
        lastSeqRef.current = 0;
        clearedSeqRef.current = 0;
        void takeSnapshot().then((applied) => {
          resyncRef.current = false;
          if (!applied) {
            // Backend/snapshot unavailable: retry at most once per second
            // instead of spinning; the queued batches stay bounded.
            snapshotRetryAfterRef.current = Date.now() + 1000;
            return;
          }
          const queued = deferredBatchesRef.current.splice(0);
          for (const deferred of queued) {
            processBatchRef.current(deferred);
          }
        });
        return;
      }

      const fresh: LogEntry[] = [];
      if (batch.dropped_before > 0) {
        fresh.push({
          timestamp: new Date().toISOString(),
          direction: 'Received',
          data: [],
          format: 'Text',
          port_name: '',
          display_text: tRef.current('logViewer.framesDropped').replace('{n}', String(batch.dropped_before)),
          timestamp_formatted: undefined,
          session: batch.session,
          gap_key: `gap-${batch.session}-${batch.first_seq}`,
        });
      }
      for (const frame of batch.frames) {
        // Ignore stale frames from a previous connection that the bridge
        // pump published after the session switch.
        if (frame.session !== sessionRef.current) continue;
        if (frame.seq <= lastSeqRef.current || frame.seq <= clearedSeqRef.current) {
          continue;
        }
        fresh.push({
          timestamp: frame.timestamp,
          direction: frame.direction,
          data: [],
          format: 'Text',
          port_name: '',
          display_text: frame.display_text,
          timestamp_formatted: frame.timestamp_formatted ?? undefined,
          seq: frame.seq,
          session: frame.session,
          byte_len: frame.len,
        });
        lastSeqRef.current = frame.seq;
      }
      if (fresh.length > 0) {
        pendingRef.current.push(...fresh);
        ensureFlushScheduled(); // rAF-throttled append
      }
    },
    [ensureFlushScheduled, takeSnapshot]
  );

  useEffect(() => {
    processBatchRef.current = processBatch;
  }, [processBatch]);

  // Keep the in-memory cap in sync with the backend setting (S1-04). The
  // backend is the single source of truth; fall back to 1000 if older.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void invoke<number>('get_log_limit')
      .then((limit) => {
        if (cancelled) return;
        if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
          maxEntriesRef.current = clampLogLimit(limit);
          setLogs((prev) => trim(prev));
        }
      })
      .catch((error) => {
        console.warn('Failed to read log limit, keeping fallback:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, trim]);

  // Settings changes the limit at runtime — follow it without polling.
  useEffect(() => {
    const handleLimitChanged = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === 'number' && Number.isFinite(detail) && detail > 0) {
        maxEntriesRef.current = clampLogLimit(detail);
        setLogs((prev) => trim(prev));
      }
    };
    window.addEventListener(LOG_LIMIT_CHANGED_EVENT, handleLimitChanged);
    return () => {
      window.removeEventListener(LOG_LIMIT_CHANGED_EVENT, handleLimitChanged);
    };
  }, [trim]);

  useEffect(() => {
    if (!enabled) return;
    disposedRef.current = false;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void takeSnapshot();

    listen<FrameBatchDto>('serial://frames', (event) => {
      if (cancelled || disposedRef.current) return;
      processBatchRef.current(event.payload);
    })
      .then((dispose) => {
        if (cancelled) {
          // Effect was torn down before `listen` resolved: remove the
          // listener we just obtained instead of leaking it.
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => console.error('Failed to listen serial://frames:', error));

    return () => {
      cancelled = true;
      disposedRef.current = true;
      unlisten?.();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingRef.current = [];
      deferredBatchesRef.current = [];
      resyncRef.current = false;
    };
  }, [enabled, takeSnapshot]);

  const clearLogs = useCallback(async () => {
    try {
      const epoch = await invoke<number>('clear_logs');
      epochRef.current = epoch;
      // Frames published before the clear may still be in flight; keep the
      // current high-water mark in `clearedSeqRef` so they cannot resurrect
      // cleared rows. (It is reset when the next session starts.)
      clearedSeqRef.current = lastSeqRef.current;
      pendingRef.current = [];
      deferredBatchesRef.current = [];
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }, []);

  /**
   * Replace the view with a fresh snapshot. Used after a display-setting
   * change: the backend re-renders buffered entries with the new settings
   * (FE-5), so the frontend must reload them instead of keeping the
   * pre-formatted `display_text` of already-rendered rows.
   */
  const resync = useCallback(async () => {
    const ticket = ++snapTicketRef.current;
    try {
      const snap = await invoke<LogsSnapshot>('get_logs_snapshot');
      if (disposedRef.current || ticket !== snapTicketRef.current) return;
      epochRef.current = snap.epoch;
      sessionRef.current = snap.session;
      const entries = snap.entries ?? [];
      lastSeqRef.current = entries
        .filter((entry) => (entry.session ?? snap.session) === snap.session)
        .reduce((max, entry) => Math.max(max, entry.seq ?? 0), 0);
      clearedSeqRef.current = 0;
      pendingRef.current = [];
      deferredBatchesRef.current = [];
      setLogs(trim(entries));
    } catch (error) {
      console.error('Failed to resync logs:', error);
    }
  }, [trim]);

  return { logs, clearLogs, resync };
}
