import { isMacPlatform } from '../utils/platform';
import { useWindowControls } from '../hooks/useWindowControls';
import WindowControls from './WindowControls';

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
 * Custom title bar.
 *
 * - Windows/Linux: platform configs remove native decorations, so this bar owns
 *   dragging (via `data-tauri-drag-region`) and the caption buttons.
 * - macOS: native decorations remain with `titleBarStyle: overlay` and
 *   `hiddenTitle`; the traffic lights stay native and this component only
 *   draws the content area, leaving a safe area on the left.
 */
export default function TitleBar({ colors }: TitleBarProps) {
  const isMac = isMacPlatform();
  const { maximized, minimize, toggleMaximize, close } = useWindowControls();

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
        <WindowControls
          maximized={maximized}
          onMinimize={minimize}
          onToggleMaximize={toggleMaximize}
          onClose={close}
          colors={{
            textSecondary: colors.textSecondary,
            bgHover: colors.bgHover,
            danger: colors.danger,
          }}
        />
      )}
    </div>
  );
}
