import { useState } from 'react';
import type { ReactNode } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useTranslation } from '../i18n';

export interface WindowControlsColors {
  textSecondary: string;
  bgHover: string;
  danger: string;
}

interface WindowControlsProps {
  maximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  colors: WindowControlsColors;
}

/** Caption buttons for the self-drawn Windows/Linux title bar. */
export default function WindowControls({
  maximized,
  onMinimize,
  onToggleMaximize,
  onClose,
  colors,
}: WindowControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="ml-auto flex items-center h-full" onDoubleClick={(event) => event.stopPropagation()}>
      <CaptionButton label={t('titleBar.minimize')} colors={colors} onClick={onMinimize}>
        <Minus size={14} />
      </CaptionButton>
      <CaptionButton
        label={maximized ? t('titleBar.restore') : t('titleBar.maximize')}
        colors={colors}
        onClick={onToggleMaximize}
      >
        {maximized ? <Copy size={12} /> : <Square size={12} />}
      </CaptionButton>
      <CaptionButton label={t('titleBar.close')} colors={colors} onClick={onClose} danger>
        <X size={14} />
      </CaptionButton>
    </div>
  );
}

interface CaptionButtonProps {
  label: string;
  colors: WindowControlsColors;
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
