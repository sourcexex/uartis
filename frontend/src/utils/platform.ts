export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent ?? '';
  const platform = navigator.platform ?? '';
  // WebView2 on Windows can expose a platform string that looks macOS-ish in
  // some environments, so let an explicit Windows user agent win.
  if (/Windows|Win32|Win64|WOW64/i.test(userAgent) || /^Win/i.test(platform)) {
    return false;
  }
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Macintosh|Mac OS X/.test(userAgent);
}

export function isModifierPressed(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey;
}
