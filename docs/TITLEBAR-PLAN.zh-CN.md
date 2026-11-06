# 自绘标题栏计划（跨平台）

> 状态：**方案已确认（macOS 保留原生红绿灯），T1 spike 待执行**。
> 目标版本：**v1.2.0**（与 UI 视觉优化同批，先做壳层再做业务面板）。
> 关联：[`OPTIMIZATION-PLAN.zh-CN.md`](OPTIMIZATION-PLAN.zh-CN.md) §5.5、[`EXECUTION-PLAN.zh-CN.md`](EXECUTION-PLAN.zh-CN.md) Sprint 2。
> 决策变更：本计划**取代**原“三平台保留原生标题栏、不自绘”的决策。

## 0. 结论（先给结论）

采用 **“自绘标题栏内容 + 平台原生窗口控件”的混合方案**，而不是三平台都画一套假按钮：

| 平台 | 标题栏外壳 | 窗口控件 | 理由 |
|---|---|---|---|
| Windows 10/11 | 自绘（`decorations: false`） | 自绘最小化/最大化/关闭（右侧） | 视觉统一；Win11 Snap Layouts 需在 T1 评估，不能保证保留 |
| macOS 13+ | 自绘内容区（`titleBarStyle: Overlay` + `hiddenTitle`） | **保留原生红绿灯**（不画假按钮） | 保留系统菜单、全屏、辅助功能与用户习惯 |
| Linux (X11/Wayland) | 自绘（`decorations: false`） | 自绘最小化/最大化/关闭（右侧） | 无统一原生 CSD；按桌面环境适配 |

**默认开启自绘**；设置中提供“使用系统标题栏（兼容模式）”逃生口（重启生效）。不把 macOS 红绿灯改成假按钮，除非后续明确接受可用性回退。

## 1. 目标与非目标

### 目标
- 三平台一致的标题栏高度、拖拽区、标题/图标排版、暗色/亮色/高对比表现。
- 自绘按钮支持最小化、最大化/还原、关闭；悬停/按下/焦点/禁用态完整。
- 保留基础窗口能力：拖动、双击最大化/还原、边缘缩放、全屏、最小尺寸、多显示器、DPI 缩放。
- 与 UI 视觉壳层统一：为 v1.2 顶部 Toolbar/⌘K/设置入口让出空间。
- 可回退：兼容模式使用系统标题栏，避免无法启动或拖不动时无路可走。

### 非目标（本版不做）
- 不实现 Windows 11 Snap Layouts 的私有 `WM_NCHITTEST` hack（T1 只评估，默认接受缺失）。
- 不改窗口缩放/圆角/阴影的系统级实现；Mica 仍按 [`UI-VISUAL-PLAN.zh-CN.md`](UI-VISUAL-PLAN.zh-CN.md) §3.3 可选。
- 不做多窗口/多会话标题栏；仍为单主窗口。
- 不改变 macOS 菜单栏（仍由系统提供）。

## 2. 方案对比

| 方案 | 内容 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 混合（推荐） | 自绘外壳；macOS 原生红绿灯，Win/Linux 自绘按钮 | 兼顾统一视觉与平台习惯；macOS 风险最低 | Win11 Snap Layouts 可能丢失；三套控件状态需测试 | **采用** |
| B. 完全自绘 | 三平台全部自绘，包括 macOS 红绿灯 | 视觉 100% 一致 | 破坏 macOS 习惯/辅助功能；全屏/系统菜单需自行实现 | 不采用（保留为实验分支） |
| C. 原生标题栏 | 维持现状 `decorations: true` | 零风险、零维护 | 无法与自绘壳层融合；三平台高度/配色不一致 | 仅作兼容模式 |

## 3. 平台适配矩阵

### macOS
- 窗口：`decorations: true`，`titleBarStyle: "Overlay"`，`hiddenTitle: true`，`trafficLightPosition` 对齐自绘高度。
- 红绿灯：原生保留；自绘区左侧预留 70–80px 安全区，避免遮挡。
- 全屏：进入全屏时自绘栏可隐藏或压缩；红绿灯由系统管理。
- 标题：`hiddenTitle` 后由自绘文本显示；不覆盖系统菜单快捷键（⌘W/⌘M/⌘Q）。
- 注意：`trafficLightPosition` 要求 `Overlay` + `decorations: true`（Tauri 配置约束）。

