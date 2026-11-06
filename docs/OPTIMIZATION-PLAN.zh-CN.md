# Uartis 全面分析与优化规划（v1.0.0 → v2.x）

> **状态**：仅规划，未改动任何源码、配置或依赖。
> **基线**：`main` @ `6427f51`，版本 `1.0.0`（2026-10-31）。
> **方法**：R1 四路并行只读审计（后端 / 前端 / 竞品 / 工程化）+ R2 四路市场调研（Windows 商业/国产、macOS/Linux/CLI、开源/现代、协议/工业/测试），实际抓取 140+ 页面；本地实测（`cargo test` 49 通过、`cargo clippy`、`cargo fmt --check`、`npx tsc --noEmit`、`npm run build`）。
> **配套报告**：`../.tmp/plan/01-backend-audit.md`、`02-frontend-audit.md`、`03-competitor-research.md`、`04-engineering-audit.md`、`05-market-{windows,unix,oss,protocol-test}.md`；**功能全集**：[`FEATURE-CATALOG.zh-CN.md`](FEATURE-CATALOG.zh-CN.md)（279 项）；**可执行排期/任务分解**：[`EXECUTION-PLAN.zh-CN.md`](EXECUTION-PLAN.zh-CN.md)。

---

## 0. 一页结论

**总体判断**：这不是一个"空壳/玩具"项目。RFC #3 的事件总线（session/seq、drop-oldest、缺口上报）、纯函数帧切分 + 49 个单测、i18n 216 key 对齐、`tsc --noEmit` 通过、shadcn 规范遵守度高——骨架是专业水准。问题集中在两类：**"状态归属/闭包正确性"** 与 **"渲染边界缺失"**，以及一批**未收尾的半成品**（更新器安全、导出格式、会话管理、工程门禁）。

| 维度 | 结论 | 证据 |
|---|---|---|
| 数据正确性 | 存在 **3 个静默丢数据/错数据** 缺陷：重连丢帧、自动滚动永久失效、GBK 校验和算错 | `useSerialLogs.ts:87,127`、`LogViewer.tsx:189-198`、`App.tsx:509-544` |
| 稳定性 | **2 个 P1**：Windows 大包发送必失败；detach 的旧读线程会被重连"复活"造成双读 | `serial_manager.rs:93,235-238,462`、`:216,307,441-453` |
| 安全 | 更新器**无签名/哈希校验** + `asset_name` 未净化 + 任意路径执行 → 用户态任意代码执行链；CSP 全关 | `updater.rs:234-238,313-327`、`tauri.conf.json:26-28` |
| 性能 | 0 个 `React.memo`，输入 1 个字符重渲 1000 行日志；搜索高亮 O(n²) | `App.tsx:145`、`LogViewer.tsx:452-498` |
| 交互 | 危险操作无确认；导出不弹保存框且格式写死 TXT；可访问性系统性缺失（0 个 `aria-*`） | `LogViewer.tsx:530`、`App.tsx:575-606`、报告 §6 |
| 功能 | 基本盘（参数/HEX/日志/命令/校验/分段/记录/更新）已齐；缺 **多会话、文件发送、X/YMODEM、Modbus、绘图、DTR/RTS 手控、断线重连、CSV/JSON 导出、网络转发** | 竞品矩阵 §2 |
| 工程化 | Windows Rust 代码在 CI 中**从未编译**；release 不复用 CI 且 `push main` 不跑 CI；`Cargo.lock`/`package-lock.json` 不入库；无 lint/fmt 门禁（`cargo fmt --check` 68 处不过）；仓库**无 tag、无 develop、远端为空**、发布链路从未演练 | `ci.yml:5-9,19-23`、`release.yml:37-54`、`.gitignore:4,13`、`git ls-remote` 空 |

**视觉方向（已确认）**：保留 shadcn/Radix + Tailwind，通过设计 token、组件精修、自绘标题栏和克制的毛玻璃提升观感；**不引入 Fluent UI，也不做 WinUI 重写**。Mica 仅 Windows 11 且设置里可选（默认关）。详见 §5.4。

**功能全集（R2 已合并）**：R1 + R2 共盘点 **279 项功能**（[`FEATURE-CATALOG.zh-CN.md`](FEATURE-CATALOG.zh-CN.md)），本规划已把可做项排到 v2.1，剩余标注"观察/不做"并给理由；R2 新增的字符映射、时间戳格式族、端口锁、RTS/DTR 脉冲、日志轮转、快照、工程文件、回放、raw PDU、RFC2217、协议模板、Modbus、波形、脚本/断言、MCP 均已纳入。

**推荐路线（先稳、再换、后强）**：

- **Sprint 0（1.5–2 天）** 工程门禁归位：提交锁文件、fmt/clippy/typecheck/lint/test 进 CI、Windows+Linux 编译 job、版本单源、清死代码与死依赖。
- **Sprint 1（约 5–7 天）→ v1.1.0「稳定版」** 修完 12 个 P1 + 3 个高 ROI 体验项（导出、日志上限、危险确认），补跨会话/格式化回归测试；**本版不动 UI 体系**。
- **Sprint 2（约 4–5 周）→ v1.2.0「视觉优化版」** §5.4 V1–V6：设计 token → 壳层/标题栏 → 控件四态 → 浮层/设置 → 毛玻璃调优；跨平台验收，Mica 可选开关。
- **Sprint 3（约 3–4 周）→ v1.3.0「效率版」** 日志工具条、发送计划、文件发送、快速命令、⌘K、虚拟列表（基于统一设计 token 与现有 shadcn 组件）。
- **Sprint 4（约 4–5 周）→ v1.4.0「连接与协议版」** DTR/RTS/Break、断线重连、TX 队列、记录 v2 + 回放、会话持久化、TCP/UDP 桥。
- **Sprint 5+（v2.0）** 多会话标签、Modbus RTU 主站、协议帧模板/字段视图、实时绘图、记录回放、自动应答；差异化再看 XMODEM/YMODEM、脚本化/CLI/MCP。
- **Sprint 6（v2.1）** 专业/自动化：Modbus 从站/ASCII/TCP、解码插件、断言/报告、fuzz、告警/Historian、可审计 MCP + CLI/API。

**最该先做的 10 件事**（全部 S 级、独立可验证）：

| # | 事项 | 域 | 证据 |
|---|---|---|---|
| 1 | 重连丢帧：快照只返回当前 session / 去重键改 `(session,seq)` | 前后端 | `useSerialLogs.ts:87,127` |
| 2 | 自动滚动失效：改按"最后一条 seq/scrollHeight"判断 | 前端 | `LogViewer.tsx:189-198` |
| 3 | 定时/循环发送陈旧闭包 + 不停表 | 前端 | `SendPanel.tsx:220-254` |
| 4 | Windows 写超时：分块 + 按块算超时 + 记录已写字节 | 后端 | `serial_manager.rs:93,462` |
| 5 | 读线程 generation 化，杜绝旧线程复活 | 后端 | `serial_manager.rs:216,441-453` |
| 6 | 更新器：净化 `asset_name`、限定目录、下载后 SHA256、安装路径 token | 后端/CI | `updater.rs:234-238,313-327` |
| 7 | 导出升级：保存对话框 + TXT/CSV/JSON | 前端 | `App.tsx:575-606` |
| 8 | 日志行数单一来源（设置=显示=导出一致） | 前后端 | `useSerialLogs.ts:48` vs `serial_manager.rs:664-675` |
| 9 | 渲染边界：6 个面板 `React.memo` + 日志行 memo + 状态浅比较 | 前端 | `App.tsx:145`、`LogViewer.tsx:664-709` |
| 10 | 危险操作确认（清空/删列表/断连） | 前端 | `LogViewer.tsx:530` 等 |

---

## 1. 项目现状（实测）

### 1.1 架构

```
Webview (React 18) ──invoke 35 命令──▶ Tauri IPC ──▶ AppState
        ▲                                              │
        │ emit serial://frames                         ▼
  事件泵线程 ◀── FrameBus ◀── 读线程(std::thread) / 写路径(命令线程)
                (session/seq/有界队列/drop-oldest)      │
                                                        ▼
                                   SerialManager: 单端口、日志、统计、录制、导出
                                   帧切分 FrameSegmenter（Timeout / Combined，64KiB 硬上限）
```

- 模块：`main.rs`(493) 命令层+事件泵 / `serial_manager.rs`(1609) 生命周期+日志+录制+导出 / `framing.rs`(366) 纯切分 / `bus.rs`(345) 帧总线 / `types.rs`(254) DTO / `updater.rs`(620) 自研更新器。
- 线程模型：主线程 + 读线程 + 事件泵线程 + tokio 异步命令；**无 TX 队列**（写就是命令线程直接 `write_all`），**无 tokio 长任务**。
- 已知设计约束（AGENTS.md）：macOS 只留 `cu.*`、隐藏系统虚拟口、日志区不用 `ScrollArea`、快捷命令下拉自定义、四文件版本同步、发版三条件门禁。

### 1.2 已具备能力（与 README 对照）

