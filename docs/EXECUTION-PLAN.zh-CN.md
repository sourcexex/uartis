# Uartis 实施规划（可执行版）

> **状态**：规划完成，**等待开工**；本文不改动任何源码。
> **基线**：`main` @ `6427f51`，版本 `1.0.0`（2026-10-31）。
> **依据**：`.tmp/plan/01-backend-audit.md`、`02-frontend-audit.md`、`03-competitor-research.md`、`04-engineering-audit.md`、`05-market-*.md`；功能全集见 [`FEATURE-CATALOG.zh-CN.md`](FEATURE-CATALOG.zh-CN.md)（279 项）；总体方案见 [`OPTIMIZATION-PLAN.zh-CN.md`](OPTIMIZATION-PLAN.zh-CN.md)。
> **本文回答**：做什么、按什么顺序、每个任务改哪里、怎么验收、何时发版、哪些不做。

---

## 0. 决策记录（已锁定）

| # | 决策 | 说明 |
|---|---|---|
| D1 | 先稳定后增强 | v1.1 只修 P1 + 低成本闭环，不动 UI 体系 |
| D2 | UI 全量迁移 **Fluent UI React v9**，跨平台一致 | Windows/macOS/Linux 同一套组件/token；保留 Tailwind 做布局；自绘标题栏（混合方案，见 D9） |
| D3 | Mica 仅 Windows 11，设置里可选、默认关 | Tauri 2.12.5 内置窗口效果；不可用时自动隐藏 |
| D4 | 协议/行业能力按"内置协议模板 + 插件"做，不内置完整工业栈 | Modbus RTU 主站优先；OPC UA/S7/IEC104/CAN 不做 |
| D5 | 内核驱动类能力不做 | 虚拟串口驱动、USB 抓包、非侵入嗅探 → 进程内虚拟对端/RFC2217 替代 |
| D6 | MCP/AI 默认关闭、可审计，v2.1 再上线 | 先有 CLI/API 抽象 |
| D7 | 品牌色默认沿用 `#0A84FF`；Fluent 迁移后可一行切换 | 备选 `#0F6CBD` |
| D8 | 交付节奏：每 2–4 周一个可发布版本 | 每版必须过 DoD（见 §2） |
| D9 | 自绘标题栏（2026-11 追加，取代“保留原生标题栏”） | 自绘内容 + 平台原生控件：macOS 原生红绿灯（`Overlay`/`hiddenTitle`），Windows/Linux 自绘按钮；保留“系统标题栏”兼容模式；详见 [`TITLEBAR-PLAN.zh-CN.md`](TITLEBAR-PLAN.zh-CN.md) |

**范围边界**：v1.x 不做多会话架构、不做 Modbus（v2.0 起）、不做绘图/回放（v1.4 回放、v2.0 绘图）、不做脚本引擎（v2.1）。详见 §7。

---

## 1. 总览（7 个 Sprint / 6 个版本）

| Sprint | 版本 | 主题 | 工期（单人） | 关键产出 |
|---|---|---|---|---|
| S0 | — | 工程门禁 + 发布演练 | 4–5 天 | CI 双/三平台、锁文件、lint/test、日志、更新器校验、rc 演练 |
| S1 | **v1.1.0** | 稳定与可信 | 8–12 天（最小 7 天） | 12 个 P1 + DTR/RTS/Break + CRC32 + 导出 + 发送历史 + 字符映射/时间戳 |
| S2 | **v1.2.0** | Fluent UI 迁移（跨平台） | 5–6 周 | B1–B4、Mica 可选、a11y、依赖清理、三平台验收 |
| S3 | **v1.3.0** | 效率与日志 | 3–4 周 | 日志工具条、暂停/过滤/复制、发送计划、文件发送、⌘K、虚拟列表 |
| S4 | **v1.4.0** | 连接与回放 | 4–5 周 | 断线重连、会话/工程文件、记录 v2 + 回放、TCP/UDP、RFC2217、虚拟对端 |
| S5a | **v2.0.0** | 多会话 + Modbus | 4–6 周 | 多会话架构、Modbus RTU 主站/寄存器表/总线监视、raw PDU |
| S5b | **v2.0.x** | 绘图 + 回放 + 自动应答 | 3–4 周 | 实时波形、回放、自动应答、XMODEM/YMODEM |
| S6 | **v2.1.0** | 专业/自动化 | 6–8 周 | Modbus 从站/ASCII/TCP、解码插件、断言/报告、fuzz、Histogram、MCP/CLI/API |

**总工期**：单人串行约 **27–36 周**；双人（1 Rust + 1 前端）约 **17–22 周**；三人约 **12–16 周**（前端 2 人并行 S2/S3）。
**前置**：S0 的发布演练必须先完成——仓库目前无 tag、远端为空，首个正式 Tag 不演练大概率失败。

---

## 2. Definition of Done（每版通用）

