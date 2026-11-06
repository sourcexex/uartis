import React, { useState, useEffect } from 'react';
import {
  Folder,
  Moon,
  Sun,
  Monitor,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Download,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTheme } from '../contexts/ThemeContext';
import { supportsBackdropFilter } from '../utils/glass';
import { useLanguage, Language } from '../i18n';
import {
  TextEncoding,
  SpecialCharConfig,
  FrameSegmentationConfig,
  FrameSegmentationMode,
  FrameDelimiter,
  TimezoneOption,
} from '../types';
import {
  TIMEZONE_OPTIONS,
  loadTimezone,
  saveTimezone,
  getSystemTimezoneAsUtcOffset,
  getSystemTimezoneName,
  getSystemTimezoneOffset,
  parseUtcOffset,
} from '../utils/timezone';
import { LOG_LIMIT_CHANGED_EVENT, MAX_LOG_LIMIT, MIN_LOG_LIMIT, clampLogLimit } from '../constants';

// shadcn components
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_SPECIAL_CHAR_CONFIG: SpecialCharConfig = {
  enabled: false,
  convertLF: true,
  convertCR: true,
  convertTab: true,
  convertNull: true,
  convertEsc: true,
  convertSpaces: true,
};

const DEFAULT_FRAME_SEGMENTATION_CONFIG: FrameSegmentationConfig = {
  mode: 'Timeout',
  timeout_ms: 10,
  delimiter: 'AnyNewline',
};