| 能力 | 状态 | 说明 |
|---|---|---|
| 端口枚举/热插拔轮询、USB 信息、macOS 清洗 | ✅ | `serial_manager.rs:147-189,1047-1105` |
| 波特率/数据位/校验/停止位/流控/超时 | ✅（有坑） | Mark/Space、1.5 停止位**全平台不支持**却仍可选（静默降级，见 3.2-BE-06） |
| Text/Hex 收发、UTF-8/GBK | ✅ | 编码走后端 `encoding_rs` |
| 时间戳/方向/行号/搜索/自动滚动/特殊字符可视化 | ✅ | 自动滚动有 P1 缺陷（3.1-FE-1） |
| 校验和 XOR/ADD8/CRC8/CRC16/CCITT + 起止索引 | ✅ | 仅前端计算，GBK 下算错（3.1-FE-8）；缺 CRC32/Modbus-CRC16 |
| 帧分段（Timeout / Combined + 自定义分隔符） | ✅ | 纯函数 + 14 个单测，质量高 |
| 快速命令（分组/重命名/行尾/HEX/批量/循环/本地持久化） | ✅ | 缺单条删除/排序/导入导出/上限提示（§4） |
| 定时发送（10ms–60s） | ✅ | 有陈旧闭包缺陷（3.1-FE-3） |
| 文本/原始录制（TXT+BIN） | ✅ | 无回放能力，RAW 无方向/时间（§4） |
| 日志导出 | ✅/❌ | 后端支持 TXT/CSV/JSON，**前端只接 TXT 且不弹保存框** |
| 自动更新 | ✅（不安全） | 自研下载器无签名/哈希（3.1-S-01/S-02） |
| i18n 中/英、亮/暗主题、可拖拽三区布局 | ✅ | 主题三轨并存、对比度不足（§5） |
| 多会话、文件发送、X/YMODEM、Modbus、绘图、脚本、网络转发 | ❌ | 见 §2/§4 |

### 1.3 工程/质量基线（实测）

| 项 | 结果 |
|---|---|
| Rust 测试 | **49 通过 / 0 失败**（framing 14、bus 5、serial_manager 18、updater 12），0.21s |
| `cargo clippy --all-targets` | 9 条警告（bin）+ 7 条（test target），**CI 无门禁** |
| `cargo fmt --check` | **不通过：68 处 diff / 7 个文件** |
| `npx tsc --noEmit` | **通过**（`strict`、`noUnusedLocals` 全开；显式 `any` 仅 1 处） |
| `npm run build` | 成功，单 chunk JS 437.67 kB（gzip 136.24 kB）+ CSS 34.67 kB |
| 测试覆盖盲区 | 命令层 0 覆盖（`main.rs` 493 行、`types.rs`）、`export_logs`、显示格式化、录制生命周期、跨会话契约、Windows 专属路径；前端 0 测试 |
| CI | PR 级：`macos-latest` 跑 `cargo test` + Ubuntu `tsc/build`；**Windows 从未编译、无 fmt/clippy/前端 lint/组件测试**；`push main` 不触发 CI，release 不复用 CI |
| 发版门禁 | 三条件脚本存在且校验四文件版本；但只查 tag commit 是 `origin/main` 祖先，**不要求 main HEAD / CI 绿灯 / semver 递增**；`should_build` 输出未被消费 |
| 版本一致性 | 四文件均 `1.0.0` ✅；但 `version.json.build=20260903` 与实际时间脱节且无门禁；UI 展示该值 |
| 锁文件 | `Cargo.lock`（127 KB）与 `frontend/package-lock.json`（117 KB）**均被 gitignore** → CI 用 `npm install` 漂移、rust-cache 失效、构建不可复现 |
| 现有分支/Tag/远端 | 本地仅 `main`、**无 Tag、无 `develop`**；`git ls-remote origin` 为空，GitHub 仓库 2026-10-31 创建 size 0 → **从未 push、从未发布** |
| 依赖漂移 | 实测 React 18.3.1 / Vite 4.5.14 / Tailwind 3.4.19 / lucide 0.263.1 / TS 5.9.3；最新 19.3.1 / 8.3.5 / 4.3.3 / 1.66.0 / 7.0.2；Rust `dirs 5+7` 并存、`reqwest 0.12+0.13` 双版本、`tokio full` 仅用 `spawn_blocking`；dev 工具链 2 条 npm 漏洞（esbuild/vite） |
| 质量设施 | 无 ESLint/Prettier/Vitest/rustfmt.toml/.editorconfig/.nvmrc/rust-toolchain.toml/Dependabot/SECURITY.md；`.gitignore` 全局忽略 `*.md`；无 `[profile.release]`；LICENSE 仍是模板占位符 |

### 1.4 做得好、应当保留的设计

1. **事件推送替代 100ms 全量轮询**：snapshot + seq 去重 + epoch 防复活 + rAF 批量，方向正确，只需修 session 维度。
2. **纯函数帧切分 + golden 测试**：把"读粒度影响超时语义"这类硬件相关 bug 钉死在测试里。
3. **drop-oldest + `dropped_before`**：通道过载可见而非静默（且有占位行）。
4. **macOS 端口清洗有测试**：`cu.*` 去重、系统虚拟口隐藏在真实设备上解决了体验痛点。
5. **i18n 双语文案 key 完全对齐（216/216）**、`tsc` 严格模式、shadcn 遵守度高（0 处原生 `<button>/<select>`）。

---

## 2. 竞品与趋势（联网调研摘要）

> 完整 26 工具 × 26 列矩阵、逐项价值/场景/难度、22+ 条建议与来源链接见 `03-competitor-research.md`。

### 2.1 竞品格局（关键事实）

- **Windows 经典**：SSCOM 5.13.1（CRC16/CCITT/CRC32/异或/累加、文件发送、TCP/UDP）、XCOM v3.0（协议传输/文件发送/保存接收窗）、Hercules（CTS/RTS/DTR/DSR/RI/CD 全控 + TCP/UDP）、RealTerm（CLI+ActiveX+双口桥接）、Termite（DLL 插件/自动应答）、QModMaster/Modbus Poll（Modbus 主站与总线监视）。
- **macOS**：CoolTerm 2.4.0（多端口并发、Python 脚本、X/YMODEM、Chart、会话文件）、Serial 2（X/Y/ZMODEM+Kermit、SSH/RFC2217、Profiles）。
- **开源/跨平台**：Serial Studio 4.2.1（UART/MQTT/Modbus/CAN/OPC UA 统一遥测看板、LuaJIT、Historian 回放、MDF4/CSV/FFT，核心 GPL + Pro 付费）、x-tools v7.7.1（UART/BLE/TCP/UDP/WS/Modbus/CAN/MQTT/CoAP + Lua/JS + 自动应答）、SerialPlot、SerialTest、VOFA+、PlatformIO monitor（默认自动重连、filter 插件）。
- **趋势**：① 串口→MQTT/WS/工业协议网关化；② 协议解码插件化/脚本化；③ **2026 集中出现 MCP/AI 串口服务器**（serial-mcp-server、serial-mcp、SerialRUN 等，让 LLM/Agent 直接操作串口）；④ 绘图升级为"示波器/分析仪"（GPU/FFT/瀑布图）；⑤ 多标签工作区 + 命令面板；⑥ CLI/无头与 Linux/ARM 发布。

### 2.2 差距矩阵（只列有决策价值的行）

| 能力 | Uartis | 一线竞品 | 价值判断 | 难度 |
|---|---|---|---|---|
| 多会话/多端口 | ❌ | CoolTerm、Modbus Poll | 多板联调刚需，但架构代价最高 | 高 |
| 定时/循环发送 | ✅ | SSCOM/XCOM/Modbus Poll | 已具备，别重复投入 | — |
| 文件发送（进度/中止/分块） | ❌ | XCOM/SSCOM/CoolTerm | 固件参数下发，高频 | 中 |
| X/YMODEM | ❌ | CoolTerm/Serial/CuteCom（Serial Studio 放 Pro） | 裸机 bootloader 唯一通道，付费点 | 中 |
| Modbus RTU/ASCII | ❌ | QModMaster/Modbus Poll/Serial Studio Pro | 工业第一协议，高价值 | 高 |
| 协议解析/自定义帧 | ❌ | Termite .flt/Serial Studio 解码器/x-tools 脚本 | 日志可读性，可先做轻量规则 | 高 |
| 实时绘图 | ❌ | VOFA+/SerialPlot/Serial Studio | 传感器/PID 调参刚需 | 中-高 |
| 记录回放 | ❌（只记录） | Serial Studio Replay/Historian | 现场复盘/验收留证 | 中-高 |
| CSV/JSON 导出 | 后端已有，前端未接 | Modbus Poll/Serial Studio | 1 个下午的收益 | 低 |
| DTR/RTS/Break 手控 | ❌ | Hercules/CoolTerm/picocom/XCOM | ESP32/STM32 进下载模式刚需 | 低 |
| 断线自动重连 | ❌ | PlatformIO 默认重连 | 无人值守测试刚需 | 低-中 |
| CRC32 / Modbus-CRC16 | ❌ | SSCOM/Modbus Poll | 自研协议刚需 | 低 |
| 发送历史/↑ 调取 | ❌ | CoolTerm/Termite/minicom/Serial Studio 4.2 | 高频效率 | 低 |
| 时间戳格式族（相对/帧间隔/ISO/epoch） | 固定 `HH:MM:SS.mmm` | tio（5 种）/minicom（4 种）/CoolTerm | 时序排障 | 低 |
| 字符映射 imap/omap（CR/LF、DEL/BS、8bit→hex） | ❌ | picocom/tio `--map`/minicom | CLI 事实标准、GUI 稀缺 | 低 |
| 编码扩展（Latin-1/UTF-16/Shift-JIS/Big5/GB18030） | 仅 UTF-8/GBK | 友善/YAT/HHD/x-tools | 老设备与中文外设 | 低 |
| 端口锁/只读/no-init 打开模式 | ❌ | picocom/socat/gtkterm/tio | Linux 多工具并存刚需 | 低 |
| 日志轮转/文件名模板/结构化导出 | 仅 TXT 固定命名 | 友善/SecureCRT/slsnif/Modbus Poll | 长时间抓取与交付 | 低-中 |
| 暂停/冻结 + 方向/正则过滤 + 复制行 | ❌ | CoolTerm/HHD/IDF monitor | 日志可用性 | 低-中 |
| 触发式快照（前后 N 帧） | ❌ | Docklight/HHD/SecureCRT | 偶发错误唯一复现手段 | 低-中 |
| 工程/工作区文件（布局+会话组+配置） | ❌ | Docklight/友善 .spu/YAT/SecureCRT | 关掉重开不用重配 | 中 |
| 脚本/断言/CI/报告 | ❌ | Docklight/SecureCRT/tio/IDF/PlatformIO | 从"人点"到"可回归" | 高 |
| MCP/AI 串口（可审计） | ❌ | SerialRUN/QSerial/serial-mcp-server/Serial Studio | 2026 新品类，缺治理赢家 | 中-高 |
| TCP/UDP/WS 桥 + RFC2217 | ❌ | RealTerm/Hercules/x-tools/ser2net | 串口服务器/远程 | 中 |
| MQTT/工业网关/时序库 | ❌ | Serial Studio/x-tools/InfluxDB | 上云趋势 | 高 |
| 自动更新 | ✅ | 桌面工具中反而少见 | 应保留，但要补安全 | — |