1. **功能**：本版任务全部验收；关键路径手测矩阵（§5.3）通过。
2. **正确性**：新增/修改的纯逻辑有单测；跨会话/导出/格式化/写路径必须补回归测试。
3. **质量门禁**：`cargo fmt --check`、`clippy -D warnings`、`tsc --noEmit`、`eslint`、`prettier --check`、`vitest run`、`cargo test` 全绿；Windows + macOS（+ Linux 编译）CI 通过。
4. **性能**：v1.1 起建立基线（首屏、按键→日志渲染、1000 行滚动）；后续版本不得劣化 >10%。
5. **可诊断**：关键错误（连接/读线程死亡/更新失败/导出失败）落文件日志。
6. **可回退**：破坏性变更（Fluent、Mica、多会话、记录格式）保留开关或回滚 tag。
7. **文档**：变更涉及用户可见行为时，同步 README/AGENTS/本规划；版本号四文件一致。
8. **发布演练**：`Vx.y.z-rc.1` 预演构建 → 验证安装/更新 → 正式 tag。

---

## 3. 工作分解

> 估时单位：人日（1d≈6h）。`依赖` 指必须先完成的任务 ID。
> 文件路径为改动范围提示，不是最终 diff。

### Sprint 0：工程门禁 + 发布演练（4–5 天）

| ID | 任务 | 范围/文件 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S0-01 | 提交锁文件；CI 改 `npm ci` + npm cache；加 `rust-toolchain.toml`、`.nvmrc`、`engines` | `src-tauri/Cargo.lock`、`frontend/package-lock.json`、`.github/workflows/*`、根配置 | — | 0.5d | CI 不再按 `^` 漂移；本地/CI 同版本 |
| S0-02 | CI：Windows `cargo test/check`、Ubuntu `cargo check`、`cargo fmt --check`、`clippy -D warnings`、`push main` 触发 | `ci.yml` | S0-01 | 1d | 三平台 job 全绿；Windows 首次被编译 |
| S0-03 | 门禁加固：PR 级"四版本一致"job；release gate 要求 tag==`origin/main` HEAD 或 CI 绿灯 + semver 递增；`should_build` 被 build job 消费 | `scripts/ci-release-gate.sh`、`release.yml`、新增 `version-check.yml` | S0-02 | 0.5d | 错误 tag/版本漂移在 PR 阶段失败 |
| S0-04 | 前端质量设施：eslint + prettier + vitest + `typecheck/lint/test` 脚本；先跑通空测试 | `frontend/package.json`、`eslint.config.*`、`.prettierrc`、`vitest.config.ts` | — | 1d | CI 能跑 lint/test；`tsc`/build 仍过 |
| S0-05 | 后端日志落文件：接 `tauri-plugin-log`，关键错误写 `app_log_dir`；CSP 草案（预留 Griffel `style-src 'unsafe-inline'`） | `Cargo.toml`、`main.rs`、`capabilities/default.json`、`tauri.conf.json` | — | 0.5d | 发布版能取到日志；dev/prod CSP 不白屏 |
| S0-06 | 更新器安全（前置）：`asset_name` 白名单 + `app_cache_dir/updates` + 下载后 SHA256 校验 + 安装路径 token；Release 产出 `SHA256SUMS` | `updater.rs`、`main.rs`、`release.yml` | — | 1.5d | 篡改 URL/文件名/哈希被拒绝；正常更新链路可用 |
| S0-07 | 清理：删 6 条死命令或接线；删未用依赖（plugin-shell/scroll-area/separator）；删死 CSS；加 `[profile.release]`（lto/strip/codegen-units） | `main.rs`、`package.json`、`styles.css`、`Cargo.toml` | — | 1d | IPC 面收敛；构建体积有记录 |
| S0-08 | 文档与仓库卫生：修 README/AGENTS/LICENSE 漂移；`.gitignore` 加 `!docs/**/*.md`；`beforeDevCommand` 或 dev 脚本 | `README*.md`、`AGENTS.md`、`LICENSE`、`.gitignore`、`tauri.conf.json` | — | 0.5d | 文档与实现一致；docs 可入库 |
| S0-09 | 发布演练：push `main`、建 `develop`（或改文档为单干线）、打 `V1.1.0-rc.1`、验证双平台构建/签名/公证/更新 | GitHub 仓库、`release.yml` | S0-02/03/06 | 1d | rc 安装包可下载、更新器可识别 |

**S0 出口**：CI 全绿（Win/macOS/Linux 编译）、有日志、更新器校验、发布链路演练成功。

### Sprint 1：v1.1.0 稳定与可信（8–12 天）

> 最小版（7d）= S1-01..07 + S1-13..15 + 测试；完整版再加 R2 低成本项（S1-16/17）。