// Update check types
interface UpdateCheckResult {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  download_url: string | null;
  download_size: number | null;
  release_url: string;
  asset_name: string | null;
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

// Format bytes to human-readable size
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange }) => {
  const {
    themeMode,
    setThemeMode,
    colors,
    accent,
    setAccent,
    glassStrength,
    setGlassStrength,
    reducedTransparency,
    setReducedTransparency,
    highContrast,
    setHighContrast,
    reducedMotion,
    setReducedMotion,
    consoleBackground,
    setConsoleBackground,
    consoleCustomColor,
    setConsoleCustomColor,
    consoleFontSize,
    setConsoleFontSize,
    directionColors,
    setDirectionColors,
  } = useTheme();
  const glassSupported = supportsBackdropFilter();
  const { language, setLanguage, t } = useLanguage();
  const [timezone, setTimezoneState] = useState<TimezoneOption>(loadTimezone);
  const [logPath, setLogPath] = useState('~/Documents/UartisLogs');
  const [maxLogLines, setMaxLogLines] = useState(1000);
  // Draft while the number is edited: never clamp mid-typing, commit on
  // blur/Enter, cancel on Escape (same pattern as SendPanel's interval).
  const [maxLogLinesDraft, setMaxLogLinesDraft] = useState<string | null>(null);
  const [textEncoding, setTextEncoding] = useState<TextEncoding>('utf-8');
  const [specialCharConfig, setSpecialCharConfig] = useState<SpecialCharConfig>(DEFAULT_SPECIAL_CHAR_CONFIG);
  const [specialCharExpanded, setSpecialCharExpanded] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);

  // Frame segmentation state
  const [frameSegmentationConfig, setFrameSegmentationConfig] = useState<FrameSegmentationConfig>(
    DEFAULT_FRAME_SEGMENTATION_CONFIG
  );
  const [customDelimiterHex, setCustomDelimiterHex] = useState('');
  const [customDelimiterError, setCustomDelimiterError] = useState('');

  // Update checker state
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [installerPath, setInstallerPath] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Helper to get delimiter type for UI display
  const getDelimiterType = (delimiter: FrameDelimiter): 'AnyNewline' | 'CR' | 'LF' | 'CRLF' | 'Custom' => {
    if (typeof delimiter === 'object' && 'Custom' in delimiter) {
      return 'Custom';
    }
    return delimiter as 'AnyNewline' | 'CR' | 'LF' | 'CRLF';
  };

  // Parse hex string to byte array
  const parseHexString = (hex: string): number[] | null => {
    const cleaned = hex.replace(/\s+/g, '').toUpperCase();
    if (cleaned.length === 0) return null;
    if (cleaned.length % 2 !== 0) return null;

    const bytes: number[] = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      const byte = parseInt(cleaned.substring(i, i + 2), 16);
      if (isNaN(byte)) return null;
      bytes.push(byte);
    }
    return bytes;
  };

  // Format byte array to hex string for display
  const bytesToHexString = (bytes: number[]): string => {
    return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  };

  // Load saved settings from localStorage on component mount
  useEffect(() => {
    const savedLogPath = localStorage.getItem('uartis_logPath');
    const savedMaxLogLines = localStorage.getItem('uartis_maxLogLines');
    const savedTextEncoding = localStorage.getItem('uartis_textEncoding');
    const savedSpecialCharConfig = localStorage.getItem('uartis_specialCharConfig');
    const savedFrameSegmentationConfig = localStorage.getItem('uartis_frameSegmentation');

    if (savedLogPath) {
      setLogPath(savedLogPath);
    }
    if (savedMaxLogLines) {
      const parsed = parseInt(savedMaxLogLines, 10);
      if (!Number.isNaN(parsed)) {
        setMaxLogLines(clampLogLimit(parsed));
      }
    }
    if (savedTextEncoding === 'utf-8' || savedTextEncoding === 'gbk') {
      setTextEncoding(savedTextEncoding);
    }
    if (savedSpecialCharConfig) {
      try {
        const parsed = JSON.parse(savedSpecialCharConfig);
        setSpecialCharConfig({ ...DEFAULT_SPECIAL_CHAR_CONFIG, ...parsed });
      } catch {
        // Use default if parsing fails
      }
    }
    if (savedFrameSegmentationConfig) {
      try {
        const parsed = JSON.parse(savedFrameSegmentationConfig) as FrameSegmentationConfig;
        setFrameSegmentationConfig(parsed);
        // Initialize custom delimiter hex input if using custom
        if (typeof parsed.delimiter === 'object' && 'Custom' in parsed.delimiter) {
          setCustomDelimiterHex(bytesToHexString(parsed.delimiter.Custom));
        }
      } catch {
        // Use default if parsing fails
      }
    }
  }, []);

  // Save log path to localStorage whenever it changes
  const handleLogPathChange = (path: string) => {
    setLogPath(path);
    localStorage.setItem('uartis_logPath', path);
  };

  // Save max log lines to localStorage and sync with backend (S1-04: the
  // value range matches the backend clamp 100–10000 in one place).
  const commitMaxLogLines = async () => {
    if (maxLogLinesDraft === null) return;
    const parsed = parseInt(maxLogLinesDraft, 10);
    setMaxLogLinesDraft(null);
    const next = Number.isNaN(parsed) ? maxLogLines : clampLogLimit(parsed);
    if (next === maxLogLines) return;
    setMaxLogLines(next);
    localStorage.setItem('uartis_maxLogLines', next.toString());
    try {
      await invoke('set_log_limit', { limit: next });
      // Let the log buffer follow the new cap without polling.
      window.dispatchEvent(new CustomEvent<number>(LOG_LIMIT_CHANGED_EVENT, { detail: next }));
    } catch (error) {
      console.error('Error setting log limit:', error);
    }
  };

  // Save text encoding to localStorage
  const handleTextEncodingChange = (encoding: TextEncoding) => {
    setTextEncoding(encoding);
    localStorage.setItem('uartis_textEncoding', encoding);
  };

  // Save special character config to localStorage
  const handleSpecialCharConfigChange = (updates: Partial<SpecialCharConfig>) => {
    const newConfig = { ...specialCharConfig, ...updates };
    setSpecialCharConfig(newConfig);
    localStorage.setItem('uartis_specialCharConfig', JSON.stringify(newConfig));
  };

  // Handle timezone change
  const handleTimezoneChange = async (tz: TimezoneOption) => {
    setTimezoneState(tz);
    saveTimezone(tz);

    // Sync timezone offset to backend for recording timestamps
    const offsetMinutes =
      tz === 'System' ? Math.round(getSystemTimezoneOffset() * 60) : Math.round(parseUtcOffset(tz) * 60);
    try {
      await invoke('set_timezone_offset', { offsetMinutes });
    } catch (error) {
      console.error('Error setting timezone offset:', error);
    }
  };

  // Save frame segmentation config to localStorage and sync with backend
  const handleFrameSegmentationChange = async (updates: Partial<FrameSegmentationConfig>) => {
    const newConfig = { ...frameSegmentationConfig, ...updates };
    setFrameSegmentationConfig(newConfig);
    localStorage.setItem('uartis_frameSegmentation', JSON.stringify(newConfig));
    try {
      await invoke('set_frame_segmentation', { config: newConfig });
    } catch (error) {
      console.error('Error setting frame segmentation config:', error);
    }
  };

  // Handle frame segmentation mode change
  const handleModeChange = (mode: FrameSegmentationMode) => {
    handleFrameSegmentationChange({ mode });
  };

  // Handle timeout change
  const handleTimeoutChange = (timeout: number) => {
    const clampedValue = Math.min(1000, Math.max(10, timeout));
    handleFrameSegmentationChange({ timeout_ms: clampedValue });
  };

  // Handle delimiter type change
  const handleDelimiterTypeChange = (type: 'AnyNewline' | 'CR' | 'LF' | 'CRLF' | 'Custom') => {
    if (type === 'Custom') {
      const bytes = parseHexString(customDelimiterHex);
      if (bytes && bytes.length > 0) {
        handleFrameSegmentationChange({ delimiter: { Custom: bytes } });
        setCustomDelimiterError('');
      } else {
        setCustomDelimiterHex('0A');
        handleFrameSegmentationChange({ delimiter: { Custom: [0x0a] } });
        setCustomDelimiterError('');
      }
    } else {
      handleFrameSegmentationChange({ delimiter: type });
      setCustomDelimiterError('');
    }
  };

  // Handle custom delimiter hex input change
  const handleCustomDelimiterChange = (hex: string) => {
    setCustomDelimiterHex(hex);
    const bytes = parseHexString(hex);
    if (bytes === null && hex.trim() !== '') {
      setCustomDelimiterError('Invalid hex format');
    } else if (bytes && bytes.length === 0) {
      setCustomDelimiterError('Delimiter cannot be empty');
    } else {
      setCustomDelimiterError('');
      if (bytes && bytes.length > 0) {
        handleFrameSegmentationChange({ delimiter: { Custom: bytes } });
      }
    }
  };

  // Handle folder selection with Tauri dialog
  const handleBrowsePath = async () => {
    try {
      setIsBrowsing(true);
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Select Log Save Location',
      });

      if (selected && typeof selected === 'string') {
        handleLogPathChange(selected);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    } finally {
      setIsBrowsing(false);
    }
  };

  // Check for updates
  const handleCheckUpdates = async () => {
    setUpdateState('checking');
    setUpdateError(null);

    try {
      const result = await invoke<UpdateCheckResult>('check_for_updates');
      setUpdateInfo(result);

      if (result.has_update) {
        if (!result.download_url || !result.asset_name) {
          setUpdateState('error');
          setUpdateError(t('settings.noExeFound'));
        } else {
          setUpdateState('available');
        }
      } else {
        setUpdateState('idle');
        setUpdateError(t('settings.upToDate'));
        setTimeout(() => setUpdateError(null), 3000);
      }
    } catch (error) {
      setUpdateState('error');
      const errorMsg = String(error);
      if (errorMsg.includes('Network') || errorMsg.includes('network')) {
        setUpdateError(t('settings.networkError'));
      } else if (errorMsg.includes('No releases')) {
        setUpdateError(t('settings.noReleases'));
      } else {
        setUpdateError(errorMsg);
      }
    }
  };

  // Download update
  const handleViewReleaseNotes = async () => {
    if (!updateInfo?.release_url) return;
    try {
      await invoke('open_url', { url: updateInfo.release_url });
    } catch (error) {
      console.error('Failed to open release notes:', error);
    }
  };

  const handleOpenGitHub = async () => {
    try {
      await invoke('open_url', { url: 'https://github.com/sourcexex/uartis' });
    } catch (error) {
      console.error('Failed to open GitHub:', error);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateInfo?.download_url || !updateInfo?.asset_name) return;

    setUpdateState('downloading');
    setDownloadProgress(0);
    setUpdateError(null);

    const unlisten = await listen<DownloadProgress>('update-download-progress', (event) => {
      setDownloadProgress(event.payload.percentage);
    });

    try {
      const path = await invoke<string>('download_update', {
        downloadUrl: updateInfo.download_url,
        assetName: updateInfo.asset_name,
      });
      setInstallerPath(path);
      setUpdateState('ready');
    } catch (error) {
      setUpdateState('error');
      setUpdateError(t('settings.downloadError') + ': ' + String(error));
    } finally {
      unlisten();
    }
  };

  // Launch installer and exit
  const handleInstall = async () => {
    if (!installerPath) return;

    try {
      await invoke('launch_installer_and_exit', { installerPath });
    } catch (error) {
      setUpdateState('error');
      setUpdateError(t('settings.installError') + ': ' + String(error) + '\n' + installerPath);
    }
  };

  // Reset update state
  const handleCancelUpdate = () => {
    setUpdateState('idle');
    setUpdateInfo(null);
    setDownloadProgress(0);
    setInstallerPath(null);
    setUpdateError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent disableFocusTrap glass className="max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader
          className="px-4 py-3 border-b"
          style={{ backgroundColor: colors.bgHeader, borderColor: colors.borderDark }}
        >
          <DialogTitle className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            {t('settings.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {/* Appearance Section */}
          <div className="space-y-3">
            <Label
              className="text-xs font-semibold uppercase tracking-wide ml-1"
              style={{ color: colors.textTertiary }}
            >
              {t('settings.appearance')}
            </Label>
            <Card className="p-1" style={{ backgroundColor: colors.bgMain, borderColor: colors.borderLight }}>
              <div className="flex">
                {(
                  [
                    { mode: 'light', icon: Sun, label: 'settings.light' },
                    { mode: 'dark', icon: Moon, label: 'settings.dark' },
                    { mode: 'system', icon: Monitor, label: 'settings.system' },
                  ] as const
                ).map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant={themeMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setThemeMode(mode)}
                  >
                    <Icon size={12} />
                    <span>{t(label)}</span>
                  </Button>
                ))}
              </div>
            </Card>
            <div
              className="flex items-center justify-between gap-4 px-2 py-2"
              style={{ borderTop: `1px solid ${colors.borderLight}` }}
            >
              <div className="flex flex-col">
                <span className="text-sm" style={{ color: colors.textPrimary }}>
                  {t('settings.reduceTransparency')}
                </span>
                <span className="text-xs" style={{ color: colors.textTertiary }}>
                  {t('settings.reduceTransparencyDesc')}
                </span>
              </div>
              <Switch
                checked={reducedTransparency}
                onCheckedChange={setReducedTransparency}
                disabled={!glassSupported}
              />
            </div>
            <div
              className="flex items-center justify-between gap-4 px-2 py-2"
              style={{ borderTop: `1px solid ${colors.borderLight}` }}
            >
              <div className="flex flex-col">
                <span className="text-sm" style={{ color: colors.textPrimary }}>
                  {t('settings.highContrast')}
                </span>
                <span className="text-xs" style={{ color: colors.textTertiary }}>
                  {t('settings.highContrastDesc')}
                </span>
              </div>
              <Switch checked={highContrast} onCheckedChange={setHighContrast} />
            </div>
            <div
              className="flex items-center justify-between gap-4 px-2 py-2"
              style={{ borderTop: `1px solid ${colors.borderLight}` }}
            >
              <div className="flex flex-col">
                <span className="text-sm" style={{ color: colors.textPrimary }}>
                  {t('settings.accentColor')}
                </span>
                <span className="text-xs" style={{ color: colors.textTertiary }}>
                  {t('settings.accentColorDesc')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(
                  [
                    { value: 'blue', color: '#0A84FF', label: 'settings.accentBlue' },
                    { value: 'green', color: '#30D158', label: 'settings.accentGreen' },
                    { value: 'purple', color: '#BF5AF2', label: 'settings.accentPurple' },
                    { value: 'orange', color: '#FF9F0A', label: 'settings.accentOrange' },
                  ] as const
                ).map(({ value, color, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={t(label)}
                    aria-pressed={accent === value}
                    title={t(label)}
                    onClick={() => setAccent(value)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      accent === value ? 'scale-110' : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: color,
                      borderColor: accent === value ? colors.textPrimary : colors.borderLight,
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              className="flex items-center justify-between gap-4 px-2 py-2"
              style={{ borderTop: `1px solid ${colors.borderLight}` }}
            >
              <div className="flex flex-col">
                <span className="text-sm" style={{ color: colors.textPrimary }}>
                  {t('settings.glassStrength')}
                </span>
                <span className="text-xs" style={{ color: colors.textTertiary }}>
                  {t('settings.glassStrengthDesc')}
                </span>
              </div>
              <Select
                value={glassStrength}
                onValueChange={(value) => setGlassStrength(value as 'soft' | 'standard' | 'strong')}
                disabled={!glassSupported || reducedTransparency}
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft">{t('settings.glassSoft')}</SelectItem>
                  <SelectItem value="standard">{t('settings.glassStandard')}</SelectItem>
                  <SelectItem value="strong">{t('settings.glassStrong')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              className="flex items-center justify-between gap-4 px-2 py-2"
              style={{ borderTop: `1px solid ${colors.borderLight}` }}
            >
              <div className="flex flex-col">
                <span className="text-sm" style={{ color: colors.textPrimary }}>
                  {t('settings.reduceMotion')}
                </span>
                <span className="text-xs" style={{ color: colors.textTertiary }}>
                  {t('settings.reduceMotionDesc')}
                </span>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>

          {/* Console Appearance Section */}
          <div className="space-y-3">
            <Label
              className="text-xs font-semibold uppercase tracking-wide ml-1"
              style={{ color: colors.textTertiary }}
            >
              {t('settings.console')}
            </Label>
            <Card style={{ backgroundColor: colors.bgMain, borderColor: colors.borderLight }}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.consoleBackground')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.consoleBackgroundDesc')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(
                      [
                        { value: 'theme', color: 'var(--app-bg-main)', label: 'settings.consoleTheme' },
                        { value: 'navy', color: '#0B1A2A', label: 'settings.consoleNavy' },
                        { value: 'forest', color: '#0C1F17', label: 'settings.consoleForest' },
                        { value: 'plum', color: '#1B1026', label: 'settings.consolePlum' },
                        { value: 'warm', color: '#F5EFE6', label: 'settings.consoleWarm' },
                        { value: 'black', color: '#000000', label: 'settings.consoleBlack' },
                        { value: 'custom', color: consoleCustomColor, label: 'settings.consoleCustom' },
                      ] as const
                    ).map(({ value, color, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={t(label)}
                        aria-pressed={consoleBackground === value}
                        title={t(label)}
                        onClick={() => setConsoleBackground(value)}
                        className={`h-6 w-6 rounded-[var(--app-radius-sm)] border transition-transform ${
                          consoleBackground === value ? 'scale-110' : 'hover:scale-105'
                        }`}
                        style={{
                          background:
                            value === 'custom'
                              ? 'conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)'
                              : color,
                          borderColor: consoleBackground === value ? colors.textPrimary : colors.borderLight,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {consoleBackground === 'custom' && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                      {t('settings.consoleCustomColor')}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={consoleCustomColor}
                        onChange={(event) => setConsoleCustomColor(event.target.value)}
                        aria-label={t('settings.consoleCustomColor')}
                        className="h-7 w-10 cursor-pointer rounded border border-[var(--app-border)] bg-transparent"
                      />
                      <span className="text-xs font-mono" style={{ color: colors.textTertiary }}>
                        {consoleCustomColor}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.consoleFontSize')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.consoleFontSizeDesc')}
                    </span>
                  </div>
                  <Select value={String(consoleFontSize)} onValueChange={(value) => setConsoleFontSize(Number(value))}>
                    <SelectTrigger className="h-7 w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[12, 13, 14, 15, 16].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.directionColors')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.directionColorsDesc')}
                    </span>
                  </div>
                  <Switch checked={directionColors} onCheckedChange={setDirectionColors} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Regional Section */}
          <div className="space-y-3">
            <Label
              className="text-xs font-semibold uppercase tracking-wide ml-1"
              style={{ color: colors.textTertiary }}
            >
              {t('settings.regional')}
            </Label>
            <Card style={{ backgroundColor: colors.bgMain, borderColor: colors.borderLight }}>
              <CardContent className="p-0">
                {/* Language Item */}
                <div
                  className="p-3 flex items-center justify-between border-b"
                  style={{ borderColor: colors.borderLight }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.language')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.languageDesc')}
                    </span>
                  </div>
                  <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh-CN">中文 (Chinese)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Timezone Item */}
                <div className="p-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.timezone')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.timezoneDesc')}
                      {timezone === 'System' && (
                        <span className="ml-1">
                          ({getSystemTimezoneName()}, {getSystemTimezoneAsUtcOffset()})
                        </span>
                      )}
                    </span>
                  </div>
                  <Select value={timezone} onValueChange={(v) => handleTimezoneChange(v as TimezoneOption)}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {language === 'zh-CN' ? tz.labelZh : tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* General Section */}
          <div className="space-y-3">
            <Label
              className="text-xs font-semibold uppercase tracking-wide ml-1"
              style={{ color: colors.textTertiary }}
            >
              {t('settings.general')}
            </Label>
            <Card style={{ backgroundColor: colors.bgMain, borderColor: colors.borderLight }}>
              <CardContent className="p-0">
                {/* Log Path Item */}
                <div
                  className="p-3 flex items-center justify-between border-b"
                  style={{ borderColor: colors.borderLight }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.defaultLogPath')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.defaultLogPathDesc')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="rounded px-2 py-1 text-xs max-w-[120px] truncate border cursor-default"
                            style={{
                              backgroundColor: colors.bgSurface,
                              borderColor: colors.border,
                              color: colors.textSecondary,
                            }}
                          >
                            {logPath}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{logPath}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleBrowsePath}
                            disabled={isBrowsing}
                            className="h-8 w-8"
                          >
                            <Folder size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('settings.browseFolderTitle')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Max Log Lines Item */}
                <div
                  className="p-3 flex items-center justify-between border-b"
                  style={{ borderColor: colors.borderLight }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.maxLogLines')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.maxLogLinesDesc')}
                    </span>
                  </div>
                  <Input
                    type="number"
                    min={MIN_LOG_LIMIT}
                    max={MAX_LOG_LIMIT}
                    step={100}
                    value={maxLogLinesDraft ?? String(maxLogLines)}
                    onFocus={() => setMaxLogLinesDraft(String(maxLogLines))}
                    onChange={(e) => setMaxLogLinesDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      void commitMaxLogLines();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitMaxLogLines();
                      if (e.key === 'Escape') setMaxLogLinesDraft(null);
                    }}
                    className="w-24 h-8 text-xs text-right"
                  />
                </div>

                {/* Text Encoding Item */}
                <div
                  className="p-3 flex items-center justify-between border-b"
                  style={{ borderColor: colors.borderLight }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm" style={{ color: colors.textPrimary }}>
                      {t('settings.textEncoding')}
                    </span>
                    <span className="text-xs" style={{ color: colors.textTertiary }}>
                      {t('settings.textEncodingDesc')}
                    </span>
                  </div>
                  <Select value={textEncoding} onValueChange={(v) => handleTextEncodingChange(v as TextEncoding)}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utf-8">UTF-8</SelectItem>
                      <SelectItem value="gbk">GBK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Special Character Conversion Item */}
                <div className="border-b" style={{ borderColor: colors.borderLight }}>
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm" style={{ color: colors.textPrimary }}>
                        {t('settings.convertSpecialChars')}
                      </span>
                      <span className="text-xs" style={{ color: colors.textTertiary }}>
                        {t('settings.convertSpecialCharsDesc')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={specialCharConfig.enabled}
                        onCheckedChange={(enabled) => handleSpecialCharConfigChange({ enabled })}
                      />
                      {specialCharConfig.enabled && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSpecialCharExpanded(!specialCharExpanded)}
                        >
                          {specialCharExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Sub-options for special character conversion */}
                  {specialCharConfig.enabled && specialCharExpanded && (
                    <div
                      className="px-3 pt-2 pb-3 grid grid-cols-2 gap-2"
                      style={{ backgroundColor: colors.bgSurface }}
                    >
                      {[
                        { key: 'convertLF', label: '\\n → ␊', descKey: 'settings.lineFeed' },
                        { key: 'convertCR', label: '\\r → ␍', descKey: 'settings.carriageReturn' },
                        { key: 'convertTab', label: '\\t → ␉', descKey: 'settings.tab' },
                        { key: 'convertNull', label: '\\0 → ␀', descKey: 'settings.null' },
                        { key: 'convertEsc', label: 'ESC → ␛', descKey: 'settings.escape' },
                        { key: 'convertSpaces', label: 'Spaces → ␣', descKey: 'settings.trailingMultiple' },
                      ].map(({ key, label, descKey }) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors hover:bg-accent"
                        >
                          <Checkbox
                            checked={specialCharConfig[key as keyof SpecialCharConfig] as boolean}
                            onCheckedChange={(checked) => handleSpecialCharConfigChange({ [key]: checked })}
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-mono" style={{ color: colors.textPrimary }}>
                              {label}
                            </span>
                            <span className="text-[10px]" style={{ color: colors.textTertiary }}>
                              {t(descKey)}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Frame Segmentation Item */}
                <div className="border-b" style={{ borderColor: colors.borderLight }}>
                  <div className="p-3 flex flex-col gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm" style={{ color: colors.textPrimary }}>
                        {t('settings.frameSegmentation')}
                      </span>
                      <span className="text-xs" style={{ color: colors.textTertiary }}>
                        {t('settings.frameSegmentationDesc')}
                      </span>
                    </div>

                    {/* Mode selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-14" style={{ color: colors.textSecondary }}>
                        {t('settings.mode')}:
                      </span>
                      <div
                        className="flex rounded-md overflow-hidden flex-1 border"
                        style={{ borderColor: colors.borderLight }}
                      >
                        {(['Timeout', 'Combined'] as FrameSegmentationMode[]).map((mode) => (
                          <Button
                            key={mode}
                            variant={frameSegmentationConfig.mode === mode ? 'default' : 'ghost'}
                            size="sm"
                            className="flex-1 rounded-none text-xs h-7"
                            onClick={() => handleModeChange(mode)}
                          >
                            {mode === 'Timeout' ? t('settings.frameModeTimeout') : t('settings.frameModeCombined')}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Timeout setting - always shown since both modes use timeout */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-14" style={{ color: colors.textSecondary }}>
                        {t('settings.frameTimeoutLabel')}:
                      </span>
                      <Input
                        type="number"
                        min="10"
                        max="1000"
                        step="10"
                        value={frameSegmentationConfig.timeout_ms}
                        onChange={(e) => handleTimeoutChange(parseInt(e.target.value, 10) || 10)}
                        className="w-20 h-7 text-xs text-right"
                      />
                      <span className="text-xs" style={{ color: colors.textTertiary }}>
                        {t('settings.frameTimeoutRange')}
                      </span>
                    </div>

                    {/* Delimiter setting - only shown in Combined mode */}
                    {frameSegmentationConfig.mode === 'Combined' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-14" style={{ color: colors.textSecondary }}>
                            {t('settings.delimiterLabel')}:
                          </span>
                          <Select
                            value={getDelimiterType(frameSegmentationConfig.delimiter)}
                            onValueChange={(v) =>
                              handleDelimiterTypeChange(v as 'AnyNewline' | 'CR' | 'LF' | 'CRLF' | 'Custom')
                            }
                          >
                            <SelectTrigger className="flex-1 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AnyNewline">{t('settings.anyNewline')} (\r, \n, \r\n)</SelectItem>
                              <SelectItem value="CR">CR (\r, 0x0D)</SelectItem>
                              <SelectItem value="LF">LF (\n, 0x0A)</SelectItem>
                              <SelectItem value="CRLF">CRLF (\r\n, 0x0D 0x0A)</SelectItem>
                              <SelectItem value="Custom">{t('settings.custom')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Custom delimiter input */}
                        {getDelimiterType(frameSegmentationConfig.delimiter) === 'Custom' && (
                          <div className="flex items-center gap-2 ml-16">
                            <Input
                              type="text"
                              value={customDelimiterHex}
                              onChange={(e) => handleCustomDelimiterChange(e.target.value)}
                              placeholder={t('settings.customDelimiterPlaceholder')}
                              className={`flex-1 h-7 text-xs font-mono ${customDelimiterError ? 'border-destructive' : ''}`}
                            />
                            {customDelimiterError && (
                              <span className="text-xs text-destructive">
                                {customDelimiterError === 'Invalid hex format'
                                  ? t('settings.invalidHex')
                                  : t('settings.delimiterEmpty')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* About Section */}
          <div className="space-y-3">
            <Label
              className="text-xs font-semibold uppercase tracking-wide ml-1"
              style={{ color: colors.textTertiary }}
            >
              {t('settings.about')}
            </Label>
            <Card style={{ backgroundColor: colors.bgMain, borderColor: colors.borderLight }}>
              <CardContent className="p-0">
                {/* App Info Row */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                      {t('app.title')}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: colors.textTertiary }}>
                      {t('settings.version')} {__APP_VERSION__} (Build {__APP_BUILD__})
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: colors.textTertiary }}>
                      {t('settings.maintainedBy')}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCheckUpdates}
                    disabled={updateState === 'checking' || updateState === 'downloading'}
                  >
                    {updateState === 'checking' ? (
                      <>
                        <Loader2 size={12} className="animate-spin mr-1.5" />
                        <span>{t('settings.checking')}</span>
                      </>
                    ) : (
                      <span>{t('settings.checkForUpdates')}</span>
                    )}
                  </Button>
                </div>

                {/* Update Available State */}
                {updateState === 'available' && updateInfo && (
                  <div
                    className="p-4 border-t space-y-3"
                    style={{ borderColor: colors.borderLight, backgroundColor: colors.bgSurface }}
                  >
                    <div className="flex items-start gap-2">
                      <Download size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                          {t('settings.updateAvailable')}
                        </div>
                        <div className="text-xs mt-1 space-y-0.5" style={{ color: colors.textSecondary }}>
                          <div>
                            {t('settings.currentVersion')}: {updateInfo.current_version}
                          </div>
                          <div>
                            {t('settings.latestVersion')}: {updateInfo.latest_version}
                          </div>
                          {updateInfo.download_size && (
                            <div>
                              {t('settings.downloadSize')}: {formatBytes(updateInfo.download_size)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button className="flex-1" size="sm" onClick={handleDownloadUpdate}>
                        {t('settings.downloadAndInstall')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleViewReleaseNotes}
                        className="flex items-center gap-1"
                      >
                        <ExternalLink size={12} />
                        <span>{t('settings.viewReleaseNotes')}</span>
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleCancelUpdate}>
                        {t('settings.cancel')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Downloading State */}
                {updateState === 'downloading' && (
                  <div
                    className="p-4 border-t space-y-3"
                    style={{ borderColor: colors.borderLight, backgroundColor: colors.bgSurface }}
                  >
                    <div className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin text-primary" />
                      <span className="text-sm" style={{ color: colors.textPrimary }}>
                        {t('settings.downloading')} {downloadProgress}%
                      </span>
                    </div>
                    <Progress value={downloadProgress} className="h-2" />
                  </div>
                )}

                {/* Ready to Install State */}
                {updateState === 'ready' && (
                  <div
                    className="p-4 border-t space-y-3"
                    style={{ borderColor: colors.borderLight, backgroundColor: colors.bgSurface }}
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: colors.success }} />
                      <div className="flex-1">
                        <div className="font-medium text-sm" style={{ color: colors.textPrimary }}>
                          {t('settings.readyToInstall')}
                        </div>
                        <div className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          {t('settings.readyToInstallDesc')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        className="flex-1"
                        size="sm"
                        style={{ backgroundColor: colors.success, color: colors.onAccent }}
                        onClick={handleInstall}
                      >
                        {t('settings.closeAndInstall')}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleCancelUpdate}>
                        {t('settings.cancel')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {updateState === 'error' && updateError && (
                  <div
                    className="p-4 border-t space-y-3"
                    style={{ borderColor: colors.borderLight, backgroundColor: colors.bgSurface }}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-destructive" />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-destructive">{t('settings.updateError')}</div>
                        <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: colors.textSecondary }}>
                          {updateError}
                        </div>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleCancelUpdate}>
                      {t('settings.cancel')}
                    </Button>
                  </div>
                )}

                {/* Up to date message (shown briefly) */}
                {updateState === 'idle' && updateError === t('settings.upToDate') && (
                  <div
                    className="p-3 border-t flex items-center gap-2"
                    style={{ borderColor: colors.borderLight, backgroundColor: colors.bgSurface }}
                  >
                    <CheckCircle size={14} style={{ color: colors.success }} />
                    <span className="text-xs" style={{ color: colors.textSecondary }}>
                      {t('settings.upToDate')}
                    </span>
                  </div>
                )}

                {/* Project links */}
                <div
                  className="px-4 py-2.5 border-t flex items-center justify-between"
                  style={{ borderColor: colors.borderLight }}
                >
                  <span className="text-xs" style={{ color: colors.textTertiary }}>
                    {t('settings.copyright')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenGitHub}
                    className="h-7 px-2 text-xs flex items-center gap-1"
                    style={{ color: colors.textSecondary }}
                  >
                    <ExternalLink size={12} />
                    <span>{t('settings.github')}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(SettingsModal);