### 2.3 对 Uartis 的三条战略启示

1. **差异化空位**："XMODEM/YMODEM + Modbus + 绘图 + 脚本"四件套目前没有任何工具同时免费全平台提供；R2 进一步确认"协议 + 分析 + 回放"三块同时全绿的**开源工具为 0**（Serial Studio 锁 Pro、x-tools 缺绘图/回放、SerialRUN 缺变换/Historian）。
2. **先后顺序**：先补齐"能干活"的确定性闭环（DTR/RTS、CRC32、结构化导出、发送历史、字符映射、日志轮转、重连），再投入平台化（多会话、协议栈、绘图、回放）；顺序反了会长期停在 60 分。
3. **MCP/AI 是 2026 的"必须具备"而非"新奇玩具"**：SerialRUN/QSerial/serial-mcp-server/Serial Studio 都已入场；但普遍缺"分级 consent + 调用审计 + 只读模式"治理。Uartis 应先把 CLI/API 抽象做稳，再做**可审计、默认关闭**的 MCP server（v2.1/观察），不要塞进 v1.x。

### 2.4 R2 补充调研结论（功能全集 279 项）

第二轮追加 4 路调研（Windows 商业/国产、macOS/Linux/CLI、开源/现代、协议/工业/测试诊断），实际抓取 110+ 页面，合并出 **279 项功能**，详见 [`FEATURE-CATALOG.zh-CN.md`](FEATURE-CATALOG.zh-CN.md)。对规划影响最大的 6 条：

1. **免费/Pro 边界在"协议 + 回放"**：Serial Studio 4.2.1 把 Modbus/OPC UA/S7/EtherNet-IP/IEC104/CAN/MQTT/Historian/MDF4/多设备/工作区全锁 Pro（免费层仅 UART/TCP/UDP/BLE+CSV）。Uartis 若"免费给全"= 可验证差异化。
2. **开源没有"协议+分析+回放"三块全绿的工具**（Serial Studio 靠 Pro、x-tools 缺绘图/回放、SerialRUN 缺变换/Historian）——产品空位明确。
3. **A/C 类红海**：端口/参数/HEX/时间戳几乎人人都有，做到不落后即可；投入应押 E（协议）/F（分析）/D（回放）。
4. **2026 新品类 = 串口 + MCP/AI**：SerialRUN（23 工具）、QSerial（47 工具）、serial-mcp-server（JSON 宏 DSL + 无硬件模拟）、Serial Studio `ui.automation.*` + 分级 consent；但普遍缺"分级 consent + 审计 + 只读模式"治理——Uartis 可用 Rust 侧 MCP 补这一差异。
5. **"轻"是优势**：Tauri/Rust 对比 Serial Studio 200–295MB、Electron 150MB+，可主打秒开/小体积/低内存。
6. **中文工程生态护城河**：GBK/GB18030 全链路、中文协议模板/寄存器名/错误信息/文档、国产开发板预设；SSCOM/XCOM 停更、中文开源项目仍年轻。

**R2 新增且已进排期的功能**：字符映射、时间戳格式族、端口锁/只读、RTS/DTR 脉冲编排、日志轮转/文件名模板、暂停/过滤/复制、触发式快照、工程/工作区文件、记录回放、raw PDU、RFC2217、TCP/UDP 桥、协议模板/字段视图、Modbus 工作台、波形、脚本/断言/报告、CLI/API/MCP。完整 279 项见 catalog，含"不做清单"与理由。

---

## 3. 问题清单

> 标签：`[bug]` / `[UX]` / `[技术债]` / `[安全]`；工作量 S ≤0.5 人日、M ≤2 人日、L >2 人日。
> 完整 22 条后端缺陷、16 条前端缺陷、28 项改造清单分别见两份审计报告。

### 3.1 P1：数据丢失 / 功能失效 / 安全（Sprint 1 全修）

> ID 规则：`FE-*` 前端缺陷、`BE-*` 后端缺陷（对应后端报告 B-0x）、`S-0x` 安全、`P-0x` 性能。