### Windows 10/11
- 窗口：`decorations: false`；自绘按钮在右侧；保留 shadow 与 resize。
- 拖拽：`data-tauri-drag-region` + `startDragging()` 兜底；双击切换最大化。
- DPI：100%/125%/150%/200% 下按钮尺寸与点击区不糊、不偏移；多显示器跨屏拖动。
- Snap Layouts：自绘最大化按钮后 Win11 悬停布局默认失效；T1 评估低成本方案，失败则在发布说明标注，兼容模式可保留。
- Mica：仅当 UI 视觉计划中的材质开关开启时，标题栏背景透明以透出 Mica；关闭时纯色。

### Linux
- 窗口：`decorations: false`；自绘按钮右侧；需处理 X11 与 Wayland。
- 桌面环境：GNOME（Mutter）、KDE（KWin）、Xfce 至少冒烟；平铺 WM（sway/i3）下不遮挡。
- 缩放：边缘 resize 命中区至少 4px；最大化时按钮图标正确切换。
- 系统菜单：无原生标题栏右键菜单；兼容模式可恢复。

## 4. 技术方案

### 4.1 窗口配置与能力
- `src-tauri/tauri.conf.json`：`decorations: false`（Win/Linux 默认），macOS 用 `titleBarStyle: Overlay` + `hiddenTitle: true` + `trafficLightPosition`。
- 需要新增 Tauri capabilities 权限（按 2.12.5 实际 ACL 名核对）：
  `core:window:allow-start-dragging`、`allow-minimize`、`allow-toggle-maximize`、`allow-close`、`allow-is-maximized`、`allow-set-decorations`、`allow-set-title`。
- 平台能力检测：扩展现有 `frontend/src/utils/platform.ts` 为显式能力对象（`hasNativeTrafficLights`、`supportsSnapLayouts`、`titleBarHeight`、`buttonOrder`），业务组件不写 `navigator.platform`。
- 窗口状态：引入 `tauri-plugin-window-state`（或复用现有设置存储）保存尺寸/位置/最大化；兼容模式偏好持久化。

### 4.2 前端组件与文件

| 文件 | 改动 |
|---|---|
| `frontend/src/components/TitleBar.tsx` | 新增；图标/标题/拖拽区/平台控件/双击/焦点 |
| `frontend/src/components/WindowControls.tsx` | 新增；Win/Linux 三按钮；图标随最大化状态切换 |
| `frontend/src/hooks/useWindowControls.ts` | 新增；封装 `getCurrentWindow()` 的 minimize/toggleMaximize/close/isMaximized + 事件订阅 |
| `frontend/src/hooks/useTitleBarMode.ts` | 新增；`custom/native` 偏好、启动应用、重启提示 |
| `frontend/src/utils/platform.ts` | 扩展平台能力；标题栏高度/按钮顺序/红绿灯安全区 |
| `frontend/src/App.tsx` | 挂载标题栏；移除系统标题占位；调整根布局高度 |
| `frontend/src/styles.css` | `--titlebar-height`、`-webkit-app-region`/`data-tauri-drag-region` 命中区、no-drag 交互元素 |
| `frontend/src/i18n/translations/{en,zh-CN}.json` | 标题栏按钮 aria-label/菜单文案 |
| `src-tauri/src/main.rs` | 如需要：`get_platform_info` 返回 OS/版本/标题栏能力 |
| `frontend/src/components/SettingsModal.tsx` | 外观页增加“使用系统标题栏（兼容模式，重启生效）” |

### 4.3 交互细节
- **拖拽**：只有标题栏空白区和标题文本可拖；按钮、输入框、菜单、标签页不可拖（显式 `no-drag`）。
- **双击**：双击空白区切换最大化/还原；双击按钮不触发。
- **按钮**：最小化/最大化/关闭；关闭前若有未保存会话/录制，沿用现有确认逻辑。
- **键盘**：`Alt+F4`/`⌘Q` 由系统处理；Tab 可聚焦按钮，Enter/Space 触发；焦点环清晰。
- **标题**：显示应用名 + 当前端口/会话（可选），过长省略；不覆盖原生窗口标题（任务栏/辅助功能仍可读）。
- **主题**：标题栏跟随设计 token 主题；高对比模式用系统色；Mica 开启时背景透明，文字对比度仍达 AA。
- **全屏**：全屏时标题栏可收起（保留 1px 触发区或自动隐藏），退出全屏恢复。
- **窗口按钮顺序**：macOS 左侧原生；Windows/Linux 右侧；Linux 可通过平台能力读取桌面偏好（首版固定右侧）。

