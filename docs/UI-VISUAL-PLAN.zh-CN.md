# UI 视觉优化与毛玻璃计划（v1.2）

> 状态：**规划中，未实现**。
> 目标版本：**v1.2.0**（与自绘标题栏 T2 同批）。
> 决策变更：**不再引入 Fluent UI React，也不做 WinUI 重写**；保留 React 18 + shadcn/Radix + Tailwind，通过设计 token、组件精修、自绘标题栏和克制的毛玻璃提升观感。
> 关联：[`OPTIMIZATION-PLAN.zh-CN.md`](OPTIMIZATION-PLAN.zh-CN.md) §5.4、[`EXECUTION-PLAN.zh-CN.md`](EXECUTION-PLAN.zh-CN.md) Sprint 2、[`TITLEBAR-PLAN.zh-CN.md`](TITLEBAR-PLAN.zh-CN.md)。

## 0. 结论

不改组件库、不重写业务面板。用**低风险、可回退**的方式做视觉升级：

1. **设计 token 化**：颜色/字体/间距/圆角/阴影/动效统一，清理 ThemeContext 内联 hex 与死 CSS。
2. **壳层精修**：自绘标题栏、侧栏、顶部工具条、状态栏统一层级与材质。
3. **克制的毛玻璃**：只用在固定壳层与浮层（标题栏、侧栏、工具条、对话框、Toast），日志正文/编辑区保持实底；无 `backdrop-filter` 时回退纯色。
4. **组件精修**：沿用 shadcn/Radix，补齐 hover/pressed/disabled/focus/加载/错误态，不换库。
5. **Win11 Mica 可选**：仅作为 Windows 11 增强，默认关闭；macOS/Linux 用 CSS 毛玻璃或纯色。
6. **可访问性优先**：对比度 AA、键盘焦点、高对比、减少动效/透明。

## 1. 目标与非目标

### 目标
- 三平台观感一致但尊重平台字体/标题栏差异；暗色/亮色/高对比三套可用。
- 至少 3 个层级（背景/壳层/浮层）有清晰的视觉层次，减少“全平”感。
- 首屏和 1000 行日志滚动性能不劣化；毛玻璃不进入滚动热路径。
- 所有 glass 表面有纯色回退，低性能/远程桌面可关闭。
- 视觉改造按组件分批，可独立回滚，不阻塞 v1.3 功能。

### 非目标（本轮不做）
- 不引入 Fluent UI React / `@fluentui/react-components` / Griffel。
- 不引入 WinUI 3 / Windows App SDK / C#/XAML 重写。
- 不重做信息架构；不换 Tailwind/shadcn/Radix。
- 不做全屏半透明/模糊日志正文（可读性和性能优先）。
- 不升级 React 19 / Vite 8 / Tailwind 4（单独专项）。
- 不把玻璃效果做成默认强制；用户可关闭。

## 2. 设计系统（token 化）

### 2.1 Token 层
- **颜色**：背景 `bg`/`bg-subtle`/`bg-elevated`、前景 `fg`/`fg-muted`/`fg-subtle`、边框 `border`/`border-strong`、品牌 `accent`/`accent-hover`、状态 `success/warning/danger/info`。
- **字体**：Windows `Segoe UI`/`Segoe UI Variable` → macOS `SF Pro`/`-apple-system` → Linux `Noto Sans`/`Ubuntu`/`Cantarell`；中文 `PingFang SC`/`Microsoft YaHei`/`Noto Sans SC`；日志区等宽 12–13px。
- **间距**：4/8/12/16/20/24/32。
- **圆角**：控件 4px、卡片/对话框 8px、大面板 12px；不混用“全圆角”。
- **阴影**：`shadow-1` 壳层、`shadow-2` 浮层、`shadow-3` 对话框；暗色减少黑色阴影、增加 1px 高光边框。
- **动效**：120ms（hover）/180ms（展开）/240ms（对话框）；尊重 `prefers-reduced-motion`。

### 2.2 主题
- 保留 `light`/`dark`/`system` 三态；`html { color-scheme }` 防 FOUC。
- shadcn CSS 变量作为公共出口，内部映射到 token；业务组件不直接写 hex。
- 清理 `ThemeContext` 内联颜色与 `styles.css` 死类；硬编码色统一进 token 文件。
- 对比度：正文 ≥4.5:1，大字号 ≥3:1；高对比模式跟随系统。

## 3. 毛玻璃（Glassmorphism）规范