| ID | 任务 | 范围/文件 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S1-01 | 重连丢帧：后端快照只返回当前 session；前端去重键 `(session,seq)`；加"新会话"分隔行；丢帧/过载计数 | `serial_manager.rs`、`useSerialLogs.ts`、`LogViewer.tsx` | — | 1d | 收 500 帧→断开→重连，新会话首帧不丢；单测覆盖 |
| S1-02 | 自动滚动修复：按最后 `(session,seq)`/`scrollHeight` 判断；满缓冲仍跟随；累计 TX/RX 页脚 | `LogViewer.tsx`、`StatusBar.tsx` | S1-01 | 0.5d | 压测 5000 帧视图持续跟随 |
| S1-03 | 定时/循环发送：最新 `onSend` ref；payload/模式/列表变化即重启/停止；统一下拉停止；失败 toast 节流 | `SendPanel.tsx`、`QuickCommandPanel.tsx`、`App.tsx` | — | 1d | 运行中改 payload/切页不误发；10ms 失败不刷屏 |
| S1-04 | 日志行数单源：后端 `get_log_limit` 为准；UI 量程/文案/hook 硬顶对齐；快照裁剪 | `SettingsModal.tsx`、`useSerialLogs.ts`、`en/zh.json`、`serial_manager.rs` | — | 0.5d | 设 5000 = 显示 5000 = 导出 5000 |
| S1-05 | 显示格式对历史生效：切换 Txt/Hex 触发快照重格式化 + resync（或明确"仅新数据"提示） | `LogViewer.tsx`、`serial_manager.rs`、`useSerialLogs.ts` | S1-01 | 1d | 切格式后旧行同步变化；不重复/乱序 |
| S1-06 | 渲染边界 + 搜索 O(n)：6 面板 `React.memo`、日志行 memo、状态浅比较；搜索一次遍历建索引 + `useDeferredValue` | `App.tsx`、`LogViewer.tsx`、各面板 | — | 1.5d | 输入不重渲日志树；1000 行搜索不掉帧 |
| S1-07 | 导出升级：保存对话框 + TXT/CSV/JSON + toast action；导出走当前显示格式 | `App.tsx`、`serial_manager.rs`、`SettingsModal.tsx` | — | 0.5d | 三格式内容正确；路径可选 |
| S1-08 | GBK 校验和：校验预览/计算统一 `textToBytes(text, encoding)`；文本+校验发送与预览一致 | `App.tsx`、`SendPanel.tsx`、`utils/encoding.ts` | — | 0.5d | GBK 中文+CRC16 与设备端一致 |
| S1-09 | 危险操作确认：清空日志/删命令列表/断连（录制或定时发送中说明后果）；`AlertDialog` 组件 | `LogViewer.tsx`、`QuickCommandPanel.tsx`、`PortSelector.tsx`、`ui/alert-dialog` | — | 0.5d | 三处确认；键盘可取消 |
| S1-10 | DTR/RTS/Break + 引脚状态：Rust 4 方法 + 命令；前端开关 + CTS/DSR/RI/CD 灯；ESP32 进 bootloader 序列 | `serial_manager.rs`、`main.rs`、`PortSelector.tsx`/`StatusBar.tsx` | — | 1d | 拨线电平正确；可一键进下载模式 |
| S1-11 | CRC32/Modbus-CRC16/自定义多项式 + 50 种预设；范围可视化 | `utils/checksum.ts`、`SendPanel.tsx` | — | 0.5d | 已知向量测试通过；Modbus 帧可用 |
| S1-12 | 发送历史 + ↑/↓ + 重发 + 普通区行尾选择 | `SendPanel.tsx`、`App.tsx`、`types.ts` | — | 1d | 历史持久化；行尾生效 |
| S1-13 | Windows 写路径：分块写 + 按块算超时；失败按实际写入量记 TX；大包可中止 | `serial_manager.rs`、`main.rs` | — | 1d | Win 115200 发 64KiB 成功且日志完整 |
| S1-14 | 读线程 generation：每连接独立 token/flag；detach 后旧线程不复活；disconnect 关闭读端 | `serial_manager.rs` | — | 1d | 脚本化假端口：快速断开→重连无双读 |
| S1-15 | 输入/错误健壮性：hex 解析抽纯函数（ASCII 校验/大小上限）；`Ok(0)` EOF 判定；Mark/Space/1.5 明确提示；`timeout` 字段映射或删除；端口错误归一 | `main.rs`、`serial_manager.rs`、`ConfigPanel.tsx`、`types.ts` | — | 1d | 多字节输入不 panic；断线 3 次内判死；错误可读 |
| S1-16 | R2 低成本项：字符映射 imap/omap（CR/LF、DEL/BS、8bit→hex）；时间戳相对/帧间隔；编码扩展 Latin-1/UTF-16/Shift-JIS/Big5 | `serial_manager.rs`、`utilities`、`SettingsModal.tsx`、`LogViewer.tsx` | — | 1.5d | 已知映射用例通过；切编码历史可重渲染 |
| S1-17 | 测试补齐：Rust `format_bytes_*`/`export_logs`/日志上限/跨会话；vitest `useSerialLogs`/`checksum`/`timezone` | `src-tauri/src/*`、`frontend/src/**/*.test.ts` | S1-01..16 | 1d | 覆盖率提升；关键回归可自动发现 |
| S1-18 | v1.1 发布：版本四文件 → rc → 手测矩阵 → 正式 tag；更新器/签名验证 | 版本文件、`release.yml` | 全部 | 0.5d | 双平台安装包 + 更新成功 |