### 4.4 可访问性
- 按钮 `aria-label`（最小化/最大化/还原/关闭）、`aria-pressed` 或状态描述。
- 键盘可达、焦点可见、高对比模式可见；屏幕阅读器能读出窗口状态。
- 不依赖颜色区分按钮状态；不阻止系统快捷键。
- 兼容模式作为无障碍/故障逃生口。

## 5. 分阶段任务（v1.2）

| ID | 任务 | 工期 | 依赖 | 验收 |
|---|---|---|---|---|
| **T1** | 三平台 spike：Win/Linux `decorations:false`、macOS `Overlay`；最小可拖动标题栏；验证 resize/全屏/多显示器/Snap 限制；产出 `TITLEBAR-SPIKE-NOTES` | 2–3d | S2-01 基础设施（可并行） | 三平台可拖动/缩放；记录 Snap Layouts、Wayland、DPI 结论；Go/No-Go |
| **T2** | 核心组件：`TitleBar`/`WindowControls`/`useWindowControls`/平台能力；亮暗/高对比；i18n | 3–4d | T1 | 三平台按钮/双击/状态正确；键盘可达 |
| **T3** | Windows 适配：DPI/多屏/最大化图标/边缘 resize/标题栏高度；Mica 透明背景联动 | 2–3d | T2 | Win10/11 100–200% 无偏移；Mica 开/关可读 |
| **T4** | macOS 适配：原生红绿灯安全区/全屏/隐藏标题/菜单快捷键；不遮挡 | 2–3d | T2 | 红绿灯不重叠；全屏/退出正常 |
| **T5** | Linux 适配：X11/Wayland、GNOME/KDE 冒烟、平铺 WM、CSD 阴影/边框 | 2–3d | T2 | 至少 GNOME/KDE 可拖动/缩放；无遮挡 |
| **T6** | 兼容模式 + 窗口状态：`custom/native` 设置、重启生效、尺寸/位置记忆 | 1–2d | T2/T3 | 切回原生可恢复；重启位置正确 |
| **T7** | 验收与文档：三平台截图、a11y/高对比、性能、AGENTS/README、发布说明 | 2–3d | T3–T6 | DoD 全部通过；有回滚 tag |

**总工期**：单人约 3–4 周；与 UI 视觉 V1/V2 并行可压到约 2 周。建议顺序：T1 → T2 → T3/T4/T5 并行 → T6 → T7。

### 5.1 T1 spike 执行方案（下一步）

> 先做 T1，不改业务 UI；用最小原型验证窗口壳层，避免 T2 做完才发现平台阻塞。

**分支与产出**
- 分支：`feature/titlebar-spike`（从 `develop` 拉；**不合并 main**，原型可弃）。
- 产出：
  - `docs/TITLEBAR-SPIKE-NOTES.zh-CN.md`：平台、系统版本、实验步骤、截图/录屏、结论、阻塞项。
  - 原型代码（仅 spike 分支）：最小可拖动标题栏 + 三个窗口按钮 + 双击最大化。
  - 配置结论：平台配置文件（`tauri.windows.conf.json` / `tauri.macos.conf.json` / `tauri.linux.conf.json`）还是运行时 `set_decorations`；capabilities 需要哪些权限。
  - 更新本计划 T2/T3/T4/T5 的风险与任务。

**实验矩阵**

| 平台 | 系统/环境 | 必测项 |
|---|---|---|
| Windows | Win10 + Win11；100%/125%/150%/200% DPI；双屏 | 拖动、双击最大化、最小/最大/关闭、边缘 resize、全屏、Snap Layouts 悬停、Mica 背景 |
| macOS | 13/14/15（Intel/ARM 尽可能各一台） | 原生红绿灯位置/安全区、全屏、⌘W/⌘M/⌘Q、拖动、resize、隐藏标题 |
| Linux | Ubuntu GNOME X11 + Wayland；KDE X11/Wayland | 拖动、双击最大化、resize、平铺 WM（sway/i3）、阴影/边框、无原生菜单 |