| ID | 问题 | 证据 | 影响 | 修复方向 | 量 |
|---|---|---|---|---|---|
| **FE-1** | 日志缓冲满（默认 1000）后**自动滚动永久失效**：追加不改变 `logs.length`，`hasNewLogs` 恒 false | `LogViewer.tsx:51,189-198`；`useSerialLogs.ts:62-71,48` | 115200 下约 10s 后视图停止跟随，误判"设备停了" | 以最后一条 `(session,seq)` 或 `scrollHeight` 增长判断；保留"上滚暂停/回底恢复" | S |
| **FE-2 / BE-03** | **重连丢帧**：去重只用 `seq`，而 connect 不清旧日志缓冲，`lastSeqRef` 取旧会话最大值 | `useSerialLogs.ts:87,105-108,124-141`；`serial_manager.rs:191-213,565-570` | 重连后新会话前 N 帧（N=旧会话帧数）静默消失；新旧混排无分隔 | 后端快照只返回当前 session；前端去重键 `(session,seq)`；加"新会话"分隔行 | S |
| **FE-3** | **定时/循环发送持陈旧闭包 + 切页不停表**：运行中编辑 payload/切列表/切 Quick 页仍后台发旧数据 | `SendPanel.tsx:89,220-235,249-254`；`QuickCommandPanel.tsx:146-163` | 可能持续向设备写错误内容（嵌入式场景真实风险）；失败 toast 无节流会刷屏 | 定时器只持"发送函数 ref"（`latestOnSend`）；payload/模式/列表变化即重启或停止；统一 stop 入口 + 运行横幅；失败 toast 节流 | S |
| **FE-4 / BE-18** | **最大日志行数四处不一致**：UI 1000–100000 / 后端 clamp 100–10000 / 前端硬顶 1000 | `SettingsModal.tsx:170,529-537`；`serial_manager.rs:664-675`；`useSerialLogs.ts:48`；`en.json:140` | 设 5000 实际只显示 1000；"看到的"≠"导出的" | 单一来源（后端 `get_log_limit`），前端 hook 读取；UI 量程与 clamp 一致 | S |
| **FE-5** | **Txt/Hex 显示格式对历史无效**：`display_text` 接收时固化且优先展示，事件帧 `data:[]` 无法重算 | `LogViewer.tsx:543-551,704`；`serial_manager.rs:267,480`；`useSerialLogs.ts:128-139` | 切换格式/编码后旧行"不听话"；hex 模式无法复制/复核二进制 | 短期：切换时对 snapshot 全量重格式化并 resync；长期：事件帧带原始字节（base64/二进制 IPC）或前端保留最近 N 条 data | M |
| **FE-6** | **每次按键/每秒轮询全树重渲染**：App 持有 `sendText`/快捷命令，0 个 `React.memo` | `App.tsx:145,425,443-457`；`LogViewer.tsx:46,664-709` | 输入 1 字符重渲最多 1000 行日志 DOM；Tauri WebView 上可感知卡顿 | 面板 `React.memo` + 日志行 memo + 状态浅比较；`sendText` 下沉 SendPanel；快捷命令入 hook/context | S→M |
| **FE-7** | **搜索高亮 O(n²)**：每行重扫前序全部日志算全局匹配序号 | `LogViewer.tsx:452-498,462-469` | 1000 行时每次按键约 5×10⁵ 次 `toLowerCase` | 一次遍历建 `Map<logIndex,{start,end}[]>` + 前缀和；`useDeferredValue` + 120ms debounce；匹配上限 | S |
| **FE-8** | **校验和 + GBK 中文算错**：前端固定 UTF-8 `TextEncoder` 算 CRC/XOR，后端按 GBK 发送 | `App.tsx:509-544`；`SendPanel.tsx:299-335`；`utils/encoding.ts` | 设备收到的校验字节与界面预览不一致 → 通信被拒，难排障 | 统一走 `textToBytes(text, encoding)`（GBK 经 `encode_text` 命令）；预览与发送共用 | S |
| **FE-9** | **导出不弹保存框、格式硬编码 TXT**：后端已支持 Csv/Json | `App.tsx:575-606`（`format:'Txt'`）；`serial_manager.rs:631,645` | 用户无法选路径/格式，无法进 Excel/Python | 导出菜单 → `save()` 对话框 → TXT/CSV/JSON；toast 带"打开所在文件夹/复制路径" | S |
| **BE-01** | **Windows 写超时固定 50ms**：只有 unix 分支抬到 1000ms；大包 `WriteFile` 超时失败，已写字节不入日志/统计 | `serial_manager.rs:93,231-238,462,470` | Windows 上超大包发送必失败；设备已收到半包但界面显示失败 | 分块写 + 按块排空时间算超时；失败也记录已写字节（循环 `write` 累计） | M |
| **S-01 / S-02** | **更新器安全**：无签名/哈希校验；`asset_name` 未净化（可 `..\` 逃逸）；`launch_installer_and_exit` 执行任意路径 | `updater.rs:234-238,313-327`；`main.rs:415-437` | "任意写 + 任意执行"链；仓库/账号被攻破即全量用户中招 | `asset_name` 取 `file_name` + 扩展名白名单 + 落 `app_cache_dir/updates`；下载后校验 `SHA256SUMS`；安装只允许"本次下载且哈希匹配"的 token；中期接 `tauri-plugin-updater` | M |
| **BE-02** | **旧读线程复活**：`shutdown_flag` 跨连接复用，detach 后重连会 `store(false)` 让旧线程继续读 | `serial_manager.rs:216,307,441-453` | 同一设备双线程读、双份转录、端口无法释放（EBUSY） | 每连接独立 generation/token，读线程每轮校验；disconnect 真正关闭读端 fd | M |

### 3.2 P2：明显缺陷 / 体验伤害（Sprint 1–2）

| ID | 问题 | 证据 | 量 |
|---|---|---|---|
| BE-05 | `Ok(0)` 被当"无数据"→ 1ms 忙轮询且永不判死（macOS 部分驱动断线后"静默假在线"） | `serial_manager.rs:349-354` | S |
| BE-04 | Hex 发送解析 `&cleaned[i..i+2]` 多字节字符可 panic；不认 `\r`/`\t`/`0x` | `main.rs:168-179` | S |
| BE-07 | `SerialConfig.timeout` 字段完全无效（硬编码 50ms） | `types.rs:23` vs `serial_manager.rs:93` | S |
| BE-06 | Mark/Space、1.5 停止位静默降级；实际 `serialport 4.10.1` **全平台**都不支持，UI 仍可选 | `serial_manager.rs:76-87`；`ConfigPanel.tsx:168,191-192` | S |
| BE-09 | 全局单锁 + async 命令内做阻塞 open/write/文件 IO/无界 join → "界面假死" | `main.rs:121-124,185-187,191-193,218-227` | L |
| BE-10 | 事件批次可突破 `max_frames/max_bytes`（先整队 drain 再判阈值），极端单次 emit ≈256MiB JSON | `bus.rs:144-150,76-82` | S |
| P-01 / P-03 | 内存上界虚设：日志 1000×64KiB 最坏 ~250MiB；总线队列 4096×64KiB ~256MiB；每帧 3 份负载拷贝 | `serial_manager.rs:263-285,546-552`；`bus.rs` | M |
| P-04 | 录制逐帧无缓冲写盘 + 锁内 IO → 高帧率下拖慢读线程丢字节 | `serial_manager.rs:252-259,328-332,895-922` | M |
| FE-10 | 清空日志/删除命令列表/断连**无确认** | `LogViewer.tsx:530`；`QuickCommandPanel.tsx:249-256`；`PortSelector.tsx:114-120` | S |
| FE-11 | 窗口缩小后持久化尺寸不 clamp，发送区/开关被裁剪；`minWidth 840` 下 640 自动折叠分支是死代码 | `App.tsx:213-242,827-888`；`tauri.conf.json:17-18` | S-M |
| FE-12 | ⌘F 在设置弹窗打开时仍抢焦点（对话框焦点逃逸） | `LogViewer.tsx:424-439` | S |
| FE-13 | 可访问性系统性缺失：0 个 `aria-*`、Label 无 `htmlFor`、图标按钮无名称、分隔条键盘不可达、55 个嵌套 `TooltipProvider` | 全前端 | M |
| FE-14 | 对比度不足（深色三级文字 ≈3.3:1，时间戳再乘 0.6 opacity ≈2.5:1） | `ThemeContext.tsx:78-81`；`LogViewer.tsx:690` | M |
| FE-15 | 主题三轨并存（shadcn CSS 变量 / ThemeContext inline hex / Tailwind macos 调色板）+ 亮色首帧黑闪 | `styles.css:6-72`；`ThemeContext.tsx:40-98`；`index.html:9` | M |
| FE-16 | 快捷键体系不可发现：无 ⌘K/⌘,/⌘S/⌘L，无帮助面板，Win 上 ⌘F 无提示 | `LogViewer.tsx:424`、`SendPanel.tsx:131` | M |
| FE-17 | 29 处 `console.error` 失败静默；无 ErrorBoundary；连接成功无反馈 | App/LogViewer 多处 | M |
| FE-18 | 中文标签套 `uppercase tracking-wider`；字体栈无中文优先；日志正文 `break-all` 切断 hex/URL | `ConfigPanel.tsx:68` 等；`tailwind.config.js:63-66`；`LogViewer.tsx:701` | M |
| FE-19 | 逐键 clamp 导致无法输入（日志上限/帧超时/循环间隔/校验索引）；Hex 输入光标跳尾 | `SettingsModal.tsx:535`；`QuickCommandPanel.tsx:138-144`；`SendPanel.tsx:172-183` | S-M |
| FE-20 | i18n 无插值、硬编码英文 toast 8+ 处、`<html lang>` 不切换、默认 en | `App.tsx:480,517,524...`；`LanguageContext.tsx:43-65` | S |

### 3.3 P3 / 技术债 / 工程化

| 类别 | 项 | 证据 |
|---|---|---|
| 技术债 | 无 TX 队列：写失败后批量语义不成立；快捷命令靠前端 50ms 延时；校验和/行尾只在 `App.tsx` 里拼 | `App.tsx:670-682`；`serial_manager.rs:456-507` |
| 技术债 | 录制格式不足以回放（RAW 无方向/时间戳，TXT 丢二进制） | `serial_manager.rs:327-332,252-259` |
| 技术债 | 5 处重复实现（`getTextEncoding`、UTC offset、`formatHexInput`、`createEmptyCommand`、`DEFAULT_SPECIAL_CHAR_CONFIG`） | 报告 E1 |
| 技术债 | 6 条前端零调用死命令（`save/load/list_session`、`get_log_limit`、`get_frame_segmentation`、`get_display_settings`）；session 仅内存 | `main.rs:229-268,280-284,401-405` |
| 技术债 | 发布版日志不可见（`windows_subsystem` + env_logger 写 stderr）→ 无取证能力 | `main.rs:2,445` |
| 技术债 | `tokio full`、双 reqwest（0.12 + tauri 带来的 0.13）、未用的 `plugin-shell`、`scroll-area` 组件、死 CSS 120 行、无 `[profile.release]` | `Cargo.toml:18`、`package.json:16,24`、`styles.css:124-247` |
| 技术债 | 命令错误统一为 `String`，前端无法区分"端口忙/权限/设备拔出/未连接" | `main.rs` 各处 |
| 工程化 | `Cargo.lock`/`package-lock.json` 被 gitignore；CI 用 `npm install` 而非 `npm ci`、无 npm cache；Windows 无编译/测试 job；`push main` 不跑 CI；release 不复用 CI；gate 只查 ancestor | `.gitignore:4,13`；`ci.yml:5-9,19-23,57-61`；`release.yml:37-54`；`ci-release-gate.sh:40-64` |
| 工程化 | 无 eslint/prettier/vitest、无 `typecheck/lint/test` 脚本；无 rustfmt.toml/.editorconfig/.nvmrc/rust-toolchain.toml/Dependabot/SECURITY.md；`*.md` 全忽略（新文档无法入库）；LICENSE 模板占位符 | `package.json:6-10,34-44`；`.gitignore:60`；`LICENSE:190` |
| 发布 | Windows NSIS 未签名；无 Linux/Intel Mac 产物；无 SHA256SUMS；发布链路从未实跑（无 tag）；macOS Intel 更新可能错拿 arm64 dmg | `release.yml:40-51,107`；`updater.rs:130-151`；`git tag` 空 |
| 发布前置 | 远端仓库为空、无分支/tag/release，README 徽章与 Releases 链接当前 404；首次发布必须先 push `main` + 建 `develop`（或改文档） | `git ls-remote` 空；GitHub API repo size 0 |
| 安全 | `csp: null`；`export_logs(file_path)`/`set_log_directory` 任意路径写；`open_url` 允许明文 http | `tauri.conf.json:26-28`；`main.rs:217-227,288-293`；`updater.rs:483` |

### 3.4 文档漂移（需一并修）

| # | 文档声明 | 实际 | 证据 |
|---|---|---|---|
| 1 | Rust 依赖含 `rusqlite`、`uuid` | `Cargo.toml`/`Cargo.lock`/源码均无 | `README.md:275,277` |
| 2 | 关键依赖含 `@tauri-apps/plugin-shell` | 前端 0 引用、Rust 无该插件 | `README.md:282`、`package.json:24` |
| 3 | 跨 Windows/macOS/**Linux** | 发布矩阵无 Linux；安装表自己也只列 Win/macOS | `README.md:26,368` vs `release.yml:40-51` |
| 4 | 用 `cargo tauri build/dev` 构建 | 仓库无 cargo-tauri 也未声明 `@tauri-apps/cli`；`cargo run tauri dev` 语法有误 | `README.md:108,129,291,294`、`AGENTS.md:9` |
| 5 | Rust 1.70+ / Node 18+ | `tauri 2.12.5` 的 MSRV 为 **1.90**；CI Node 20、本机 Node 24、`@types/node` 25，三套版本无约束文件 | `README.md:11,14`、`cargo metadata` |
| 6 | 支持 Mark/Space 与 1.5 停止位 | 后端静默降级为 None/1；`serialport 4.10.1` **全平台**不支持 | `README.md:144-145`、`serial_manager.rs:80-86` |
| 7 | `develop` 是默认分支、已有历史 Tag（如 V1.3.1） | 仓库只有 `main`、无 tag、无 develop、远端为空 | `AGENTS.md:40,58,114`、`.github/BRANCHING.md:10` |
| 8 | 引用提交 `1da5a4f` 为示例 | `git cat-file` 报 not a valid object | `AGENTS.md:77` |
| 9 | "自动记录"日志 | 需在 LogViewer 手动勾选录制 | `README.md:70,164`、`LogViewer.tsx:268,297` |
| 10 | README/release 徽章与 Releases 链接 | 仓库 0 commit/0 release，链接当前 404 | `README.md:9,78` |
| 11 | 发版前 CI 会验证 | 实际 release 不复用 CI；直接推 main 可零 CI 打 tag | `ci.yml:5-9`、`release.yml:37-54` |
| 12 | 文档可入库 | `.gitignore` 的 `*.md` 会让新增文档（含本规划）默认不进版本库 | `.gitignore:60` |

---

## 4. 功能增强规划

### 4.1 四象限（价值 × 成本）

**A. 高价值 × 低成本（下版本做）**
1. DTR/RTS/Break 手动控制 + CTS/DSR/CD 引脚状态灯（Hercules/CoolTerm/picocom/XCOM 均有）——后端 `set_break/clear_break/write_request_to_send/write_data_terminal_ready` + 前端开关，S。
2. CRC32 / Modbus-CRC16 + 校验范围可视化（SSCOM/Modbus Poll）——前端 `checksum.ts` 扩展 + 预览高亮，S。
3. 导出 CSV/JSON + 保存对话框（Modbus Poll/Serial Studio）——后端已就绪，S。
4. 发送历史 + ↑/↓ 调取（CoolTerm/Termite/minicom）——S。
5. 断线自动重连 + 端口热插拔恢复（PlatformIO 默认）——S-M。
6. 时间戳格式可配（绝对/相对/帧间隔）（CoolTerm/minicom）——S。
7. 编码扩展 Latin-1/ASCII（PlatformIO/VOFA+）——S。
8. 普通发送区行尾选择器（CR/LF/CRLF/None）——S。
9. 发送计划统一：一次/定时（周期+次数）/循环（选中命令）——M。
10. 快速命令：单条删除/排序/复制行/导入导出 JSON——M。

**B. 高价值 × 中高成本（2–3 个版本内）**
1. 文件发送（文本/HEX、分块、延时、进度、中止）——M，依赖 TX 队列。
2. 会话配置持久化（端口+参数+快捷命令+校验+分段成方案）——S-M（后端 session 已有雏形，需落盘）。
3. 自动应答/规则触发（正则 → 回复，Termite/x-tools）——M，必须后端做。
4. XMODEM/YMODEM——M（CoolTerm 2024 才补、Serial Studio Pro 收费）。
5. 多会话/多标签多端口——L（架构级：`ManagerRegistry` + 事件带 `port_id` + 前端标签）。
6. TCP/UDP 客户端/服务端 + 串口↔网络转发——M（也是 MQTT 的前置抽象）。
7. 实时曲线（多通道/暂停/缩放/CSV+PNG 导出）——M-L。
8. Modbus RTU/ASCII 主站 + 总线监视——L（需 <1ms 级 3.5 字符静默判定，现有最小 10ms 不够）。
9. 记录回放（时间轴/暂停/逐帧；依赖录制格式 v2）——M-L。
10. 快捷键自定义 + ⌘K 命令面板——M。

**C. 低成本 × 中等价值（顺手做）**
日志行内帧分组折叠、页脚累计 TX/RX 与吞吐、快捷命令导入导出、高对比/跟随系统主题、复制行/复制 Hex、暂停接收、打印/导出当前视图、窗口大小位置记忆。

**D. 高成本/价值待验证（暂缓）**
脚本引擎（Lua/JS）、协议解析插件市场、虚拟串口驱动、3D/FFT/瀑布图、完整 MQTT/Sparkplug B、AI/MCP server、Linux/ARM 正式发布。

### 4.2 版本路线图

| 版本 | 主题 | 内容 | 验收标志 |
|---|---|---|---|
| **v1.1.0**（1–2 周） | 稳定与可信 | Sprint 1 全 P1；导出 CSV/JSON+保存框；日志上限单源；危险确认；GBK 校验；DTR/RTS/Break；CRC32/Modbus-CRC16；发送历史；行尾选择；fmt/clippy/tsc/lint/test 门禁；更新器 SHA256；CSP | 重连不丢帧、满缓冲仍自动滚动、Windows 大包可发、导出三格式、CI 全绿 |
| **v1.2.0**（4–5 周） | **视觉优化版（跨平台一致）** | §5.4 V1–V6：设计 token/主题收敛、自绘标题栏、壳层分层、控件四态精修、浮层/设置、克制的毛玻璃、a11y/对比度、三平台验收；**Mica 设置开关（Win11 可选，默认关）** | 三平台截图验收；无 Fluent/WinUI 依赖；毛玻璃可关闭；核心链路回归通过 |
| **v1.3.0**（3–4 周） | 效率与手感 | 日志工具条（暂停/方向+关键词过滤/时间戳格式/会话分隔/丢帧统计/复制行/Hex 查看）；统一发送计划；文件发送；快速命令完整度；⌘K；虚拟列表阶段 1；i18n 插值；错误处理统一 | 键盘全流程可用；1000 行按键 <50ms；840×560 无裁剪；WCAG AA 关键项 |
| **v1.4.0**（4–5 周） | 连接与协议 | 断线重连；TX 队列 + 进度事件；记录 v2 + 回放；会话配置持久化；TCP/UDP 桥；DTR 进阶（RS-485 方向）；多语言扩展 | 无人值守 24h 不掉链；抓包-回放闭环；串口服务器可连 |
| **v2.0**（6–10 周） | 平台化 | 多会话标签；Modbus RTU 主站 + 寄存器表 + 总线监视；协议帧模板/字段视图；实时绘图；记录回放；自动应答；raw PDU；XMODEM/YMODEM；CLI 原型 | 多设备并行；工业现场可用；可被脚本/外部工具驱动 |
| **v2.1**（6–8 周） | 专业/自动化 | Modbus 从站/ASCII/TCP；协议解码插件（JS 沙箱）；自动化断言/测试报告；fuzz/错误注入；告警/Historian/变换通道；可审计 MCP server + CLI/API；多窗口/操作员模式；DL/T645 模板 | 可回归的协议测试；CI 可调用；AI/Agent 可控且可审计 |
| **观察项** | 差异化/生态 | MQTT/WS/云上行、OPC UA/S7/CAN 工业栈、Linux/ARM 正式发布、插件市场、AI 助手（BYO Key）、Web 版 | 原型验证后再排期 |

### 4.3 关键功能规格（摘要）

| 功能 | 交互/UX | 后端改动 | 验收 |
|---|---|---|---|
| DTR/RTS/Break | 连接面板加 3 个开关 + 4 个状态灯（CTS/DSR/DCD/RI），tooltip 说明"进 bootloader/复位" | `SerialManager` 4 个方法 + `main.rs` 4 个命令；crate 已提供 `set_break/clear_break/write_request_to_send/write_data_terminal_ready/read_*` | 勾选后设备 DTR 电平变化；ESP32 可一键进下载模式 |
| 断线重连 | 状态栏显示"重连中(3/5)"，可关闭；重连后插"新会话"分隔线 | 后端重连状态机（指数退避 + 复用 config）+ `serial://status` 事件；先修 B2/B5 | 拔插 USB 后 5s 内自动恢复接收 |
| 文件发送 | 拖入/选择文件 → 分块大小/延时/编码 → 进度条+中止 → 结果摘要 | TX 队列 + `tx-progress` 事件；分块 `send` 命令 | 1MB 文件 115200 下完整发送，可中途取消 |
| 日志工具条 | `[Txt|Hex][时间戳▾][方向▾][过滤…][暂停][自动滚动][导出▾][清空]`；行 hover 复制 | 时间戳格式下发；导出路径/格式；暂停仅前端 | 过滤 1000 行无卡顿；暂停时数据继续入缓冲 |
| 发送计划 | 普通模式：`[一次][定时(周期,次数)][循环(选中命令)]` 共用运行态与"停止" | 后端定时器/TX 队列（长期） | 运行中改 payload 立即生效；切页不停表但显式提示 |
| Modbus 主站 | 从站地址/功能码/寄存器表/轮询周期；请求-响应配对显示；总线监视 | CRC16 + 3.5 字符静默判定 + 功能码解析 + 异常码 | 读保持寄存器成功；超时重试可见 |
| 实时绘图 | 从"数值解析规则（分隔符/起始偏移/类型）"到多通道曲线，暂停/缩放/导出 CSV/PNG | 独立低频 `serial://series` 事件 + 降采样 | 1kHz 采样 4 通道 60fps 不卡 |
| 多会话 | 顶部标签：端口/配置/连接态/未读计数；每标签独立日志/草稿/命令上下文 | `ManagerRegistry`（每端口独立实例 + 事件 `port_id`）+ 全部命令加 `port_id` | 双端口同时收发互不干扰 |