**v1.1 不做**：Fluent、多会话、Modbus、绘图、文件发送、XMODEM/YMODEM、记录回放、TCP 网络。避免把稳定版拖成大杂烩。

### Sprint 2：v1.2.0 Fluent UI 迁移 + 自绘标题栏（5–7 周）

| ID | 任务 | 范围 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S2-01 | B1 基础设施：引入 `@fluentui/react-components` + icons；FluentProvider + 品牌 ramp + light/dark/system；字体栈；Toast/Portal；删 ThemeContext 内联色；Tailwind preflight 收敛；CSP 放行 Griffel | `package.json`、`main.tsx`、`styles.css`、`tailwind.config.js`、`tauri.conf.json` | S1 | 3–5d | 全应用被 Provider 包裹；三平台启动正常 |
| S2-02 | B2 基础控件：用 Fluent 重写 `ui/`（Button/Input/Textarea/Dropdown/Combobox/Checkbox/Switch/Dialog/Tooltip/ProgressBar/MessageBar/Menu/Spinner/Field/Toast），保留导出路径；建组件画廊页 | `components/ui/*`、新增 gallery | S2-01 | 1–1.5w | 四态/键盘/a11y 通过 |
| S2-03 | B3 业务面板：LogViewer（原生滚动 + Fluent token）、SendPanel、QuickCommandPanel、ConfigPanel、PortSelector、StatusBar、Settings 分类页、⌘K 外壳、顶部 Toolbar | `components/*`、`App.tsx` | S2-02 | 1.5–2w | 核心链路回归；840×560 可用 |
| S2-04 | B4 清理：删 shadcn/Radix/scroll-area/separator 依赖与死 CSS；lucide → Fluent icons；bundle/性能测量；AGENTS.md 组件规范更新 | `package.json`、`components/ui`、`AGENTS.md`、`styles.css` | S2-03 | 3–5d | 依赖干净；体积增量有记录 |
| S2-05 | Mica 可选：Rust `get_platform_info`（os/version/mica_available）；设置开关（默认关）；`set_effects` 应用/清除；透明窗口回退纯色 | `main.rs`、`serial_manager.rs`/新 `platform.rs`、`SettingsModal.tsx`、`tauri.conf.json` | S2-03 | 2–3d | Win11 可开关；Win10/macOS/Linux 隐藏；截图/远程桌面可回退 |
| S2-06 | a11y/主题：焦点环、Field/Label 关联、icon aria-label、分隔条键盘、日志 `role=log tabIndex=0`、对比度 AA、减少动效 | 全前端 | S2-02/03 | 3–5d | 仅键盘完成全流程；对比度抽查 |
| S2-07 | 响应式收尾：日志工具条折行、快捷命令列折叠、StatusBar 截断、删除 640 死分支或下调 minWidth | `LogViewer.tsx`、`QuickCommandPanel.tsx`、`StatusBar.tsx`、`tauri.conf.json` | S2-03 | 2–3d | 840×560 无裁剪 |
| S2-10 | 自绘标题栏 T1+T2：三平台 spike（Win/Linux `decorations:false`、macOS `Overlay`/`hiddenTitle`）；`TitleBar`/`WindowControls`/`useWindowControls`；拖拽/双击/最大化状态/主题/i18n | `tauri.conf.json`、`src-tauri/capabilities/*`、新增 `components/TitleBar.tsx`、`WindowControls.tsx`、`hooks/useWindowControls.ts`、`utils/platform.ts`、`App.tsx`、`styles.css` | S2-01 | 4–5d | 三平台可拖动/缩放/全屏；Snap Layouts/Wayland/DPI 结论记录 |
| S2-11 | 自绘标题栏平台适配：Windows DPI/多屏/Mica 透明背景；macOS 红绿灯安全区/全屏；Linux X11/Wayland、GNOME/KDE 冒烟 | `TitleBar.tsx`、`WindowControls.tsx`、`styles.css`、`tauri.conf.json`、`settings` | S2-10 | 5–7d（可并行） | Win10/11 100–200% 无偏移；macOS 红绿灯不重叠；Linux 可拖动 |
| S2-12 | 标题栏兼容模式 + 窗口状态 + a11y：`custom/native` 设置（重启生效）、尺寸/位置记忆、按钮 aria-label/键盘/高对比 | `SettingsModal.tsx`、`hooks/useTitleBarMode.ts`、`App.tsx`、`tauri-plugin-window-state` | S2-10/S2-11 | 2–3d | 切回原生可恢复；重启位置正确；键盘全流程 |
| S2-13 | 标题栏验收：三平台截图、Snap Layouts 限制说明、840×560 复验、AGENTS/README 更新 | 文档 + 手测 | S2-11/S2-12 | 2–3d | 标题栏 DoD 全部通过 |
| S2-08 | 跨平台验收：Win10/11 + macOS 手测、Linux 构建冒烟；三套截图；CSP/Griffel 冒烟 | CI + 手测 | S2-01..07、S2-10..13 | 2–3d | 三平台截图通过；无样式丢失 |
| S2-09 | v1.2 发布准备：性能基线、体积记录、rc/正式 tag | 版本文件 | 全部 | 1d | 发版 DoD |

