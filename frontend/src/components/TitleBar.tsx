import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy, Minus, Square, X } from 'lucide-react';
import { isMacPlatform } from '../utils/platform';

export interface TitleBarColors {
  bgHeader: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  bgHover: string;
  danger: string;
}

interface TitleBarProps {
  colors: TitleBarColors;
}

/**
 * T1 spike: a minimal custom title bar.
 *
 * - Windows/Linux: the native decorations are removed in the Rust setup hook,
 *   so this bar owns dragging and the three caption buttons.
 * - macOS: the window keeps native decorations with `titleBarStyle: overlay`
 *   and `hiddenTitle`, so the traffic lights stay native and this component
 *   only draws the content area (with a left safe area for them).
 *
 * The bar is intentionally self-contained and does not touch app state; the
 * real component will live in the Fluent shell.
 */
export default function TitleBar({ colors }: TitleBarProps) {
  const isMac = isMacPlatform();
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = async () => {
      try {
        const value = await appWindow.isMaximized();
        if (!disposed) setMaximized(value);
      } catch {
        // Not running inside Tauri (e.g. plain `vite` preview): ignore.
      }
    };

    void sync();
    appWindow
      .onResized(() => {
        void sync();
      })
      .then((stop) => {
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
        }
      })
      .catch(() => {
        // No window event API outside Tauri.
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [appWindow]);

  const minimize = useCallback(() => {
    void appWindow.minimize().catch(console.error);
  }, [appWindow]);

  const toggleMaximize = useCallback(() => {
    void appWindow.toggleMaximize().catch(console.error);
  }, [appWindow]);

  const close = useCallback(() => {
    void appWindow.close().catch(console.error);
  }, [appWindow]);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center shrink-0 select-none glass-surface"
      style={{
        height: 36,
        borderBottom: `1px solid ${colors.border}`,
        color: colors.textPrimary,
        paddingLeft: isMac ? 78 : 12,
        paddingRight: isMac ? 12 : 0,
      }}
    >
      <img src="/uartis.png" alt="" data-tauri-drag-region className="w-4 h-4 mr-2" draggable={false} />
      <span
        data-tauri-drag-region
        className="text-xs font-medium tracking-wide truncate"
        style={{ color: colors.textSecondary }}
      >
        Uartis
      </span>

      {!isMac && (
        <div className="ml-auto flex items-center h-full" onDoubleClick={(event) => event.stopPropagation()}>
          <CaptionButton label="Minimize" colors={colors} onClick={minimize}>
            <Minus size={14} />
          </CaptionButton>
          <CaptionButton label={maximized ? 'Restore' : 'Maximize'} colors={colors} onClick={toggleMaximize}>
            {maximized ? <Copy size={12} /> : <Square size={12} />}
          </CaptionButton>
          <CaptionButton label="Close" colors={colors} onClick={close} danger>
            <X size={14} />
          </CaptionButton>
        </div>
      )}
    </div>
  );
}

interface CaptionButtonProps {
  label: string;
  colors: TitleBarColors;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}

function CaptionButton({ label, colors, onClick, danger, children }: CaptionButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center h-full w-[46px] transition-colors"
      style={{
        color: hovered ? 'var(--app-on-accent)' : colors.textSecondary,
        backgroundColor: hovered ? (danger ? colors.danger : colors.bgHover) : 'transparent',
      }}
    >
      {children}
    </button>
  );
}