---

## 5. 界面与交互优化规划

### 5.1 设计系统收敛（并入 §5.4 视觉优化）

现状是 shadcn CSS 变量、ThemeContext inline hex、Tailwind `macos-*` 三轨并存；`styles.css:124-247` 约 120 行死类；硬编码颜色绕过主题（`SendPanel.tsx:634` `#f59e0b`、`SettingsModal.tsx:775` `text-green-500`）；`index.html:9` 写死黑底。

**目标**：保留 **shadcn/Radix + Tailwind**，以 CSS design token 作为唯一视觉来源（详见 §5.4）——语义色/字体/间距/圆角/阴影/动效；删除 ThemeContext 内联 hex 与死 CSS；`html { color-scheme }` 防 FOUC；三级文字对比度 ≥4.5:1；字体按平台回退（Windows `Segoe UI Variable`、macOS `SF Pro`、Linux `Noto Sans`、中文 `PingFang SC`/`Microsoft YaHei`/`Noto Sans SC`）；补齐高对比度与 `prefers-reduced-motion`。**不替换组件库**。

### 5.2 目标信息架构

```
全局工具条（新）：[Uartis] [会话标签 +][端口▾ 115200 8N1 预设▾][连接/断开][●录制][⌘K][⚙][🌓]
左工作栏 240（可折叠）：端口与参数 / 8N1 预设 chips / 快捷命令库(分组+搜索+新建+导入导出) / 发送历史
日志工作区：工具条(格式·时间戳·方向·过滤·暂停·自动滚动·丢帧badge·导出·清空) + 会话分隔行 + role=log
发送区（可拖高）：[普通|快捷] [行尾][校验和▾范围][发送计划] / 编辑器(拖入文件/粘贴识别) [历史↑][重复上次][发送⌘↵]
状态栏：已连接 /dev/... · 115200 8N1 · 时长 · TX/RX 累计 · 缓冲 1.0k/10k · 丢帧 0 · v1.1.0
浮层：⌘K 命令面板 / 设置(左分类+搜索+恢复默认+快捷键) / 危险操作确认 / Toast(节流+action)
```