**风险**：Griffel 与 Tailwind reset 冲突、CSP、WebKitGTK 兼容、图标迁移；自绘标题栏另见 [`TITLEBAR-PLAN.zh-CN.md`](TITLEBAR-PLAN.zh-CN.md)（Win11 Snap Layouts 丢失、Wayland 拖拽、macOS 红绿灯、DPI/多屏）。按 B1–B4 分批合并，保留回滚 tag。

### Sprint 3：v1.3.0 效率与日志（3–4 周）

| ID | 任务 | 范围 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S3-01 | 日志工具条：暂停/冻结（保留缓冲）、方向/关键词/时间范围过滤、时间戳格式（相对/帧间隔/ISO/epoch）、会话分隔、丢帧计数 | `LogViewer.tsx`、`useSerialLogs.ts`、`serial_manager.rs` | S2 | 1–1.5w | 1000 行过滤无卡顿 |
| S3-02 | 日志体验：复制行/复制正文/复制 Hex、书签标记、语法高亮关键字、`break-all` 改按类型换行 | `LogViewer.tsx` | S3-01 | 3–5d | 选区/复制正确；书签可跳转 |
| S3-03 | 发送计划统一：一次/定时（周期+次数+停止条件）/循环（选中命令）共用运行态；运行横幅；失败节流 | `SendPanel.tsx`、`QuickCommandPanel.tsx`、`App.tsx` | — | 1w | 运行中改内容立即生效 |
| S3-04 | 十六进制编辑器 / 字节检视器（偏移+ASCII+校验预览）；粘贴识别 hex/text | `SendPanel.tsx`、新增 `HexEditor` | S3-03 | 5–7d | 可原位编辑；大输入不卡 |
| S3-05 | 文件发送（文本/HEX/二进制）：分块、块间延时、进度、中止、结果摘要 | `SendPanel.tsx`、`App.tsx`、后端分块 send/TX 队列最小版 | S1-13 | 1–1.5w | 1MB 文件完整发送且可取消 |
| S3-06 | 快速命令完整度：单条删除/复制/上移下移、导入导出 JSON、上限提示、空态 | `QuickCommandPanel.tsx` | S2 | 3–5d | 可备份迁移命令库 |
| S3-07 | ⌘K 命令面板 + 快捷键注册表（⌘F/⌘,/⌘S/⌘L、按浮层层级路由、帮助页） | `App.tsx`、新增 `CommandPalette`、`useShortcuts` | S2 | 5–7d | 全键盘连接/发送/导出/清空 |
| S3-08 | 虚拟列表阶段 1：`content-visibility` + 行 memo（保持 1000 行）；阶段 2 评估 `@tanstack/react-virtual` | `LogViewer.tsx`、`package.json` | S1-06 | 2–3d | 1000 行滚动 60fps |
| S3-09 | 计划任务/日志转发/自动备份（小项）：定时启动/停止、Syslog/文件转发、配置自动备份 | 后端新模块 | S1 | 3–5d | 长跑稳定；配置可恢复 |
| S3-10 | v1.3 发布准备 | — | 全部 | 1d | DoD |

### Sprint 4：v1.4.0 连接与回放（4–5 周）

| ID | 任务 | 范围 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S4-01 | 断线自动重连：策略化（new/latest/by-id）、退避、状态事件、会话保留 | `serial_manager.rs`、`main.rs`、`useSerialLogs.ts` | S1-14 | 1w | 拔插 USB 5s 内恢复 |
| S4-02 | 会话/工程文件：端口+参数+命令+校验+分段+布局；导入导出；`save/load/list_session` 落盘 | `main.rs`、`App.tsx`、新增 `session.rs` | S3-03 | 1–1.5w | 关掉重开一键恢复 |
| S4-03 | TX 队列 + 进度事件：队列、背压、取消、逐条结果；文件/批量共用 | `serial_manager.rs`、`main.rs` | S1-13 | 1–1.5w | 高吞吐不丢帧；失败可定位 |
| S4-04 | 记录格式 v2（方向/时间/会话/seq/元数据）+ 导入；TXT/CSV/JSON 导出复用 | `serial_manager.rs`、`types.rs` | S4-03 | 1w | 旧文件可识别；新文件可回放 |
| S4-05 | 回放/时间轴：加载 session、暂停/单步/调速、与实时视图同构 | `LogViewer.tsx`、新增 `ReplayPanel` | S4-04 | 1.5–2w | 现场日志可逐帧复盘 |
| S4-06 | TCP/UDP 桥：client/server、UDP、双口转发、背压/丢帧计数 | 后端新 `transport.rs`、`main.rs`、前端连接面板 | S4-03 | 2w | 串口服务器可连；双向透传 |
| S4-07 | RFC2217 客户端：控制线/Break/链路错误位 | 同 S4-06 | S4-06 | 1w | ser2net 可连；错误位可见 |
| S4-08 | 免驱虚拟对端/loopback + 触发式快照（前后 N 帧） | 后端 `virtual_link.rs`、`bus.rs` | S4-03 | 1w | 无硬件可测；快照可导出 |
| S4-09 | v1.4 发布准备 | — | 全部 | 1d | DoD |

