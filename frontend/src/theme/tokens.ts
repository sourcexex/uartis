/**
 * Design-token bridge for the React layer.
 *
 * The actual values live in `styles.css` so light/dark switching stays CSS-only
 * and business components never hard-code a colour. Keep this file in sync with
 * the `--app-*` variables there.
 */
export interface ThemeColors {
  // Background colors
  bgMain: string;
  bgSidebar: string;
  bgHeader: string;
  bgSurface: string;
  bgInput: string;
  bgHover: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textPlaceholder: string;

  // Border colors
  border: string;
  borderLight: string;
  borderDark: string;

  // Accent colors
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentMuted: string;
  onAccent: string;

  // Status colors
  success: string;
  danger: string;
  error: string;
  warning: string;

  // Component-specific
  buttonSecondaryBg: string;
  buttonSecondaryHover: string;
  logSentBg: string;
  logReceivedBg: string;
  matchText: string;
}

export const themeColors: ThemeColors = {
  bgMain: 'var(--app-bg-main)',
  bgSidebar: 'var(--app-bg-sidebar)',
  bgHeader: 'var(--app-bg-header)',
  bgSurface: 'var(--app-bg-surface)',
  bgInput: 'var(--app-bg-input)',
  bgHover: 'var(--app-bg-hover)',

  textPrimary: 'var(--app-text-primary)',
  textSecondary: 'var(--app-text-secondary)',
  textTertiary: 'var(--app-text-tertiary)',
  textPlaceholder: 'var(--app-text-placeholder)',

  border: 'var(--app-border)',
  borderLight: 'var(--app-border-light)',
  borderDark: 'var(--app-border-dark)',

  accent: 'var(--app-accent)',
  accentHover: 'var(--app-accent-hover)',
  accentSoft: 'var(--app-accent-soft)',
  accentMuted: 'var(--app-accent-muted)',
  onAccent: 'var(--app-on-accent)',

  success: 'var(--app-success)',
  danger: 'var(--app-danger)',
  error: 'var(--app-error)',
  warning: 'var(--app-warning)',

  buttonSecondaryBg: 'var(--app-button-secondary-bg)',
  buttonSecondaryHover: 'var(--app-button-secondary-hover)',
  logSentBg: 'var(--app-log-sent-bg)',
  logReceivedBg: 'var(--app-log-received-bg)',
  matchText: 'var(--app-match-text)',
};