视觉与壳层按 **§5.4 UI 视觉优化**：顶部 Toolbar、设置分类页、**自绘标题栏（跨平台混合方案，详见 §5.5）**、克制的毛玻璃、Win11 可选 Mica；日志区仍用原生滚动容器与实底背景。

### 5.3 改造优先级

| 优先级 | 改造 | 验收 |
|---|---|---|
| P0 | **UI 视觉优化（§5.4 V1–V6，v1.2 主线）**：token/主题 → 壳层/标题栏 → 控件四态 → 浮层/设置 → 克制的毛玻璃；不换组件库 + Mica 可选 | 三平台截图验收；无 Fluent/WinUI 依赖；毛玻璃可关闭；性能不劣化 |
| P1 | 危险操作确认（清空/删列表/断连，正在录制或定时发送时文案说明后果） | 三处弹窗；键盘可取消 |
| P1 | 导出升级：菜单 + `save()` + TXT/CSV/JSON + toast action | 三格式文件内容正确 |
| P1 | 日志自动滚动修复 + 页脚丢帧/TX-RX 累计（后端已有统计未展示） | 满缓冲仍跟随；页脚数字实时 |
| P2 | 日志工具条（暂停/方向/关键词过滤/时间戳格式/会话分隔） | 1000 行过滤无卡顿 |
| P2 | 发送区统一：行尾、发送计划、历史 ↑、粘贴识别 hex、字节编辑器入口 | 日常发送 3 步内完成 |
| P2 | 设置重构：分类 + 搜索 + 恢复默认 + 快捷键页 + 关于（随视觉优化重写） | 设置项 3 次点击内到达 |
| P2 | ⌘K 命令面板 + 快捷键注册表（按浮层层级路由，修 ⌘F 逃逸） | 全键盘可完成连接/发送/导出/清空 |
| P2 | a11y：icon 按钮 `aria-label`、Field/Label 关联、分隔条键盘、日志 `role=log tabIndex=0`（沿用 shadcn/Radix 基础 a11y） | 仅键盘可完成全流程 |
| P2 | 响应式：日志工具条折行、快捷命令列折叠、StatusBar 截断、删除 640 死分支或下调 minWidth | 840×560 全部控件可见可点 |
| P2 | 虚拟列表阶段 1：`React.memo` + 日志行 memo + `content-visibility:auto`（保持 1000 行） | 按键/搜索不掉帧 |
| P3 | 虚拟列表阶段 2：`@tanstack/react-virtual`（不用 react-window，正文换行会变高） | 10k 行 60fps |
| P3 | 窗口大小/位置记忆（`tauri-plugin-window-state`）、跟随系统主题 | 重启恢复 |

### 5.4 UI 视觉优化与毛玻璃（v1.2，替代原 Fluent 迁移）

**决策变更（2026-11）**：不再引入 Fluent UI React v9、不重写 WinUI；保留 React 18 + shadcn/Radix + Tailwind，通过设计 token、组件精修、自绘标题栏和**克制的毛玻璃**提升观感。完整方案、token 规格、玻璃使用范围、V1–V6 任务与 DoD 见 [`UI-VISUAL-PLAN.zh-CN.md`](UI-VISUAL-PLAN.zh-CN.md)。

**原则**
1. **保留现有组件库**：shadcn/Radix 继续作为业务组件层；不换库、不引入 Griffel/Fluent 依赖。
2. **token 化**：颜色/字体/间距/圆角/阴影/动效统一到 CSS 变量；清理 ThemeContext 内联 hex 与死 CSS；亮/暗/system + 高对比。
3. **毛玻璃只用于壳层/浮层**：标题栏、侧栏、工具条、状态栏、对话框、Toast、设置外壳；**日志正文/发送编辑区保持实底**。
4. **无 `backdrop-filter` 自动回退纯色**；提供“减少透明/纯色模式”设置；Windows 11 Mica 仍可作为可选增强（默认关）。
5. **性能优先**：glass 表面不超过 4 个可见层，blur ≤20px，禁止嵌套/滚动容器大面积模糊；1000 行滚动与窗口拖动实测。
6. **可访问性**：正文对比度 ≥4.5:1，焦点环可见，键盘可完成全流程，尊重 `prefers-reduced-motion`。

**玻璃范围**

| 区域 | 是否 glass |
|---|---|
| 标题栏 / 侧栏 / 顶部工具条 / 状态栏 | ✅（固定壳层） |
| 对话框 / Popover / Toast / 设置外壳 | ✅（内容实底） |
| 日志正文 / 发送编辑区 / 列表行 | ❌（保持实底、可读、可选中） |

**任务**

| ID | 内容 | 工期 |
|---|---|---|
| V1 | Token/主题基础，清理硬编码与死 CSS，亮暗/system | 2–3d |
| V2 | 壳层：标题栏（与 T1/T2 合并）、侧栏、工具条、状态栏分层 + glass token | 3–4d |
| V3 | 控件四态/焦点精修（按钮/输入/下拉/开关/复选/对话框/Toast） | 3–4d |
| V4 | 浮层与设置：glass 对话框/Popover/设置分类/材质开关 | 2–3d |
| V5 | 毛玻璃调优：范围/强度/回退、FPS/WebKitGTK 冒烟 | 2–3d |
| V6 | 三平台截图、亮暗/高对比、a11y、文档 | 2–3d |

**总工期**：单人约 2–3 周，与标题栏 T2 并行可压缩。**不做**：Fluent/WinUI 迁移、全屏毛玻璃、日志区模糊、组件库替换。

### 5.5 自绘标题栏与窗口壳层（跨平台，v1.2）

**决策**：取代原“三平台保留原生标题栏”的决策。采用 **自绘内容 + 平台原生控件** 的混合方案，默认自绘，设置提供“系统标题栏（兼容模式）”回退。完整设计、平台矩阵、任务 T1–T7、风险与 DoD 见 [`TITLEBAR-PLAN.zh-CN.md`](TITLEBAR-PLAN.zh-CN.md)。

| 平台 | 外壳 | 窗口控件 | 关键风险 |
|---|---|---|---|
| Windows 10/11 | `decorations: false` + 自绘栏 | 自绘最小化/最大化/关闭（右） | Snap Layouts 可能丢失；DPI/多屏 |
| macOS 13+ | `titleBarStyle: Overlay` + `hiddenTitle` | **原生红绿灯**（不画假按钮） | 红绿灯安全区/全屏 |
| Linux X11/Wayland | `decorations: false` + 自绘栏 | 自绘按钮（右） | Wayland 拖拽/缩放、平铺 WM |

**任务**：T1 三平台 spike（2–3d）→ T2 核心组件（3–4d）→ T3/T4/T5 三平台适配并行（各 2–3d）→ T6 兼容模式/窗口状态（1–2d）→ T7 验收文档（2–3d）。与 UI 视觉优化 V1/V2 同批，先做壳层；单人 3–4 周，双人约 2 周。

**关键约束**：只让标题栏空白区可拖，交互元素显式 no-drag；双击空白区最大化；最大化图标跟随状态；高对比/键盘/屏幕阅读器可用；Mica 开启时标题栏实底兜底；840×560 最小尺寸复验。

---

## 6. 执行计划

### 6.1 阶段与工期（单人数估算）