### Sprint 5a：v2.0.0 多会话 + Modbus（4–6 周）

| ID | 任务 | 范围 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S5-01 | 多会话架构：`ManagerRegistry`（每端口实例）、事件带 `port_id`、命令加 `port_id`；前端会话标签 + 独立日志/草稿 | 后端大改、`App.tsx`、`useSerialLogs.ts` | S4 | 4–6w | 双端口同时收发互不干扰 |
| S5-02 | Modbus RTU 主站：功能码 01/02/03/04/06/0F/10、从站 ID、地址/数量、CRC16、3.5 字符静默、超时重发 | 新增 `protocol/modbus.rs`、前端 `ModbusPanel` | S5-01（或单端口先行） | 2–3w | 读保持寄存器成功；异常码可读 |
| S5-03 | 寄存器表 + 数值格式：CSV/JSON/XLSX 导入导出、u16/i16/u32/f32、字节序、缩放/单位；地址基数/扫描 | 前端表 + Rust 解析 | S5-02 | 1–1.5w | 一份表读写/日志复用 |
| S5-04 | 总线监视：raw PDU + 请求-响应配对 + 时序统计（P50/P95/超时率） | `bus.rs`、前端 `BusMonitor` | S5-02 | 1–1.5w | 一眼看出"通/不通/为何" |
| S5-05 | raw PDU 构造器：任意字节 + CRC/LRC + 期望响应/超时 + 历史 | `SendPanel.tsx`、`protocol` | S5-02 | 3–5d | 私有协议可测 |
| S5-06 | v2.0.0 发布准备 | — | 全部 | 1d | DoD |

### Sprint 5b：v2.0.x 绘图 + 回放 + 自动应答（3–4 周）

| ID | 任务 | 范围 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S5-07 | 数据集/解析规则：数值提取（分隔符/CSV/key=value/位域）、单位/缩放；独立 `serial://series` 事件 + 降采样 | 后端、前端 `useDatasets` | S5-03 | 1–1.5w | 1kHz 4 通道可用 |
| S5-08 | 实时波形：多通道、暂停/缩放/游标、PNG/CSV 导出 | 前端图表库（ECharts/uPlot） | S5-07 | 1.5–2w | 60fps 不卡 |
| S5-09 | 自动应答/规则触发：匹配（正则/关键字）→ 延时 → 回包；可导入导出 | 后端 `rules.rs` | S5-02 | 4–6d | 无设备也能联调 |
| S5-10 | XMODEM/YMODEM 收发（128/1K/CRC/多文件） | `protocol/xmodem.rs` | S4-03 | 5–7d | bootloader 升级可用 |
| S5-11 | v2.0.x 发布准备 | — | 全部 | 1d | DoD |

### Sprint 6：v2.1.0 专业/自动化（6–8 周）

| ID | 任务 | 范围 | 依赖 | 估时 | 验收 |
|---|---|---|---|---|---|
| S6-01 | Modbus 从站/ASCII/TCP + 设备模拟器 | `protocol/modbus.rs`、前端 | S5 | 1–1.5w | 可模拟 100 从站/异常码 |
| S6-02 | 协议解码插件：JS 沙箱 + 声明式模板（frame/fields/checksum）；模板库（Modbus/NMEA/AT/DL/T645） | 后端 `plugin.rs`/前端模板 | S5-07 | 2–3w | 新协议不改主程序 |
| S6-03 | 自动化断言/测试报告：send/expect/timeout/字段断言，JUnit/JSON 输出；CLI 可跑 | 后端 `testrunner.rs`、`uartis-cli` | S6-02 | 2–3w | CI 冒烟可调用 |
| S6-04 | fuzz/错误注入：坏 CRC/截断/错 ID/粘包/随机延迟，可复现种子 | 协议层 | S6-03 | 1w | 可复现失败样本 |
| S6-05 | 告警/Historian/变换通道：阈值+迟滞+Ack/Silence、SQLite 归档、单位换算/派生通道 | 后端 + 前端 | S5-07 | 2w | 长时采集可检索 |
| S6-06 | 可审计 MCP server + CLI/API：stdio + 127.0.0.1 HTTP、默认关、分级 consent、审计日志、只读模式 | 后端 `mcp.rs`、CLI | S6-03 | 1.5w | Agent 可控制且可审计 |
| S6-07 | 多窗口/操作员模式；DL/T645 模板 | 前端 | S6-02 | 4–6d | 副屏可用；模式可锁 |
| S6-08 | v2.1 发布准备 | — | 全部 | 1d | DoD |