### 3.1 使用范围
| 层级 | 是否使用 | 说明 |
|---|---|---|
| 标题栏 | ✅ | 半透明 + 细边框 + 轻微 blur，与内容分层 |
| 侧栏 | ✅ | 仅背景层；内部按钮/列表不叠加 blur |
| 顶部工具条 / 状态栏 | ✅ | 固定壳层，blur 12–16px |
| 对话框 / Popover / Toast | ✅ | 浮层背景 blur + 阴影；内容实底 |
| 设置弹窗 | ✅ | 外壳 glass，表单区实底保证可读 |
| 日志正文 / 发送编辑区 | ❌ | 禁止 blur；保持实底、等宽、可选中 |
| 表格/列表行 | ❌ | 避免滚动重绘与文字发虚 |

### 3.2 Token 与实现
```css
:root {
  --glass-bg: color-mix(in srgb, var(--bg-elevated) 72%, transparent);
  --glass-bg-strong: color-mix(in srgb, var(--bg-elevated) 86%, transparent);
  --glass-border: color-mix(in srgb, var(--fg) 12%, transparent);
  --glass-highlight: color-mix(in srgb, #fff 10%, transparent);
  --glass-blur: 14px;
  --glass-saturate: 120%;
}
.glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-1);
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: var(--bg-elevated); }
}
```
- 只给**固定/浮层**加 glass，不给滚动容器。
- 避免嵌套 blur；避免全屏大面积 blur。
- `prefers-reduced-transparency`/设置项开启时统一回退实底（不依赖浏览器支持）。

### 3.3 Win11 Mica（可选增强）
- 仅 Windows 11 且 Tauri 窗口效果可用时显示设置开关，默认关闭。
- Mica 走原生窗口背景；标题栏/侧栏用半透明 token 透出，日志/编辑区仍实底。
- macOS/Linux 不显示该开关，使用 CSS blur 或纯色。
- 远程桌面/截图异常时一键关闭；保留纯色回退。

### 3.4 性能与可访问性
- 首屏、1000 行滚动、窗口拖动/缩放各测 FPS；glass 层不超过 4 个可见表面。
- blur ≤ 20px；大表面用 `--glass-bg-strong` 降低透明度而不是加大 blur。
- 文字不直接压在复杂背景上；玻璃表面保证边框/对比度。
- 焦点环不被 blur 吞掉；高对比模式禁用透明。

## 4. 组件与页面改造清单

| 区域 | 改造 |
|---|---|
| App 壳层 | token 背景、标题栏/侧栏/状态栏分层；`--titlebar-height` 统一 |
| 侧栏 | 背景 glass、hover/active 精修；折叠态一致 |
| 顶部工具条 | 统一按钮尺寸/图标间距；分组与分隔线弱化 |
| 按钮/输入/下拉 | 统一 4px 圆角、hover/pressed/disabled/focus 四态；不换库 |
| 对话框/确认 | glass 外壳 + 实底内容 + 阴影；键盘可取消 |
| Toast/通知 | glass 背景 + 左侧状态色；节流与 action 保留 |
| 设置 | 分类 + 搜索保留；表单控件视觉统一；材质/透明开关放这里 |
| 状态栏 | 弱化文字、强调连接状态；不 blur 数字正文 |
| 自绘标题栏 | 接入 token/glass；与 T2 合并实现 |
| 图标 | 继续 lucide；统一 14/16/18/20 尺寸，不迁移图标库 |

## 5. 分阶段任务（v1.2）

| ID | 任务 | 工期 | 依赖 | 验收 |
|---|---|---|---|---|
| **V1** | Token/主题基础：颜色/字体/间距/圆角/阴影/动效变量；清理 ThemeContext 硬编码与死 CSS；亮暗/system | 2–3d | 无 | 业务组件不再写 hex；三主题可切换 |
| **V2** | 壳层：标题栏（与 T1/T2 合并）、侧栏、工具条、状态栏分层与 glass token | 3–4d | V1、T1 | 三平台壳层层次一致；无布局跳动 |
| **V3** | 控件精修：按钮/输入/下拉/开关/复选/对话框/Toast 四态与焦点 | 3–4d | V1 | 组件画廊验收；键盘可达 |
| **V4** | 浮层与设置：glass 对话框/Popover/设置分类；材质开关 | 2–3d | V2/V3 | 弹窗可读；开关可回退 |
| **V5** | 毛玻璃调优：范围/强度/回退；1000 行滚动与窗口拖动 FPS；WebKitGTK 冒烟 | 2–3d | V2–V4 | 不掉帧；无 filter 时纯色正常 |
| **V6** | 验收：三平台截图、亮暗/高对比、a11y、文档/AGENTS 更新 | 2–3d | V1–V5 | DoD 全部通过；有回滚 tag |

