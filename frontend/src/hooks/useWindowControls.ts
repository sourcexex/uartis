import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface WindowControlsState {
  maximized: boolean;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
}

/**
 * Window-control state shared by the custom title bar.
 *
 * On macOS the native traffic lights stay visible; this hook still tracks the
 * maximize state for the optional compatibility mode and keyboard state.
 */
export function useWindowControls(): WindowControlsState {
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

  return { maximized, minimize, toggleMaximize, close };
}
