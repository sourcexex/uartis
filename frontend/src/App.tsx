import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save as saveFileDialog } from '@tauri-apps/plugin-dialog';
import { Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import PortSelector from './components/PortSelector';
import ConfigPanel from './components/ConfigPanel';
import LogViewer from './components/LogViewer';
import SendPanel, { SEND_PANEL_MIN_HEIGHTS } from './components/SendPanel';
import StatusBar from './components/StatusBar';
import TitleBar from './components/TitleBar';
import SettingsModal from './components/SettingsModal';
import {
  SerialPortInfo,
  SerialConfig,
  LogEntry,
  ConnectionStatus,
  DataFormat,
  ChecksumConfig,
  QuickCommandList,
  QuickCommand,
  LineEnding,
  FrameSegmentationConfig,
  ExportFormat,
} from './types';
import { useTheme } from './contexts/ThemeContext';
import { useTranslation } from './i18n';
import { useSerialLogs } from './hooks/useSerialLogs';
import { appendChecksum } from './utils/checksum';
import { getTextEncoding, textToBytes } from './utils/encoding';
import { loadTimezone, formatDateForFilename, getSystemTimezoneOffset, parseUtcOffset } from './utils/timezone';
import { clampLogLimit, LOG_LIMIT_CHANGED_EVENT } from './constants';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Button } from './components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';

const QUICK_COMMANDS_STORAGE_KEY = 'uartis-quick-commands';
const STORAGE_KEY_SIDEBAR_WIDTH = 'uartis_sidebarWidth';
const STORAGE_KEY_SIDEBAR_COLLAPSED = 'uartis_sidebarCollapsed';
const STORAGE_KEY_LOG_VIEWER_HEIGHT = 'uartis_logViewerHeight';
const STORAGE_KEY_FRAME_SEGMENTATION = 'uartis_frameSegmentation';
const STORAGE_KEY_MAX_LOG_LINES = 'uartis_maxLogLines';
const INITIAL_COMMANDS = 20;

/** Send failures can fire on every scheduled tick (10 ms floor); surface one
 *  toast per window instead of flooding the screen (S1-03). */
const SEND_ERROR_TOAST_INTERVAL_MS = 3000;

// Layout constants
const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 200;
const COLLAPSED_SIDEBAR_WIDTH = 48;
const AUTO_COLLAPSE_THRESHOLD = 900;
const MIN_LOG_VIEWER_HEIGHT = 150;
const DEFAULT_SEND_PANEL_MIN_HEIGHT = SEND_PANEL_MIN_HEIGHTS.normalText;
const DEFAULT_LOG_VIEWER_RATIO = 0.65;

const createEmptyCommand = (): QuickCommand => ({
  id: crypto.randomUUID(),
  name: '',
  selected: false,
  isHex: false,
  content: '',
  lineEnding: 'None',
});

const createDefaultList = (): QuickCommandList => ({
  id: crypto.randomUUID(),
  name: 'Default',
  commands: Array.from({ length: INITIAL_COMMANDS }, createEmptyCommand),
});

const loadQuickCommandsFromStorage = (): { lists: QuickCommandList[]; currentListId: string } => {
  try {
    const stored = localStorage.getItem(QUICK_COMMANDS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.lists && parsed.lists.length > 0) {
        // Ensure backward compatibility: add missing 'name' field to commands
        const migratedLists = parsed.lists.map((list: QuickCommandList) => ({
          ...list,
          commands: list.commands.map((cmd: QuickCommand) => ({
            ...cmd,
            name: cmd.name ?? '', // Default to empty string if name doesn't exist
          })),
        }));
        return { lists: migratedLists, currentListId: parsed.currentListId };
      }
    }
  } catch (e) {
    console.error('Failed to load quick commands from storage:', e);
  }
  const defaultList = createDefaultList();
  return { lists: [defaultList], currentListId: defaultList.id };
};

const saveQuickCommandsToStorage = (lists: QuickCommandList[], currentListId: string) => {
  try {
    localStorage.setItem(QUICK_COMMANDS_STORAGE_KEY, JSON.stringify({ lists, currentListId }));
  } catch (e) {
    console.error('Failed to save quick commands to storage:', e);
  }
};