**总工期**：单人约 2–3 周；与标题栏 T2 并行可压缩。建议顺序 V1 → V2 → V3/V4 并行 → V5 → V6。

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `backdrop-filter` 在 WebKitGTK/旧 WebView 不支持 | 透明层变灰/不可读 | `@supports` + 实底回退；CI/实机冒烟 |
| 大面积 blur 导致滚动/拖动掉帧 | 性能下降 | 只用于固定壳层/浮层；限制层数与 blur 半径；实测 FPS |
| 透明导致文字对比度不足 | 可读性/a11y | 实底内容区；玻璃层加边框/阴影；对比度检查 |
| 自绘标题栏与玻璃叠加 | 层级混乱/发灰 | 标题栏用 `--glass-bg-strong`；日志区实底 |
| 主题 token 与现有 shadcn 变量冲突 | 局部样式错乱 | 先映射再替换；分批截图回归 |
| 视觉改造范围蔓延 | 拖延 v1.3 | 只改壳层与组件状态，不重排信息架构；按 V1–V6 分批 |
| Mica 与 glass 双重透明 | 不可读/性能差 | Mica 默认关；开启时标题栏实底兜底；可关闭 |
| 用户不喜欢透明 | 体验争议 | 设置“减少透明/纯色模式”，默认适度 |

## 7. 验收清单（DoD）

- [ ] 业务组件不再直接写 hex；颜色/字体/间距/圆角来自 token。
- [ ] 亮色/暗色/高对比三套截图通过；`prefers-reduced-motion` 生效。
- [ ] 标题栏/侧栏/工具条/状态栏层次清晰；日志/编辑区保持实底。
- [ ] 对话框/Toast/Popover glass 可读，焦点环可见，键盘可关闭。
- [ ] 无 `backdrop-filter` 环境自动纯色，不出现透明灰块。
- [ ] 1000 行日志滚动、窗口拖动/缩放不劣化（记录基线）。
- [ ] Windows 11 Mica 开/关可回退；macOS/Linux 正常。
- [ ] 840×560 最小尺寸下控件不被裁切。
- [ ] 设置中可关闭透明/减少动效；有回滚 tag。

## 8. 回滚

- 视觉改动按 V1–V6 分批提交，每批可 revert。
- glass 通过 `.glass` 类集中控制；关闭时移除类即可回退纯色。
- Mica 独立设置开关；默认关闭。
- 保留 v1.1.1 稳定 tag 作为回滚基线。

## 9. 实施记录

### V1 设计 token/主题基础（2026-11-06，已完成基础层）

- 新增 `frontend/src/theme/tokens.ts`：React 层只引用 `var(--app-*)`，不再在 JS 里维护第二套 hex 调色板。
- `ThemeContext` 改为 CSS 变量桥接；亮/暗切换仍由 `data-theme` 驱动，切换逻辑未变。
- `styles.css` 增加 `--app-*` 语义色、字体、间距、圆角、阴影、动效、玻璃 token；`color-scheme` 防闪烁。
- 新增 `.glass-surface` / `.glass-surface-strong` 与 `@supports` / `data-reduced-transparency` 回退；**尚未应用到壳层**（V2/V4 接入）。
- 清理业务组件硬编码：`QuickCommandPanel` 的 accent alpha、`SendPanel` 警告/激活色、`SettingsModal` 绿色状态、`LogViewer` 匹配文字色。
- 新增 `tokens.test.ts`：保证 React token 全部是 `--app-*` CSS 变量。
- 验证：`tsc` / ESLint / Prettier / Vitest（9）/ Vite build / Tauri NSIS 构建通过；Windows 150% 冒烟截图正常。
- 未做：玻璃表面实际应用、设置里的“减少透明”开关、亮/暗/高对比截图基线（留到 V2/V4/V6）。

### V2 壳层与毛玻璃应用（2026-11-06，已完成基础应用）

- 根容器新增 `.app-shell` 环境渐变（非常克制的品牌色径向光），让玻璃表面有可感知的底层层次。
- 侧栏接入 `.glass-surface`；状态栏接入 `.glass-surface-strong`；移除两处内联不透明背景。
- 设置弹窗改为 `--app-glass-bg-strong` + `backdrop-filter`，内容区保持实底；日志/编辑区仍不透明。
- 设置 → 外观新增“减少透明”（`data-reduced-transparency`），持久化到 localStorage；CSS 自动回退纯色并关闭 blur。
- 暗色主题冒烟截图通过；设置弹窗截图确认玻璃层次与文案。
- 未做：顶部全局工具条（当前还没有全局 Toolbar）、标题栏玻璃（等 T2）、其它 Dialog 统一、亮/暗/高对比三套基线、FPS 记录（V6）。

### V3 控件与状态精修（2026-11-06，已完成基础层）

