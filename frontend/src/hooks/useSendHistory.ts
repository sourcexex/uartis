import { useCallback, useEffect, useRef, useState } from 'react';
import { DataFormat } from '../types';

/**
 * Send history (S1-12): a small, persistent ring buffer of the last 50
 * manually sent payloads. Recall with ↑/↓ inside the send textarea.
 *
 * Notes:
 * - Only manual sends are recorded (scheduled sends would flood the list);
 *   SendPanel records an entry after `onSend` reports success.
 * - Duplicates of the same (text, format) pair are moved to the front instead
 *   of accumulating.
 * - Storage is best-effort: a quota/parse failure leaves an empty history.
 */

export interface SendHistoryEntry {
  text: string;
  format: DataFormat;
  at: number;
}

const STORAGE_KEY = 'uartis_sendHistory';
const MAX_ENTRIES = 50;

function loadHistory(): SendHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: SendHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const candidate = item as Partial<SendHistoryEntry>;
      if (typeof candidate.text !== 'string' || candidate.text.length === 0) continue;
      if (candidate.format !== 'Text' && candidate.format !== 'Hex') continue;
      entries.push({
        text: candidate.text,
        format: candidate.format,
        at: typeof candidate.at === 'number' ? candidate.at : Date.now(),
      });
      if (entries.length >= MAX_ENTRIES) break;
    }
    return entries;
  } catch {
    return [];
  }
}

export function useSendHistory() {
  const [history, setHistory] = useState<SendHistoryEntry[]>(loadHistory);
  // Keep the latest history available to event handlers without recreating
  // the whole callback on every entry.
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Quota exceeded / storage disabled: history is best-effort.
    }
  }, [history]);

  const push = useCallback((text: string, format: DataFormat) => {
    if (!text.trim()) return;
    setHistory((prev) => {
      const rest = prev.filter((entry) => !(entry.text === text && entry.format === format));
      return [{ text, format, at: Date.now() }, ...rest].slice(0, MAX_ENTRIES);
    });
  }, []);

  return { history, historyRef, push };
}