---

## 4. 首批 10 个工作日（可直接开工）

| 日 | 上午 | 下午 | 日终验收 |
|---|---|---|---|
| D1 | S0-01 锁文件 + CI `npm ci`/cache + toolchain 文件 | S0-02 CI 加 Windows/Ubuntu/fmt/clippy | 三平台 job 跑起来 |
| D2 | 修 fmt 68 处 + clippy 9 条；S0-03 版本/门禁 | S0-04 eslint/prettier/vitest 基线 | CI 全绿 |
| D3 | S0-05 日志插件 + CSP 草案 | S0-06 更新器 SHA256/路径校验 | 发布版有日志；篡改被拒 |
| D4 | S0-07 清死命令/依赖/CSS + `[profile.release]` | S0-08 文档漂移/gitignore/LICENSE | 仓库卫生、体积下降 |
| D5 | S0-09 发布演练（push main/develop、rc tag） | 修演练暴露问题 | rc 双平台包可装 |
| D6 | S1-01 session/seq + 分隔行 | S1-02 自动滚动 + 页脚 | 重连不丢帧；满缓冲仍跟随 |
| D7 | S1-03 定时发送 | S1-04 日志上限 + S1-08 GBK 校验 | 无幽灵发送；校验一致 |
| D8 | S1-13 Windows 写 | S1-14 读线程 generation | 大包成功；无双读 |
| D9 | S1-07 导出 | S1-10 DTR/RTS/Break | 三格式导出；拨线可用 |
| D10 | S1-12 发送历史/行尾 + S1-11 CRC32 | S1-09 危险确认 + S1-06 memo/搜索 | 手感与安全闭环 |

**第一周不做**：Fluent、文件发送、Modbus、多会话、绘图；先把 P1 与工程门禁拿稳。

---

## 5. 测试与验收

### 5.1 自动化

| 层 | 内容 |
|---|---|
| Rust 单测 | `format_bytes_*`、`export_logs` 三格式、日志上限、`clear_logs`+epoch、跨会话快照、hex 解析、写超时计算、DTR/RTS 序列、Modbus CRC/分帧 |
| Rust 集成 | `ScriptedPort`：断开→重连→旧线程不复活；写半包记日志；断线重连；记录 v2 往返 |
| 前端单测 | vitest：`checksum`、`timezone`、`encoding`、`useSerialLogs` 去重/session、发送计划状态、搜索索引 |
| 组件/E2E | Playwright（可选）：连接→发送→导出→回放；Fluent 组件画廊截图 |
| 视觉回归 | Win11 light/dark/高对比三套；Mica 开/关；macOS/Linux 冒烟 |

### 5.2 CI 门禁（最终态）

`version-consistency` → `rust-fmt` → `rust-clippy -D warnings` → `rust-test`（macOS+Windows）→ `linux-check`（Ubuntu `cargo check` + 前端 build）→ `frontend`（`npm ci` → `tsc` → `eslint` → `prettier` → `vitest` → `vite build` → `npm audit --omit=dev --audit-level=high`）→ `shellcheck` + gate 单测 → `release`（gate 输出消费、build 前跑 test、SHA256SUMS、artifact 备份、release environment 审批）。

### 5.3 手测矩阵（每版必跑）

1. 115200 连收 >1000 帧：自动滚动、丢帧行、页脚计数、暂停/恢复。
2. 连接→收 500 帧→断开→立即重连：新帧不丢、旧帧不混排、会话分隔正确。
3. GBK 中文 + CRC16：校验一致；切 Encodings 历史可重渲染。
4. 最大日志 5000：显示/导出/设置一致。
5. 115200 发 64KiB（Windows）：成功、日志完整；拔线重连不 EBUSY。
6. 定时发送运行中改 payload/切页/断连：立即停或按新内容发。
7. 导出 TXT/CSV/JSON：路径可选、中文/引号/换行/二进制正确。
8. 840×560：控件可见；键盘全流程；⌘F 不逃逸。
9. Windows 11 Mica 开/关；macOS/Linux 纯色回退；截图/远程桌面正常。
10. 更新检查/下载：篡改 asset/URL/哈希被拒；断网有可读错误。
11. 记录→回放→逐帧；回放中切格式/过滤不崩。
12. 双端口（v2.0 起）：同时收发互不干扰；标签切换不串流。

---

## 6. 发布与回滚

### 6.1 版本号与 Tag

- 四文件同步：`version.json`、`frontend/package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`；Tag `Vx.y.z`（大写 V，CI 两种都认）。
- 版本节奏：`V1.1.0-rc.N` 演练 → `V1.1.0`。后续同理。

### 6.2 发布检查单

