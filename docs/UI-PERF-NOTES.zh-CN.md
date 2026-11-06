# UI 性能与毛玻璃回退记录（V5）

> 日期：2026-11-06
> 环境：Windows 11 x64，150% 缩放，WebView2，Tauri 2.12.5，release 构建
> 关联：[`UI-VISUAL-PLAN.zh-CN.md`](UI-VISUAL-PLAN.zh-CN.md) V5

## 1. 当前防护

- 玻璃只用于固定壳层/浮层：标题栏、侧栏、状态栏、Select、Toast、Dialog、设置弹窗；日志/编辑区保持实底。
- `backdrop-filter` 缺失时由 `@supports` 回退纯色；`data-glass-supported="false"` 由 JS 标记。
- 用户设置“减少透明” → `data-reduced-transparency="true"`：玻璃变实底、blur 归零、阴影关闭。
- 系统 `prefers-reduced-transparency: reduce` / `prefers-contrast: more` / `prefers-reduced-motion: reduce` 均有 CSS 回退。
- 移除 `.app-shell` 的 `background-attachment: fixed`，避免 WebView 滚动时重复绘制背景。
- 同屏玻璃层控制在 3–4 个固定表面；blur 14px；不在日志滚动区使用。

## 2. 基线（Windows）

| 指标 | 值 |
|---|---|
| Vite CSS | 44.14 kB（gzip 8.14 kB） |
| Vite JS | 472.37 kB（gzip 145.40 kB） |
| 冷启动到窗口 | 190 ms / 77 ms / 71 ms（首次/缓存后两次） |
| 构建 | NSIS release 成功 |

## 3. 手工 FPS/交互测试（待补）

1. 连接串口/模拟 1000 行日志，持续滚动 30s，记录是否掉帧、输入是否阻塞。
2. 拖动窗口 10s、连续 resize、最大化/还原，观察标题栏/侧栏/状态栏是否延迟。
3. 打开设置弹窗、Select 下拉、Toast，确认 blur 无闪白/灰块。
4. 打开“减少透明”重复 1–3；确认纯色、无 blur、可读。
5. 通过 `prefers-contrast: more` / `prefers-reduced-motion: reduce` 系统设置复测。
6. Linux WebKitGTK 冒烟（GNOME/KDE，X11/Wayland）另记。

**通过线**：日志滚动和窗口拖动无明显掉帧；输入延迟无可感知增加；关闭透明后无视觉残留。

## 4. 未验证项

- 真实 1000 行滚动 FPS、窗口拖动 FPS 尚未量化（缺少内置压测数据源）。
- macOS WKWebView、Linux WebKitGTK 未实机验证。
- 远程桌面/录屏下 blur 性能未测。