// Layout persistence helpers
const getSavedSidebarWidth = (): number => {
  const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR_WIDTH);
  if (saved) {
    const width = parseInt(saved, 10);
    if (!isNaN(width) && width >= MIN_SIDEBAR_WIDTH) {
      return width;
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
};

const getSavedSidebarCollapsed = (): boolean => {
  return localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED) === 'true';
};

const getSavedLogViewerHeight = (): number | null => {
  const saved = localStorage.getItem(STORAGE_KEY_LOG_VIEWER_HEIGHT);
  if (saved) {
    const height = parseInt(saved, 10);
    if (!isNaN(height) && height >= MIN_LOG_VIEWER_HEIGHT) {
      return height;
    }
  }
  return null;
};

/**
 * The 1 s status poll runs forever; returning the previous object when nothing
 * changed keeps `connectionStatus` referentially stable so memoized panels do
 * not re-render every second.
 */
const isSameConnectionStatus = (a: ConnectionStatus, b: ConnectionStatus): boolean => {
  if (a === b) return true;
  if (
    a.is_connected !== b.is_connected ||
    a.port_name !== b.port_name ||
    a.bytes_sent !== b.bytes_sent ||
    a.bytes_received !== b.bytes_received ||
    a.connection_time !== b.connection_time ||
    a.connection_error !== b.connection_error
  ) {
    return false;
  }
  const configA = a.config;
  const configB = b.config;
  if (configA === configB) return true;
  if (!configA || !configB) return false;
  return (
    configA.baud_rate === configB.baud_rate &&
    configA.data_bits === configB.data_bits &&
    configA.parity === configB.parity &&
    configA.stop_bits === configB.stop_bits &&
    configA.flow_control === configB.flow_control &&
    configA.timeout === configB.timeout
  );
};