- Button：四种变体统一 token 颜色、圆角、focus ring、hover/pressed/disabled；不使用内联 hex。
- Input/Textarea/Select：统一边框、圆角、focus ring、placeholder；Select 下拉改为玻璃材质 + token 阴影。
- Switch/Checkbox：checked 用品牌色，focus ring 用品牌色；Checkbox 圆角收敛到 4px。
- Dialog：统一 token 边框/圆角/阴影；Toast 改为玻璃背景 + token 颜色。
- TitleBar：接入 `.glass-surface`，标题栏与 V2 壳层材质一致；关闭按钮 hover 使用 `--app-on-accent`。
- 验证：tsc / ESLint / Prettier / Vitest（9）/ Vite build / Tauri NSIS 构建通过；暗色截图确认标题栏、侧栏、状态栏与控件层次。
- 未做：高对比/键盘全流程、其它弹窗统一玻璃、标题栏 platform 配置去闪烁、FPS 基线（V4–V6）。

### V4 浮层/对话框与可访问性（2026-11-06，已完成基础层）

- `DialogContent` 新增 `glass` 变体；设置弹窗、ConfirmDialog 统一玻璃外壳，内容区保持实底。
- 弹窗遮罩改为半透明 + 轻微 backdrop blur；Dialog 边框/圆角/阴影统一 token。
- 新增 `prefers-contrast: more`：禁用玻璃 blur、使用实底与更强边框。
- 新增 `prefers-reduced-motion: reduce`：全局降低动画/过渡时长。
- 侧栏折叠/展开与设置按钮补 `aria-label`；标题栏按钮已有标签。
- 验证：tsc / ESLint / Prettier / Vitest（9）/ Vite build / Tauri NSIS 构建通过。
- 未做：完整键盘/屏幕阅读器全流程、其它 Popover/Tooltip 统一、亮/暗/高对比截图基线、FPS 记录。



### V5 毛玻璃性能与回退（2026-11-06，基础完成，FPS 待实测）

- 新增 `utils/glass.ts`：检测 `backdrop-filter` 支持、系统 `prefers-reduced-transparency`，并按“用户显式设置 > 系统偏好 > 不支持回退”决定初始状态。
- `ThemeContext` 初始化时读取上述规则，并设置 `data-glass-supported`；设置里的“减少透明”在不支持的环境自动置为开启且禁用开关。
- CSS 增加 `prefers-reduced-transparency: reduce` 回退；移除 `.app-shell` 的 `background-attachment: fixed`（减少滚动重绘风险）。
- 新增 Vitest：glass fallback 3 例，总计 12 通过。
- 基线：Vite CSS 44.14 kB / gzip 8.14 kB；JS gzip 145.40 kB；冷启动到窗口 190/77/71 ms（首次/缓存后两次，Windows 150% DPI）。
- 未做：1000 行滚动/窗口拖动/缩放 FPS 实测、WebKitGTK 实机冒烟、亮/暗/高对比三套截图；见 `docs/UI-PERF-NOTES.zh-CN.md`。



### V6 验收（Windows 初验，2026-11-06）

- 840×560 初测发现：侧栏未折叠导致日志工具条竖排/裁切；窗口变矮后持久化日志高度未重新 clamp，发送区被挤出屏幕。
- 修复：自动折叠阈值 640 → 900；日志工具条 `flex-wrap`；窗口 `resize` 时按 `mainContentHeight - sendPanelMinHeight` 重新 clamp 日志高度。
- 复验：最小尺寸下侧栏折叠、工具条两行内可读、发送区完整；截图 `assets/ui-v6-min-windows.png`，详见 [`UI-V6-ACCEPTANCE.zh-CN.md`](UI-V6-ACCEPTANCE.zh-CN.md)。
- 验证：tsc / ESLint / Prettier / Vitest（12）/ Vite build / Tauri NSIS。
- 高对比模式新增设置开关（`data-contrast="more"`）：实底玻璃、强边框、提高文字对比；系统 `prefers-contrast: more` 仍自动生效。
- 外观设置扩展：跟随系统主题、强调色（蓝/绿/紫/橙，同步 shadcn `--primary/--ring`）、毛玻璃强度（轻/标准/强，`data-glass`）、减少动效（`data-reduced-motion`）。
- 控制台外观：日志区背景预设（跟随主题/深海蓝/森林绿/葡萄紫/暖纸/纯黑）、自定义颜色（自动黑白文字对比）、控制台字号 12–16px；通过 `data-console-bg` + `--app-console-*` token 应用。
- 所有新增设置项均补齐 en/zh-CN 文案；i18n parity 测试 15 通过。
- 未完成：亮色/高对比截图、完整键盘/屏幕阅读器、FPS 量化、macOS/Linux 实机、v1.2 版本与发布准备。