1. CI 全绿（含 Windows/Linux）。
2. 手测矩阵通过（§5.3）。
3. 体积/性能基线无劣化。
4. `SHA256SUMS` 已生成、更新器可校验。
5. README/AGENTS/规划文档同步；Releases 说明由 CI 生成。
6. 备份上一版安装包与配置格式（记录格式变更需兼容读取）。

### 6.3 回滚

- 每个 Sprint 结束打内部 tag；破坏性变更（Fluent、记录 v2、多会话）单独合并，可 revert。
- 材质/标题栏、Fluent 主题、新协议面板均保留功能开关（至少一个版本周期）。

---

## 7. 明确不做（本轮版本内）

| 项 | 原因 | 替代 |
|---|---|---|
| 内核虚拟串口驱动 | 签名/杀软/系统更新/三平台重写 | 进程内虚拟对端、RFC2217 |
| USB 抓包/非侵入嗅探 | 内核驱动 + 隐私/安全风险 | 本会话时间线 + 回放 + 导入 pcapng（未来） |
| 完整 OPC UA/S7/EtherNet-IP/IEC104/CAN | 独立生态与现场验证；免费竞品已有 | 协议模板 + 外部工具 |
| 脚本引擎（v1.x） | 先稳定协议/CLI 抽象 | v2.1 的 JS 沙箱 |
| MQTT/WS/云上行（v1.x） | 依赖 TCP/UDP 与协议层 | v2.x 观察 |
| 移动端/云账户/遥测 | 维护/隐私/后端成本 | 配置导入导出 |
| 固件烧录/ISP | 成熟工具已存在 | DTR/RTS 辅助 + 文档 |
| 三平台完全自绘（含 macOS 假红绿灯） | 违反平台习惯/辅助功能 | 混合方案（macOS 原生红绿灯）+ 系统标题栏兼容模式 |

---

## 8. 资源、并行与看板

### 8.1 角色（双人配置示例）

| 角色 | 负责 |
|---|---|
| Rust/后端 | S0 CI/日志/更新器、S1 写路径/读线程/DTR、S3 TX 队列/文件、S4 网络/记录、S5 Modbus、S6 协议/CLI/MCP |
| 前端/全栈 | S0 lint/test、S1 所有 UI 修复、S2 Fluent、S3 日志/发送/⌘K、S4 回放 UI、S5 绘图/Modbus UI、S6 设置/多窗口 |
| 共同 | 手测矩阵、发版演练、代码评审、文档 |

### 8.2 任务看板字段

`ID | 标题 | 版本 | 估时 | 依赖 | 写作用域 | 验收 | 状态`
- 写作用域示例：`src-tauri/src/serial_manager.rs`、`frontend/src/components/LogViewer.tsx`；并行任务不重叠。
- 每个任务完成必须附：改动摘要、测试证据（命令/截图）、风险与回滚方式。

### 8.3 周节奏

- 周一：计划 + 依赖确认（30 min）。
- 周三：中期检查（阻塞/范围变化）。
- 周五：演示 + 验收 + 更新看板；Sprint 末发 rc。

---

## 9. 里程碑与验收（汇总）

| 里程碑 | 时间（单人） | 验收一句话 |
|---|---|---|
| M0 工程门禁 | 第 1 周 | CI 三平台 + 日志 + 更新器校验 + rc 演练 |
| M1 v1.1 稳定 | 第 3 周 | 无已知 P1；重连/滚动/发送/导出/拨线全过 |
| M2 v1.2 Fluent | 第 8–9 周 | 三平台 Fluent 截图验收；依赖干净；Mica 可开关 |
| M3 v1.3 效率 | 第 11–13 周 | 日志工具条/发送计划/文件发送/⌘K 可用 |
| M4 v1.4 连接 | 第 16–18 周 | 重连/回放/TCP/RFC2217 可用 |
| M5 v2.0 平台 | 第 22–28 周 | 多会话 + Modbus + 绘图 + 回放 + 自动应答 |
| M6 v2.1 专业 | 第 28–36 周 | 协议插件 + 断言/CLI + 可审计 MCP |

---

## 10. 待确认（不阻塞开工）

1. **人员配置**：单人 / 双人 / 三人？决定排期（§8.1）。
2. **品牌色**：默认 `#0A84FF`，是否切 Fluent 默认 `#0F6CBD`（D7）。
3. **Linux 正式发布**：是否在 v1.2 后把 Linux 纳入发布矩阵（当前仅 CI 编译 + 冒烟）。
4. **Modbus 优先级**：R2 建议提前到 v1.3，但 v1.2 已排 Fluent；若业务强需求，可把 S5-02 提前到 S3 并行（需接受 UI 迁移延期 1–2 周）。

---

## 11. 立刻可以开始的 3 件事

1. **确认人员与范围**（第 10 节 1–4），据此锁定排期。
2. **执行 S0-01/S0-02**：锁文件 + Windows/Linux CI；这是后续所有质量门禁的地基。
3. **执行 S0-09 发布演练**：先证明"能发一个 rc"，再谈功能。

> 本规划未改动任何源码；所有改动将在开工后按任务逐项进行，并遵循每版 DoD。