function App() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<SerialConfig>({
    baud_rate: 115200,
    data_bits: 'Eight',
    parity: 'None',
    stop_bits: 'One',
    flow_control: 'None',
    timeout: 1000,
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    is_connected: false,
    port_name: null,
    config: null,
    bytes_sent: 0,
    bytes_received: 0,
    connection_time: null,
  });
  const [polledLogs, setPolledLogs] = useState<LogEntry[]>([]);
  // RFC #3 Step 4: event push is the default log path; set
  // localStorage 'uartisEventPush' = '0' to roll back to 100ms polling.
  const [eventPush] = useState(() => localStorage.getItem('uartisEventPush') !== '0');
  const { logs: pushedLogs, clearLogs: clearPushedLogs, resync: resyncPushedLogs } = useSerialLogs(eventPush);
  const logs = eventPush ? pushedLogs : polledLogs;
  const [sendText, setSendText] = useState('');
  const [sendFormat, setSendFormat] = useState<DataFormat>('Text');
  const [checksumConfig, setChecksumConfig] = useState<ChecksumConfig>({
    type: 'None',
    startIndex: 0, // 0 = first byte
    endIndex: -1, // -1 = last byte (include all)
  });
  const [isLoading, setIsLoading] = useState(false);
  const [userHasSelectedPort, setUserHasSelectedPort] = useState(false);

  // Layout state
  const [sidebarWidth, setSidebarWidth] = useState<number>(getSavedSidebarWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(getSavedSidebarCollapsed);
  const [logViewerHeight, setLogViewerHeight] = useState<number | null>(getSavedLogViewerHeight);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const [wasAutoCollapsed, setWasAutoCollapsed] = useState(false);
  const [sendPanelMinHeight, setSendPanelMinHeight] = useState<number>(DEFAULT_SEND_PANEL_MIN_HEIGHT);

  // Refs for resize handling
  const mainContentRef = useRef<HTMLDivElement>(null);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const verticalResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Quick Command Lists state
  const [quickCommandLists, setQuickCommandLists] = useState<QuickCommandList[]>(() => {
    const { lists } = loadQuickCommandsFromStorage();
    return lists;
  });
  const [currentQuickCommandListId, setCurrentQuickCommandListId] = useState<string>(() => {
    const { currentListId } = loadQuickCommandsFromStorage();
    return currentListId;
  });

  // 使用useRef来保存最新的状态值，避免闭包陷阱
  const selectedPortRef = useRef(selectedPort);
  const userHasSelectedPortRef = useRef(userHasSelectedPort);
  const connectionStatusRef = useRef(connectionStatus);
  const tRef = useRef(t);
  const lastSendErrorToastRef = useRef(0);

  // 更新ref值
  useEffect(() => {
    selectedPortRef.current = selectedPort;
  }, [selectedPort]);

  useEffect(() => {
    userHasSelectedPortRef.current = userHasSelectedPort;
  }, [userHasSelectedPort]);

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Persist quick commands to localStorage
  useEffect(() => {
    saveQuickCommandsToStorage(quickCommandLists, currentQuickCommandListId);
  }, [quickCommandLists, currentQuickCommandListId]);

  // Persist layout settings to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_WIDTH, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (logViewerHeight !== null) {
      localStorage.setItem(STORAGE_KEY_LOG_VIEWER_HEIGHT, logViewerHeight.toString());
    }
  }, [logViewerHeight]);

  // Adjust log viewer height when send panel min height changes
  useEffect(() => {
    if (!mainContentRef.current || logViewerHeight === null) return;

    const mainContentRect = mainContentRef.current.getBoundingClientRect();
    const maxLogViewerHeight = mainContentRect.height - sendPanelMinHeight;

    if (logViewerHeight > maxLogViewerHeight) {
      setLogViewerHeight(Math.max(MIN_LOG_VIEWER_HEIGHT, maxLogViewerHeight));
    }
  }, [sendPanelMinHeight, logViewerHeight]);

  // A persisted log height can be too tall after the window shrinks; clamp it
  // on every resize so the send panel never gets squeezed off-screen.
  useEffect(() => {
    const clampLogViewerHeight = () => {
      const container = mainContentRef.current;
      if (!container) return;
      setLogViewerHeight((current) => {
        if (current === null) return current;
        const max = container.getBoundingClientRect().height - sendPanelMinHeight;
        return Math.max(MIN_LOG_VIEWER_HEIGHT, Math.min(current, max));
      });
    };

    clampLogViewerHeight();
    window.addEventListener('resize', clampLogViewerHeight);
    return () => window.removeEventListener('resize', clampLogViewerHeight);
  }, [sendPanelMinHeight]);

  // Window resize handler for auto-collapse
  useEffect(() => {
    const handleWindowResize = () => {
      const windowWidth = window.innerWidth;
      if (windowWidth < AUTO_COLLAPSE_THRESHOLD && !sidebarCollapsed) {
        setSidebarCollapsed(true);
        setWasAutoCollapsed(true);
      } else if (windowWidth >= AUTO_COLLAPSE_THRESHOLD && wasAutoCollapsed && sidebarCollapsed) {
        setSidebarCollapsed(false);
        setWasAutoCollapsed(false);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    // Check on mount
    handleWindowResize();

    return () => window.removeEventListener('resize', handleWindowResize);
  }, [sidebarCollapsed, wasAutoCollapsed]);

  // Sidebar resize handlers
  const handleSidebarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSidebar(true);
      sidebarResizeRef.current = {
        startX: e.clientX,
        startWidth: sidebarWidth,
      };
    },
    [sidebarWidth]
  );

  const handleSidebarResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingSidebar || !sidebarResizeRef.current) return;

      const deltaX = e.clientX - sidebarResizeRef.current.startX;
      const newWidth = sidebarResizeRef.current.startWidth + deltaX;
      const maxWidth = window.innerWidth * 0.5;
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, newWidth));
      setSidebarWidth(clampedWidth);
    },
    [isResizingSidebar]
  );

  const handleSidebarResizeEnd = useCallback(() => {
    setIsResizingSidebar(false);
    sidebarResizeRef.current = null;
  }, []);

  // Vertical resize handlers (between log viewer and send panel)
  const handleVerticalResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!mainContentRef.current) return;

      setIsResizingVertical(true);
      const mainContentRect = mainContentRef.current.getBoundingClientRect();
      const currentLogHeight = logViewerHeight ?? mainContentRect.height * DEFAULT_LOG_VIEWER_RATIO;

      verticalResizeRef.current = {
        startY: e.clientY,
        startHeight: currentLogHeight,
      };
    },
    [logViewerHeight]
  );

  const handleVerticalResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingVertical || !verticalResizeRef.current || !mainContentRef.current) return;

      const mainContentRect = mainContentRef.current.getBoundingClientRect();
      const deltaY = e.clientY - verticalResizeRef.current.startY;
      const newHeight = verticalResizeRef.current.startHeight + deltaY;
      const maxHeight = mainContentRect.height - sendPanelMinHeight;
      const clampedHeight = Math.max(MIN_LOG_VIEWER_HEIGHT, Math.min(maxHeight, newHeight));
      setLogViewerHeight(clampedHeight);
    },
    [isResizingVertical, sendPanelMinHeight]
  );

  const handleVerticalResizeEnd = useCallback(() => {
    setIsResizingVertical(false);
    verticalResizeRef.current = null;
  }, []);

  // Global mouse event handlers for resize operations
  useEffect(() => {
    if (isResizingSidebar) {
      document.addEventListener('mousemove', handleSidebarResizeMove);
      document.addEventListener('mouseup', handleSidebarResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleSidebarResizeMove);
      document.removeEventListener('mouseup', handleSidebarResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, handleSidebarResizeMove, handleSidebarResizeEnd]);

  useEffect(() => {
    if (isResizingVertical) {
      document.addEventListener('mousemove', handleVerticalResizeMove);
      document.addEventListener('mouseup', handleVerticalResizeEnd);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleVerticalResizeMove);
      document.removeEventListener('mouseup', handleVerticalResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingVertical, handleVerticalResizeMove, handleVerticalResizeEnd]);

  // Toggle sidebar collapse
  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
    setWasAutoCollapsed(false); // User manually toggled, so reset auto-collapse tracking
  }, []);

  // Calculate effective sidebar width
  const effectiveSidebarWidth = sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth;

  // 使用useCallback确保函数能访问到最新的状态
  const loadPorts = useCallback(async () => {
    try {
      const availablePorts = await invoke<SerialPortInfo[]>('list_serial_ports');
      // Preserve referential identity when the list did not change so the
      // 3 s poll does not re-render PortSelector for nothing.
      setPorts((prev) => {
        const unchanged =
          prev.length === availablePorts.length &&
          prev.every(
            (port, index) =>
              port.port_name === availablePorts[index].port_name &&
              port.description === availablePorts[index].description
          );
        return unchanged ? prev : availablePorts;
      });

      // 使用ref获取最新的状态值
      const currentUserHasSelectedPort = userHasSelectedPortRef.current;
      const currentSelectedPort = selectedPortRef.current;

      // Case 1: Initial load - auto-select first port if user hasn't made any choice
      if (!currentUserHasSelectedPort && !currentSelectedPort && availablePorts.length > 0) {
        setSelectedPort(availablePorts[0].port_name);
        return;
      }

      // Case 2: User has made a selection - preserve it if possible
      if (currentUserHasSelectedPort && currentSelectedPort) {
        const isSelectedPortAvailable = availablePorts.some((p) => p.port_name === currentSelectedPort);
        if (!isSelectedPortAvailable) {
          // Only clear if the selected port is no longer available
          setSelectedPort('');
          // Keep userHasSelectedPort as true - respect that they made a choice before
        }
        // If port is still available, do nothing - preserve user's selection
        return;
      }

      // Case 3: Fallback - if somehow we have a selected port but no user selection flag
      if (currentSelectedPort && !availablePorts.some((p) => p.port_name === currentSelectedPort)) {
        setSelectedPort('');
      }
    } catch (error) {
      console.error('Failed to load ports:', error);
    }
  }, []); // 空依赖数组，因为我们使用ref来访问最新状态

  // Load ports on component mount
  useEffect(() => {
    loadPorts();

    // Initialize log limit from localStorage (single source: 100–10000, S1-04)
    const initLogLimit = async () => {
      const savedMaxLogLines = localStorage.getItem(STORAGE_KEY_MAX_LOG_LINES);
      if (savedMaxLogLines) {
        const parsed = parseInt(savedMaxLogLines, 10);
        if (!Number.isNaN(parsed)) {
          const limit = clampLogLimit(parsed);
          try {
            await invoke('set_log_limit', { limit });
            // The log hook may have read `get_log_limit` before this call
            // landed; publish the effective limit so the buffer follows it.
            window.dispatchEvent(new CustomEvent<number>(LOG_LIMIT_CHANGED_EVENT, { detail: limit }));
          } catch (error) {
            console.error('Failed to initialize log limit:', error);
          }
        }
      }
    };
    initLogLimit();

    // Initialize frame segmentation config from localStorage
    const initFrameSegmentation = async () => {
      const savedConfig = localStorage.getItem(STORAGE_KEY_FRAME_SEGMENTATION);
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig) as FrameSegmentationConfig;
          await invoke('set_frame_segmentation', { config });
        } catch (error) {
          console.error('Failed to initialize frame segmentation:', error);
        }
      }
    };
    initFrameSegmentation();

    // Initialize timezone offset for backend recording timestamps
    const initTimezoneOffset = async () => {
      try {
        const tz = loadTimezone();
        const offsetMinutes =
          tz === 'System'
            ? Math.round(getSystemTimezoneOffset() * 60) // Convert hours to minutes
            : Math.round(parseUtcOffset(tz) * 60);
        await invoke('set_timezone_offset', { offsetMinutes });
      } catch (error) {
        console.error('Failed to initialize timezone offset:', error);
      }
    };
    initTimezoneOffset();

    // Set up intervals for updating status, logs, and ports
    const statusInterval = setInterval(updateStatus, 1000);
    // Event push (RFC #3 Step 4) replaces the 100ms full-clone log polling;
    // the polling interval only runs in rollback mode.
    const logsInterval = eventPush ? null : setInterval(updateLogs, 100);
    const portsInterval = setInterval(loadPorts, 3000); // Check for new ports every 3 seconds

    return () => {
      clearInterval(statusInterval);
      if (logsInterval !== null) clearInterval(logsInterval);
      clearInterval(portsInterval);
    };
    // updateStatus/updateLogs are stable callbacks declared below; referencing
    // them here would hit the temporal dead zone, and including them would
    // restart every interval on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPorts, eventPush]); // 依赖loadPorts函数

  const handlePortSelect = useCallback((port: string) => {
    setSelectedPort(port);
    setUserHasSelectedPort(true); // Mark that user has made a manual choice
  }, []);

  const updateStatus = useCallback(async () => {
    try {
      const status = await invoke<ConnectionStatus>('get_connection_status');
      // Surface an unexpected loss (fatal read error, e.g. cable unplugged)
      // exactly once per transition; manual disconnects carry no error.
      // Side effects stay outside the state updater (and use tRef so the
      // language switch is respected by the long-lived interval).
      const previous = connectionStatusRef.current;
      if (previous.is_connected && !status.is_connected && status.connection_error) {
        toast.error(tRef.current('app.connectionLost').replace('{error}', status.connection_error));
      }
      connectionStatusRef.current = status;
      setConnectionStatus((prev) => (isSameConnectionStatus(prev, status) ? prev : status));
    } catch (error) {
      console.error('Failed to get status:', error);
    }
  }, []);

  const updateLogs = async () => {
    try {
      const newLogs = await invoke<LogEntry[]>('get_logs');
      setPolledLogs(newLogs);
    } catch (error) {
      console.error('Failed to get logs:', error);
    }
  };

  const handleConnect = useCallback(async () => {
    if (!selectedPort) return;

    setIsLoading(true);
    try {
      await invoke('connect_to_port', {
        portName: selectedPort,
        config: config,
      });
      await updateStatus();
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error(tRef.current('app.connectFailed').replace('{error}', String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [selectedPort, config, updateStatus]);

  const handleDisconnect = useCallback(async () => {
    setIsLoading(true);
    try {
      await invoke('disconnect_port');
      await updateStatus();
      // Don't clear logs - preserve message history for user review
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsLoading(false);
    }
  }, [updateStatus]);

  /** Throttled send-failure toast: scheduled sends can fail every 10 ms. */
  const notifySendError = useCallback((error: unknown) => {
    const now = Date.now();
    if (now - lastSendErrorToastRef.current < SEND_ERROR_TOAST_INTERVAL_MS) return;
    lastSendErrorToastRef.current = now;
    toast.error(tRef.current('sendPanel.sendFailed').replace('{error}', String(error)));
  }, []);

  const handleSendData = useCallback(
    async (lineEnding: LineEnding = 'None'): Promise<boolean> => {
      if (!sendText.trim() || !connectionStatus.is_connected) return false;

      try {
        const textEncoding = getTextEncoding();
        // Apply the outbound character map (line ending) before encoding and
        // before the checksum, so the checksum covers exactly what is sent.
        const payload = appendLineEnding(sendText, lineEnding, sendFormat === 'Hex');

        // If checksum is enabled, we need to calculate and append it
        if (checksumConfig.type !== 'None') {
          // Convert input to bytes first. Text must use the *configured*
          // encoding: the backend sends GBK bytes, so a UTF-8 checksum would
          // not match what the device receives (S1-08).
          let bytes: Uint8Array;
          if (sendFormat === 'Text') {
            bytes = await textToBytes(payload, textEncoding);
          } else {
            // Parse hex string
            const cleanHex = payload.replace(/\s/g, '');
            if (cleanHex.length % 2 !== 0) {
              toast.warning(tRef.current('sendPanel.sendHexOddLength'));
              return false;
            }
            const byteArray: number[] = [];
            for (let i = 0; i < cleanHex.length; i += 2) {
              const byte = parseInt(cleanHex.substr(i, 2), 16);
              if (isNaN(byte)) {
                toast.warning(tRef.current('sendPanel.sendHexInvalid'));
                return false;
              }
              byteArray.push(byte);
            }
            bytes = new Uint8Array(byteArray);
          }

          // Append checksum
          const bytesWithChecksum = appendChecksum(bytes, checksumConfig);

          // Convert back to hex string for sending (always send as hex when checksum is added)
          const dataToSend = Array.from(bytesWithChecksum)
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

          // Send as hex format when checksum is appended (encoding not needed for hex)
          await invoke('send_data', {
            data: dataToSend,
            format: 'Hex',
          });
        } else {
          // No checksum, send as-is with encoding
          await invoke('send_data', {
            data: payload,
            format: sendFormat,
            encoding: sendFormat === 'Text' ? textEncoding : undefined,
          });
        }

        // Don't clear the input - keep the content for re-sending
        return true;
      } catch (error) {
        console.error('Failed to send data:', error);
        notifySendError(error);
        return false;
      }
    },
    [sendText, sendFormat, checksumConfig, connectionStatus.is_connected, notifySendError]
  );

  const handleClearLogs = useCallback(async () => {
    if (eventPush) {
      await clearPushedLogs();
      return;
    }
    try {
      await invoke('clear_logs');
      setPolledLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }, [eventPush, clearPushedLogs]);

  const handleExportLogs = useCallback(
    async (format: ExportFormat) => {
      try {
        // Get the log directory from backend (which has the correct platform-specific path)
        const logPath = await invoke<string>('get_log_directory');

        // Format timestamp for filename using configured timezone
        const timezone = loadTimezone();
        const timestamp = formatDateForFilename(new Date(), timezone);

        // Use "noport" if no port is connected, otherwise use the selected port name
        // Sanitize port name for filename (replace special characters)
        const portName = (selectedPort || 'noport').replace(/[/\\:*?"<>|]/g, '_');
        const extension = format === 'Txt' ? 'txt' : format === 'Csv' ? 'csv' : 'json';

        // Use "export_" prefix to distinguish from auto-saved files
        const defaultPath = `${logPath}/export_${portName}_${timestamp}.${extension}`;

        // Let the user pick (and see) the target file — the old behaviour wrote
        // silently into the log directory and only showed the path in a toast.
        const filePath = await saveFileDialog({
          defaultPath,
          filters: [{ name: format.toUpperCase(), extensions: [extension] }],
        });
        if (!filePath) return; // user cancelled

        // Pass timezone offset to backend for formatting timestamps in the exported file
        const timezoneOffsetMinutes =
          timezone === 'System' ? -new Date().getTimezoneOffset() : Math.round(parseUtcOffset(timezone) * 60);
        await invoke('export_logs', {
          filePath,
          format,
          timezoneOffsetMinutes,
        });

        toast.success(tRef.current('logViewer.exportSuccess').replace('{path}', filePath));
      } catch (error) {
        console.error('Failed to export logs:', error);
        toast.error(tRef.current('logViewer.exportFailed').replace('{error}', String(error)));
      }
    },
    [selectedPort]
  );

  // Helper function to append line ending to data
  const appendLineEnding = (data: string, lineEnding: LineEnding, isHex: boolean): string => {
    if (lineEnding === 'None') return data;

    const lineEndingMap: Record<string, string> = {
      '\\r': isHex ? '0D' : '\r',
      '\\n': isHex ? '0A' : '\n',
      '\\r\\n': isHex ? '0D 0A' : '\r\n',
    };

    const ending = lineEndingMap[lineEnding];
    if (!ending) return data;

    if (isHex) {
      return data.trim() ? `${data} ${ending}` : ending;
    }
    return data + ending;
  };

  // Handler for sending a single quick command
  const handleSendQuickCommand = useCallback(
    async (content: string, isHex: boolean, lineEnding: LineEnding) => {
      if (!content.trim() || !connectionStatus.is_connected) return;

      try {
        const dataToSend = appendLineEnding(content, lineEnding, isHex);
        const format: DataFormat = isHex ? 'Hex' : 'Text';
        const textEncoding = getTextEncoding();

        await invoke('send_data', {
          data: dataToSend,
          format: format,
          encoding: !isHex ? textEncoding : undefined,
        });
      } catch (error) {
        console.error('Failed to send quick command:', error);
        notifySendError(error);
      }
    },
    [connectionStatus.is_connected, notifySendError]
  );

  // Handler for sending all selected quick commands
  const handleSendSelectedQuickCommands = useCallback(
    async (commands: QuickCommand[]) => {
      if (commands.length === 0 || !connectionStatus.is_connected) return;

      try {
        const textEncoding = getTextEncoding();

        for (const command of commands) {
          const dataToSend = appendLineEnding(command.content, command.lineEnding, command.isHex);
          const format: DataFormat = command.isHex ? 'Hex' : 'Text';

          await invoke('send_data', {
            data: dataToSend,
            format: format,
            encoding: !command.isHex ? textEncoding : undefined,
          });

          // Small delay between commands to ensure proper sequencing
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } catch (error) {
        console.error('Failed to send selected commands:', error);
        notifySendError(error);
      }
    },
    [connectionStatus.is_connected, notifySendError]
  );

  return (
    <div
      className="h-screen flex flex-col app-shell"
      style={{ backgroundColor: colors.bgMain, color: colors.textPrimary }}
    >
      <TitleBar colors={colors} />
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div
          className="flex flex-col relative z-20 transition-[width] duration-200 ease-out glass-surface"
          style={{
            width: effectiveSidebarWidth,
            minWidth: effectiveSidebarWidth,
            borderRight: `1px solid ${colors.borderDark}`,
          }}
        >
          {/* Collapsed Sidebar View */}
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center pt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('sidebar.expandSidebar')}
                      onClick={toggleSidebarCollapse}
                      className="h-9 w-9"
                      style={{ color: colors.textSecondary }}
                    >
                      <PanelLeft size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('sidebar.expandSidebar')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                className="p-4 pt-6 flex items-start justify-between"
                style={{ borderBottom: `1px solid ${colors.borderLight}` }}
              >
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-bold tracking-wide truncate" style={{ color: colors.textPrimary }}>
                    {t('app.title')}
                  </h1>
                  <p className="text-xs mt-0.5" style={{ color: colors.textTertiary }}>
                    {t('app.subtitle')}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('sidebar.collapseSidebar')}
                          onClick={toggleSidebarCollapse}
                          className="h-7 w-7"
                          style={{ color: colors.textSecondary }}
                        >
                          <PanelLeftClose size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('sidebar.collapseSidebar')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('settings.title')}
                          onClick={() => setShowSettings(true)}
                          className="h-7 w-7"
                          style={{ color: colors.textSecondary }}
                        >
                          <Settings size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('sidebar.settings')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Port Selector */}
              <div className="p-4 overflow-hidden" style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                <PortSelector
                  ports={ports}
                  selectedPort={selectedPort}
                  onPortSelect={handlePortSelect}
                  onRefresh={loadPorts}
                  connectionStatus={connectionStatus}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  isLoading={isLoading}
                />
              </div>

              {/* Configuration */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <ConfigPanel config={config} onChange={setConfig} disabled={connectionStatus.is_connected} />
              </div>
            </>
          )}
        </div>

        {/* Sidebar Resize Handle */}
        {!sidebarCollapsed && (
          <div
            className="w-1 hover:w-1 cursor-col-resize relative z-30 group"
            onMouseDown={handleSidebarResizeStart}
            style={{
              backgroundColor: isResizingSidebar ? colors.accent : 'transparent',
            }}
          >
            <div
              className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-opacity-50 transition-colors"
              style={{
                backgroundColor: isResizingSidebar ? colors.accent : 'transparent',
              }}
            />
            <div
              className="absolute inset-y-0 left-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: colors.accent }}
            />
          </div>
        )}

        {/* Main Content Area */}
        <div ref={mainContentRef} className="flex-1 flex flex-col relative" style={{ backgroundColor: colors.bgMain }}>
          {/* Log Viewer */}
          <div
            className="flex flex-col min-h-0"
            style={{
              height: logViewerHeight !== null ? logViewerHeight : undefined,
              flex: logViewerHeight !== null ? 'none' : `${DEFAULT_LOG_VIEWER_RATIO} 1 0%`,
              minHeight: MIN_LOG_VIEWER_HEIGHT,
            }}
          >
            <LogViewer
              logs={logs}
              onClear={handleClearLogs}
              onExport={handleExportLogs}
              onResync={eventPush ? resyncPushedLogs : undefined}
              isConnected={connectionStatus.is_connected}
            />
          </div>

          {/* Vertical Resize Handle */}
          <div
            className="h-1 cursor-row-resize relative z-30 group"
            onMouseDown={handleVerticalResizeStart}
            style={{
              backgroundColor: isResizingVertical ? colors.accent : colors.borderDark,
            }}
          >
            <div
              className="absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-opacity-50 transition-colors"
              style={{
                backgroundColor: isResizingVertical ? colors.accent : 'transparent',
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: colors.accent }}
            />
          </div>

          {/* Send Panel */}
          <div
            className="flex-1 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)] z-20"
            style={{
              minHeight: sendPanelMinHeight,
            }}
          >
            <SendPanel
              value={sendText}
              onChange={setSendText}
              format={sendFormat}
              onFormatChange={setSendFormat}
              onSend={handleSendData}
              isConnected={connectionStatus.is_connected}
              config={config}
              checksumConfig={checksumConfig}
              onChecksumConfigChange={setChecksumConfig}
              quickCommandLists={quickCommandLists}
              currentQuickCommandListId={currentQuickCommandListId}
              onQuickCommandListsChange={setQuickCommandLists}
              onCurrentQuickCommandListChange={setCurrentQuickCommandListId}
              onSendQuickCommand={handleSendQuickCommand}
              onSendSelectedQuickCommands={handleSendSelectedQuickCommands}
              onMinHeightChange={setSendPanelMinHeight}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar connectionStatus={connectionStatus} selectedPort={selectedPort} config={config} />

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}

export default App;