| 阶段 | 内容 | 工期 | 依赖 | 交付 |
|---|---|---|---|---|
| **Sprint 0** | 工程门禁：提交 `Cargo.lock` + `package-lock.json`（CI 改 `npm ci` + npm cache）；CI 加 `windows-latest` 的 `cargo check/test`、`ubuntu-latest` 的 `cargo check`（按 Tauri 文档装 Linux 依赖）、`cargo fmt --check`、`clippy -D warnings`、`push main` 触发、PR 级"四版本一致"job；release 复用同一套检查并消费 `should_build`；gate 要求 tag == `origin/main` HEAD（或 CI 绿灯 + semver 递增）；加 eslint/prettier/vitest 与 `typecheck/lint/test` 脚本；`tauri-plugin-log` 落文件；CSP 收紧但预留 `style-src 'unsafe-inline'`（现有 React inline style 需要）；Release 附 `SHA256SUMS`；修 README/AGENTS/LICENSE 漂移；`.gitignore` 文档例外；删死命令/死依赖/死 CSS；`[profile.release]` 调优 | 1.5–2 天 | 无 | CI 全绿（Win/macOS/Linux 编译）、可取证、文档与代码一致 |
| **Sprint 1 → v1.1** | 3.1 的 12 个 P1 + P2 中 BE-05/BE-04/BE-07/BE-06/BE-10/FE-10/FE-11/FE-12 + 跨会话/格式化/导出回归测试 + vitest 覆盖 `useSerialLogs`/`checksum`/`timezone` | 5–7 天 | Sprint 0 | 稳定版可发布 |
| **Sprint 2 → v1.2** | **UI 视觉优化（§5.4 V1–V6）**：设计 token/主题收敛 → 自绘标题栏/壳层分层 → 控件四态精修 → 浮层/设置 → 克制的毛玻璃；保留 shadcn/Radix；跨平台（Win/macOS/Linux）验收；**Mica 可选开关（Win11）**；a11y/对比度 | 4–5 周 | Sprint 1 | 视觉优化版 |
| **Sprint 3 → v1.3** | 日志工具条、发送计划、文件发送、快速命令完整度、⌘K 命令面板、虚拟列表阶段 1、i18n 完善、错误处理统一（基于统一设计 token 与现有 shadcn 组件） | 3–4 周 | Sprint 2（组件体系就绪） | 效率版 |
| **Sprint 4 → v1.4** | 断线重连、TX 队列、DTR 进阶、记录 v2 + 回放、会话持久化、TCP/UDP 桥 | 4–5 周 | Sprint 3（后端 TX 队列可早于 UI 并行） | 连接版 |
| **Sprint 5 → v2.0** | 多会话架构、Modbus RTU 主站 + 寄存器表 + 总线监视、协议帧模板/字段视图、实时绘图、记录回放、自动应答、raw PDU、XMODEM/YMODEM、CLI 原型 | 6–10 周 | Sprint 4 | 平台版 |
| **Sprint 6 → v2.1** | Modbus 从站/ASCII/TCP、协议解码插件（JS 沙箱）、断言/测试报告、fuzz/错误注入、告警/Historian/变换通道、可审计 MCP server + CLI/API、多窗口/操作员模式、DL/T645 | 6–8 周 | Sprint 5 | 专业/自动化版 |

**关键依赖链**：UI 视觉优化（Sprint 2）→ 之后所有新 UI 功能（Sprint 3+）；TX 队列 → 文件发送/定时发送后端化 → Modbus/绘图数据流；generation 化 → 断线重连/多会话；录制 v2 → 回放/脚本；设计 token/玻璃材质 → Mica 与所有新面板。

**发布前置（必须最先处理）**：远端仓库当前为空、无 tag、无 develop、发布链路从未跑过。v1.1 前需完成一次"发布演练"——push `main`、按 BRANCHING.md 建 `develop`（或把文档改成单干 main 的简化模型）、打一个 `V1.1.0-rc.1` 预演双平台构建、验证签名/公证/DMG/NSIS 与更新器下载链路，再正式发版。否则第一个正式 Tag 大概率在 CI 里失败。

**依赖升级策略**：v1.1 不动大版本（React 19 / Vite 8 / Tailwind 4 均为破坏性升级：Tailwind 4 需重写 config/postcss、Vite 8 要求 Node 20+ 且插件升级、React 19 改动类型与 `useEffect` 语义）。先做 patch/minor（lucide、@types/node、plugin-react、dirs 7），把大版本升级作为独立专项在 v1.2 后评估；升级与功能/bugfix 分开提交，避免 review 与回滚困难。

### 6.2 测试策略

| 层 | 现状 | 补齐 |
|---|---|---|
| Rust 单测 | 49 个（framing/bus/port 清洗/updater） | `format_bytes_as_hex/text`、`export_logs` 三格式、日志上限/裁剪、`clear_logs`+epoch、跨会话快照回归、hex 解析纯函数、写超时计算纯函数 |
| Rust 集成 | 无 | 脚本化 `ScriptedPort` 驱动"断开→重连→旧线程不复活"、"写半包记日志" |
| 前端单测 | 无 | vitest：`checksum`、`timezone`、`encoding`、`useSerialLogs` 去重（A2 回归）、`SendPanel` 定时器状态 |
| 组件/E2E | 无 | 可选 Playwright + Tauri driver（或先 `vite preview` + mock invoke）覆盖连接→发送→导出主链路 |
| 视觉回归 | 无 | Win11 light/dark/高对比三套截图基线；关键组件画廊页（Button/Input/Dropdown/Dialog/MessageBar）截图对比；Mica 开/关各一组 |
| CI 门禁 | macOS `cargo test` + Ubuntu `tsc/build` | 见下方"建议 CI 门禁清单"；核心是补 Windows 编译、fmt/clippy、前端 lint/test、锁文件与发版前置检查 |

**建议 CI 门禁清单**：`version-consistency`（四文件 + tag 匹配，PR 与 tag 都跑）→ `rust-fmt` → `rust-clippy -D warnings` → `rust-test`（macos + windows 矩阵）→ `linux-check`（ubuntu：按 Tauri 文档装 webkit2gtk/udev 等依赖后 `cargo check` + `vite build`，保证 Linux 可编译）→ `frontend`（`npm ci` → `tsc --noEmit` → `eslint` → `prettier --check` → `vitest run` → `vite build`；`npm audit --omit=dev --audit-level=high`）→ `shellcheck` + gate 三条件单测 → `release`（gate 输出 `should_build` 由 build `if:` 消费、build 前跑 test、附 SHA256SUMS + artifact 备份、`environment: release` 审批）。视觉优化后额外加 `csp-smoke` 与 `glass-smoke`（生产包样式加载、控制台无 CSP 报错、无 backdrop-filter 时回退纯色）。

### 6.3 手测矩阵（Windows/macOS 手测 + Linux 冒烟 × 关键路径）

1. 115200 连续收 >1000 帧：自动滚动、丢帧行、页脚计数、暂停/恢复。
2. 连接→收 500 帧→断开→立即重连：新帧不丢、旧帧不混排、会话分隔正确。
3. GBK 中文 + CRC16 发送：设备端校验通过、预览一致。
4. 最大日志 5000：显示/导出/设置三者一致。
5. 115200 发 64KiB 包（Windows）：成功且日志完整；拔线重连不 EBUSY。
6. 定时发送运行中改 payload/切页/断连：立即停或按新内容发。
7. 导出 TXT/CSV/JSON：路径可选、内容含中文/引号/换行/二进制。
8. 840×560 窗口：全部控件可见可操作；键盘 Tab 走完全流程；⌘F 在设置弹窗内不逃逸。
9. 亮色启动无黑闪；对比度抽查；macOS 只列 `cu.*`。
10. 更新检查/下载：篡改 `asset_name`/URL 被拒绝；断网有可读错误。
11. UI 视觉：Win11 上 light/dark/高对比三套截图；控件 normal/hover/pressed/disabled 四态；焦点环可见；`prefers-reduced-motion` 生效；毛玻璃范围克制（日志区实底）。
12. Win11 Mica 开/关：拖动、缩放、双击最大化、右键系统菜单、Snap Layouts、多显示器/DPI、远程桌面/截图；关闭后完全恢复纯色。
13. Mica 可用性检测：Win10/Win11/macOS/Linux 上设置项显示/隐藏正确；透明窗口回退纯色后可读（自绘标题栏下也必须有实底兜底）。
14. macOS/Linux：无 Mica 时纯色回退、原生红绿灯/窗口按钮正常、字体回退正常。

### 6.4 风险与规避

| 风险 | 影响 | 规避 |
|---|---|---|
| 多线程写路径重构（TX 队列）引入回归 | 串口收发核心不稳 | 抽纯函数 + `ScriptedPort` 测试；先分块/超时最小版，再上队列；保留回滚开关 |
| 多会话架构重写命令层 | 大范围改动 | 先做"单会话 + session 持久化"，多会话放 v2；每端口实例化前先补命令层测试 |
| CSP 收紧导致 Tauri/资源加载失败 | 白屏 | dev 单独配置、CI 冒烟；按 Tauri 2 官方 CSP 模板逐项放开 |
| Windows 签名/公证成本 | 更新信任链 | 先 SHA256SUMS + 更新器校验；代码签名作为发布流程独立任务 |
| 虚拟列表破坏"跨行选中复制" | 用户体验回退 | 数据层提供"复制全部/复制选中范围"；阶段 1 先不虚拟化 |
| 视觉改造引发功能/样式回归 | 核心链路回退、跨平台差异 | §5.4 分 V1–V6 六批合并；每批回归核心链路 + 三平台截图；保留一个可回滚 tag |
| 毛玻璃/透明层在 WebKitGTK 不支持 | 透明层发灰/不可读 | `@supports` + 实底回退；CI/实机冒烟；设置可关闭透明 |
| Linux WebKitGTK 渲染差异 | Linux 布局/滚动异常 | CI `ubuntu-latest` 编译 + 冒烟；关键布局用设计 token；不依赖浏览器专有特性 |
| Mica/透明窗口与系统行为冲突 | 截图/录屏/远程桌面异常、性能下降 | 默认关闭、仅 Win11 显示、设置可关；保留纯色回退；自绘标题栏保留“系统标题栏”兼容模式 |
| 视觉改造导致渲染变慢 | 体验下降 | 毛玻璃只用于固定壳层；记录 gzip/滚动基线；不做全屏 blur |
| 文档 `*.md` 被 gitignore | 规划/文档无法入库 | 加 `!docs/**/*.md` 例外并清理规则 |