**步骤**
1. 建 spike 分支；只加窗口配置 + 最小 `TitleBar`，不接业务状态。
2. 验证 Tauri 平台配置合并：Windows/Linux `decorations:false`；macOS `decorations:true` + `titleBarStyle: Overlay` + `hiddenTitle` + `trafficLightPosition`。
3. 加 `data-tauri-drag-region`、`startDragging()` 兜底、双击切换最大化、最大化状态订阅。
4. 补 capabilities 权限并验证 `minimize/toggleMaximize/close/isMaximized`。
5. 逐平台记录：截图、DPI/多屏、Snap 悬停、Wayland 拖动、全屏退出；填写 notes。
6. 输出 Go/No-Go 与 T2 任务拆分；清理 spike 分支或保留只读 tag。

**Go / No-Go 标准**
- Windows：Win10/11 150% 下可拖动、resize、全屏；输入区无死区；Snap Layouts 丢失已记录并接受或有方案。
- macOS：原生红绿灯不重叠；全屏/退出正常；系统菜单快捷键不被抢占。
- Linux：GNOME X11 与 Wayland 至少可拖动/resize；平铺 WM 不遮挡。
- 任一平台“无法拖动/无法 resize/全屏无法退出” → **No-Go**：保留系统标题栏，或该平台单独走原生标题栏（平台差异策略）。

**环境限制**
- 当前开发机是 Windows，只能完整验证 Windows；macOS/Linux 需要你的实机/虚拟机，或 CI 构建后本地安装验证（CI 不跑 GUI）。
- spike 不发布、不合并 main；结论写入文档后再决定 T2。

**排期**：2–3 天。建议顺序：**T1（2–3d）→ UI V1（2–3d）→ T2（3–4d）**；T1 与 V1 也可并行，但 T2 必须等两者完成。

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Windows 11 Snap Layouts 丢失 | 用户少一个系统能力 | T1 评估；接受则在发布说明标注；兼容模式可恢复原生标题栏 |
| macOS 假按钮/红绿灯错位 | 违反平台习惯、辅助功能回退 | 采用混合方案保留原生红绿灯；安全区按实测调整 |
| Linux Wayland 拖拽/缩放异常 | 无法移动窗口 | T1 用 `startDragging()` 兜底；至少保证 GNOME/KDE X11/Wayland 冒烟 |
| 拖拽区吃掉点击 | 输入框/按钮不可用 | 只给空白区 drag；交互元素显式 no-drag；自动化点击测试 |
| 全屏/最大化状态不同步 | 图标错误/布局跳动 | 订阅 `onResized` + `isMaximized()`；状态机单测 |
| DPI/多显示器 | 按钮模糊/位置漂移 | 逻辑像素尺寸；150%/200% 截图验收 |
| 高对比/键盘 | 无障碍不达标 | 设计 token + 系统色；键盘全流程；axe/人工检查 |
| 兼容模式切换需要重启 | 体验割裂 | 明确提示；持久化；启动时应用一次 |
| 与 Mica/CSP 联动 | 透明背景不可读/样式丢失 | 标题栏背景实底色兜底；Mica 仅可选；CSP 预留 `style-src 'unsafe-inline'` |
| 标题栏高度与业务 Toolbar 叠加 | 可用高度减少 | 统一 `--titlebar-height`；840×560 最小尺寸复验 |

## 7. 验收清单（DoD）

- [ ] 三平台可启动，标题栏高度/字体/图标一致；暗色/亮色/高对比正常。
- [ ] 拖动空白区移动窗口；双击空白区最大化/还原；按钮点击不触发拖动。
- [ ] 最小化/最大化/还原/关闭正确；最大化图标同步；关闭走现有确认流程。
- [ ] 边缘缩放、最小尺寸、全屏、多显示器、100–200% DPI 正常。
- [ ] macOS 原生红绿灯不重叠；Windows/Linux 按钮顺序正确。
- [ ] Win11 Snap Layouts 限制已记录；兼容模式可恢复原生标题栏。
- [ ] 键盘可聚焦/触发所有按钮；屏幕阅读器标签正确；高对比可见。
- [ ] Mica 开启时标题栏可读、关闭时纯色回退；截图/远程桌面不异常。
- [ ] 840×560 下业务 Toolbar/日志/发送区不被标题栏遮挡。
- [ ] 三平台截图与测试记录归档；有回滚 tag/开关。

## 8. 回滚

- 发布前保留 `feature/custom-titlebar` 分支与回滚 tag。
- 兼容模式设置无法解决时，回退 `decorations: true` + 移除 `TitleBar` 挂载，恢复系统标题栏。
- 不改变业务数据/设置格式；窗口状态插件可独立关闭。