### 6.5 明确不做（本轮）

- 不做虚拟串口驱动（Windows 需签名驱动/macOS 需系统扩展，长期负担）。
- 不先做完整 MQTT/Sparkplug B、3D/FFT/瀑布图、协议插件市场。
- 不先做脚本引擎（等 CLI/API 抽象稳定）。
- 不在 v1.1 动多会话架构，也不在 v1.1 做 UI 视觉改造（v1.1 只做稳定性；视觉优化从 v1.2 开始）。
- 不引入 WinUI 3/XAML、Windows App SDK 或 Fluent UI React（Tauri 架构下代价过高；只做现有组件 + 设计 token + 可选 Win11 Mica）。
- 不做三平台完全自绘（包括 macOS 假红绿灯）；采用“自绘内容 + 平台原生控件”混合方案，并保留系统标题栏兼容模式（详见 §5.5）。
- 不默认开启 Mica（仅 Win11 且检测可用时在设置中出现，默认关闭，保证截图/远程桌面可回退）。
- 不牺牲 macOS/Linux：所有 UI 改动必须三平台构建/冒烟验收；不为 Windows 观感引入 Windows-only 行为。
- 不在 v1.2 同时改 UI 体系与大量业务功能（v1.2 只做迁移 + 必要修复；日志工具条/发送计划等放 v1.3）。
- 不在 v1.x 做内核驱动类能力（虚拟串口对、USB 抓包、非侵入端口监视）——签名/杀软/系统更新成本与开源发布模型冲突；用进程内虚拟对端（J01）+ RFC2217/TCP 替代。
- 不在 v1.x 内置完整工业协议栈（OPC UA/S7/EtherNet-IP/IEC104/CAN）——用协议模板 + 外部工具承接；Modbus 只做 RTU 主站最小闭环。
- MCP/AI 接口默认关闭、只读优先、分级 consent + 审计；不在 CLI/API 抽象稳定前上线。
- 不做遥测/账户/云同步（隐私与后端成本），配置共享用导入导出文件。
- 不改 AGENTS.md 约束下的既有约定（日志区不用 `ScrollArea`、四版本文件同步、发版三条件门禁）；组件规范继续“优先 shadcn `ui/`”，不引入第二套组件库。

---

## 7. 附录

### 7.1 审计报告索引

| 报告 | 内容 |
|---|---|
| `../.tmp/plan/01-backend-audit.md` | 593 行：架构/线程/锁/35 命令×2 事件对照、22 条缺陷、平台限制、18 项功能缺口、安全、20 项改造清单 |
| `../.tmp/plan/02-frontend-audit.md` | 779 行：状态/事件流、性能、UI/UX 16 类缺陷、功能缺口、目标布局、28 项改造清单、手测清单 |
| `../.tmp/plan/03-competitor-research.md` | 311 行：R1 26 工具 × 26 列矩阵、25 项功能分析、8 条趋势、22+ 建议四象限、来源链接 |
| `../.tmp/plan/04-engineering-audit.md` | 工程门禁/依赖/版本/测试/发布/文档漂移 |
| `../.tmp/plan/05-market-windows.md` | R2 Windows：28 工具、18×107 矩阵、X-01…X-20、Top-20、商业/国产差异化 |
| `../.tmp/plan/05-market-unix.md` | R2 macOS/Linux/CLI：24 工具、83 项 × 24 矩阵、工程链专题、Top-20 |
| `../.tmp/plan/05-market-protocol-test.md` | R2 协议/工业/测试：27 工具、111 项 ID、44 列矩阵、Modbus MVP、不做清单 |
| `../.tmp/plan/05-market-oss.md` | R2 开源/现代：28 项目、47 项 ID × 16 矩阵、Pro 边界、MCP/AI、Top-10 |
| `FEATURE-CATALOG.zh-CN.md` | **R1+R2 合并功能全集：279 项 / 28 条战略结论 / 30 项优先 / 不做清单** |

### 7.2 关键证据速查

- 重连丢帧：`useSerialLogs.ts:87,105-108,124-141`；`serial_manager.rs:191-213,565-570`
- 自动滚动：`LogViewer.tsx:51,189-198`；`useSerialLogs.ts:48,62-71`
- 定时发送：`SendPanel.tsx:89,220-235,249-254`；`QuickCommandPanel.tsx:146-163`
- 日志上限：`SettingsModal.tsx:170,529-537`；`serial_manager.rs:664-675`；`useSerialLogs.ts:48`；`en.json:140`
- 导出：`App.tsx:575-606`；`serial_manager.rs:631,645`
- Windows 写：`serial_manager.rs:93,231-238,462,470`
- 读线程复活：`serial_manager.rs:216,307,441-453`
- 更新器：`updater.rs:234-238,313-327`；`main.rs:415-437`
- 全树重渲：`App.tsx:145,425,443-457`；`LogViewer.tsx:46,664-709`
- 搜索 O(n²)：`LogViewer.tsx:452-498`
- 主题/对比度：`ThemeContext.tsx:40-98`；`styles.css:6-72,124-247`；`index.html:9`

### 7.3 竞品来源（节选）

- Serial Studio：<https://github.com/Serial-Studio/Serial-Studio> ｜ <https://github.com/Serial-Studio/Serial-Studio/releases>
- CoolTerm：<https://freeware.the-meiers.org/> ｜ <https://freeware.the-meiers.org/CoolTerm_ReadMe.txt.html>
- SSCOM：<http://www.daxia.com/sscom/> ｜ XCOM v3.0：<https://www.openedv.com/docs/tool/ruanjian/ATK-XCOM.html>
- Hercules：<https://www.hw-group.com/software/hercules-setup-utility> ｜ RealTerm：<https://sourceforge.net/projects/realterm/>
- QModMaster：<https://sourceforge.net/projects/qmodmaster/> ｜ Modbus Poll：<https://www.modbustools.com/modbus_poll.html>
- x-tools：<https://github.com/x-tools-author/x-tools> ｜ SerialPlot：<https://github.com/hyOzd/serialplot> ｜ VOFA+：<https://www.vofa.plus/>
- PlatformIO monitor：<https://docs.platformio.org/en/latest/core/userguide/device/cmd_monitor.html>
- MCP/AI 串口：<https://github.com/es617/serial-mcp-server>、<https://github.com/qarnet/serial-mcp>、<https://github.com/YaoIsAI/SerialRUN>

### 7.4 视觉与材质参考（仅参考，不引入 Fluent/WinUI）

- Fluent 2 设计规范（token/字体/圆角/动效，仅视觉参考）：<https://fluent2.microsoft.design/>
- Windows 11 设计（WinUI 3 Gallery、控件与材质，仅参考）：<https://learn.microsoft.com/windows/apps/design/>
- Tauri 2 窗口效果（`Effect::Mica/MicaDark/MicaLight`、`WindowEffectsConfig`，2.12.5 内置）：<https://docs.rs/tauri/latest/tauri/window/enum.Effect.html> ｜ <https://docs.rs/tauri-utils/latest/tauri_utils/config/struct.WindowEffectsConfig.html>
- Tauri 2 窗口自定义（原生/透明标题栏、拖拽区域、权限）：<https://v2.tauri.app/learn/window-customization/>
- `window-vibrancy`（Tauri 内部依赖；旧版本或需要更细控制时的回退方案）：<https://github.com/tauri-apps/window-vibrancy>
- CSS `backdrop-filter`（毛玻璃实现与兼容性）：<https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter>

### 7.5 功能全集与 R2 调研来源

- 功能全集（279 项，含现状/价值/难度/版本/不做理由）：[`FEATURE-CATALOG.zh-CN.md`](FEATURE-CATALOG.zh-CN.md)
- R2 报告：`.tmp/plan/05-market-windows.md`、`05-market-unix.md`、`05-market-protocol-test.md`、`05-market-oss.md`
- 关键来源：Serial Studio Pro-vs-Free <https://github.com/Serial-Studio/Serial-Studio/blob/master/doc/help/Pro-vs-Free.md> ｜ SerialRUN <https://github.com/YaoIsAI/SerialRUN> ｜ serial-mcp-server <https://github.com/Adancurusul/serial-mcp-server> ｜ QSerial <https://github.com/qiuchengcai/QSerial> ｜ FluentSerialAssistant <https://github.com/txp666/FluentSerialAssistant> ｜ tio man page <https://manpages.debian.org/trixie/tio/tio.1.en.html> ｜ RFC 2217 <https://datatracker.ietf.org/doc/html/rfc2217> ｜ Docklight 手册 <https://docklight.de/manual/docklightoverview.html> ｜ HHD DMS <https://hhdsoftware.com/device-monitoring-studio> ｜ 友善 SPU <https://alithon.com/features>

---

*本规划仅为方案，未改动任何源码/配置/依赖。已确认方向：先稳定（v1.1）→ UI 视觉优化（v1.2，设计 token + 毛玻璃 + 自绘标题栏 + Mica 可选，不引入 Fluent/WinUI）→ 效率（v1.3）→ 连接/协议（v1.4）→ 平台化（v2.0）。落地前仍需确认：品牌色（`#0A84FF` vs `#0F6CBD`）与毛玻璃强度/默认开关。*
