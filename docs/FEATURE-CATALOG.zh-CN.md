# Uartis 功能全集（市场调研 R1 + R2 合并）

> **目标**：把串口调试/测试/分析类工具的功能"尽量挖全"，给 Uartis 一份可逐项决策的功能清单（已具备 / 缺失 / 建议版本 / 不做理由）。
> **方法**：R1 覆盖 26 个通用工具；R2 追加 4 路调研（Windows 商业/国产、macOS/Linux/CLI、开源/现代、协议/工业/测试诊断），实际抓取 110+ 页面（报告见 `.tmp/plan/05-market-*.md` 与 `03-competitor-research.md`）。抓不到的证据一律标「待核实」，不编造。
> **覆盖**：11 个大类、**约 279 项功能**；其中 Uartis 现状已具备约 30 项、部分支持约 12 项、缺失 230+ 项。缺失项按价值/成本/差异化排入版本或明确"不做"。
> **版本口径**：v1.1 稳定 → v1.2 Fluent UI 迁移 → v1.3 效率 → v1.4 连接/协议基础 → v2.0 平台化 → **v2.1 专业/自动化** → 观察/不做。R2 报告建议的部分版本（如 Modbus v1.2）因 v1.2 已排 UI 迁移而顺延，本文件已按当前规划重排。
> **记号**：`✅` 已具备 · `△` 部分支持 · `❌` 缺失；价值 `★★★/★★/★`；难度 `低/中/高`；计划 `v1.1…v2.1 / 观察 / 不做`。

---

## 0. 覆盖统计与使用方式

| 大类 | 功能数 | ✅ | △ | ❌ | 说明 |
|---|---:|---:|---:|---:|---|
| A 连接与链路 | 27 | 6 | 4 | 17 | 端口/参数之外，锁、只读、重连、网络串口是缺口 |
| B 数据构造与发送 | 32 | 7 | 3 | 22 | 定时/循环/快捷命令已有；文件、XMODEM/YMODEM、raw PDU、脚本缺 |
| C 接收与显示 | 32 | 10 | 3 | 19 | 日志基础好；过滤/暂停/多编码/字符映射/帧视图缺 |
| D 记录/导出/回放 | 21 | 5 | 2 | 14 | 记录已有；轮转/CSV/回放/结构化格式缺 |
| E 协议与解析 | 30 | 0 | 0 | 30 | 全缺，最大差异化空间（Modbus/自定义帧/解码器） |
| F 可视化与分析 | 18 | 0 | 0 | 18 | 全缺；波形/FFT/仪表盘/时序统计 |
| G 自动化/脚本/测试 | 29 | 0 | 0 | 29 | 全缺；脚本/断言/CI/录制回放/报表/MCP |
| H 会话/工作区/UX | 25 | 5 | 4 | 16 | 单会话、无工程文件、无 ⌘K/自定义快捷键 |
| I 网络/集成/平台 | 25 | 0 | 0 | 25 | TCP/UDP/WS/MQTT/RFC2217/CLI/API/MCP 全缺 |
| J 诊断/设备/模拟 | 20 | 2 | 2 | 16 | 免驱虚拟对端、错误注入、设备扫描缺 |
| K 工程/发布/安全 | 20 | 5 | 2 | 13 | 自动更新有；签名/校验/诊断日志/测试门禁缺 |
| **合计** | **~279** | **30** | **12** | **237** | 这是"功能全集"，不代表都要做 |

**使用方式**：① 按"计划"列直接生成版本 backlog；② "不做"列已给理由，避免反复讨论；③ 标 `★` 且 `低` 的是"廉价高感"候选；④ 标 `★★★` 且 `中` 的是差异化主战场。

### 0.1 六条战略结论（R2 合并）

1. **"协议 + 记录/回放"是行业公认付费点**：Serial Studio 4.2.1 把 Modbus/OPC UA/S7/EtherNet-IP/IEC104/CAN/MQTT/Historian/MDF4/多设备/工作区全部锁进 Pro（免费层仅 UART/TCP/UDP/BLE + CSV）；x-tools 免费但缺绘图/回放；Uartis 若"免费给全"（Modbus + 自定义解析 + 绘图 + 回放 + 结构化导出）即形成清晰差异化。
2. **开源生态没有"协议 + 分析 + 回放"三块同时全绿的工具**（Serial Studio 靠 Pro、x-tools 缺 F/D、SerialRUN 缺变换/Historian）——这是最明确的产品空位。
3. **A/C 类（连接/显示）已是红海**：16 个开源工具里端口枚举/参数/HEX/时间戳几乎全绿，做到"不比别人差"即可，投入应转向 E/F/D。
4. **2026 新品类 = 串口 + MCP/AI**：SerialRUN（23 工具）、QSerial（47 工具）、serial-mcp-server（JSON 宏 DSL send/delay/expect/assembly + 无硬件模拟）、pty-mcp、Serial Studio `ui.automation.*` + 分级 consent 均已出现；但**普遍缺"分级 consent + 调用审计 + 只读模式"的治理**——这是 Uartis 可占的差异位。
5. **"轻"是可得优势**：Tauri + Rust（对比 Serial Studio msi≈200MB/AppImage≈295MB、Electron 系 150MB+）可主打秒开、小体积、低内存。
6. **中文工程生态是护城河**：GBK/GB18030 全链路、中文协议模板/寄存器名/错误信息/文档、国产开发板预设；竞品只有零散支持（FluentSerialAssistant/Wu.CommTool 年轻，SSCOM 长期未更新、XCOM 官方信息不透明）。

---

## A. 连接与链路（27）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| A01 | 端口枚举 + VID/PID/厂商/序列号 | 几乎所有工具；HHD 更细 | ✅ | ★★★ | 低 | — |
| A02 | 端口热插拔自动刷新 | 友善/YAT/Hercules | ✅（3s 轮询） | ★★★ | 低 | — |
| A03 | 端口友好名/别名/固定映射（by-id） | HHD、tio、YAT | ❌ | ★★ | 低 | v1.3 |
| A04 | 手动输入端口路径/自定义设备 | picocom/tio/gtkterm | ❌ | ★★ | 低 | v1.3 |
| A05 | 非标准/自定义波特率 | 多数工具 | ✅ | ★★★ | 低 | — |
| A06 | 完整帧格式（数据位/校验/停止位） | 全部 | △（Mark/Space/1.5 静默降级） | ★★ | 低 | v1.1 明确提示 |
| A07 | 流控 RTS/CTS、XON/XOFF | 全部 | ✅ | ★★★ | 低 | — |
| A08 | DTR 手动控制/初值 | Hercules、CoolTerm、XCOM、picocom | ❌ | ★★★ | 低 | v1.1 |
| A09 | RTS 手动控制/初值 | 同上 + 友善/ComDebug | ❌ | ★★★ | 低 | v1.1 |
| A10 | Break 发送（可配时长） | CoolTerm、picocom、tio、YAT | ❌ | ★★★ | 低 | v1.1 |
| A11 | 引脚状态 CTS/DSR/RI/CD 显示 | Hercules、ComDebug、AccessPort | ❌ | ★★ | 低 | v1.1 |
| A12 | DTR/RTS 脉冲编排（ESP32/Arduino 复位/进 Bootloader） | tio `--line-pulse-duration`、esptool | ❌ | ★★★ | 低-中 | v1.2 |
| A13 | 打开模式：只读/不改设置/no-init | tio/picocom/gtkterm | ❌ | ★★ | 低 | v1.3 |
| A14 | 端口锁/独占（UUCP/flock） | picocom、minicom、socat | ❌ | ★★ | 低 | v1.3 |
| A15 | 断线检测/连接丢失提示 | Uartis 已有（1s 轮询） | ✅ | ★★★ | 低 | — |
| A16 | 自动重连（策略化 new/latest/by-id、退避） | tio、PlatformIO、esptool | ❌ | ★★★ | 中 | v1.4 |
| A17 | 端口占用检测/错误归一（忙/权限/拔出） | 现代工具普遍有提示 | ❌ | ★★★ | 低 | v1.1 |
| A18 | 多端口/多会话并发 | 友善 16 路、CoolTerm、YAT、SecureCRT | ❌ | ★★★ | 高 | v2.0 |
| A19 | 进程内虚拟对端/回环（免驱） | pySerial `loop://`、CoolTerm NULL | ❌ | ★★ | 低-中 | v1.4 |
| A20 | 内核虚拟串口对（com0com 类） | com0com、VSPD | ❌ | ★★ | 高 | 不做（驱动/签名） |
| A21 | 串口嗅探（旁观其他进程，驱动级） | Eltima、HHD、RealTerm monitor | ❌ | ★★ | 高 | 不做（驱动/签名） |
| A22 | TCP/UDP 串口桥（client/server） | 友善、Hercules、YAT、Docklight | ❌ | ★★★ | 中 | v1.4 |
| A23 | RFC2217 客户端/服务端（含控制线/链路错误位） | ser2net、com0com hub4com、pySerial | ❌ | ★★ | 中 | v1.4 |
| A24 | Telnet/SSH 串口会话 | CoolTerm、Serial 2、SecureCRT、ZOC | ❌ | ★★ | 中 | 观察 |
| A25 | BLE/蓝牙 SPP 链路 | x-tools、LinkAll、友善 | ❌ | ★ | 高 | 观察 |
| A26 | USB HID/CDC 特化 | YAT、RealTerm | ❌ | ★ | 高 | 不做 |
| A27 | 端口共享/多程序分发（splitter） | com0com hub4com、Eltima | ❌ | ★★ | 高 | 不做/观察 |

---

## B. 数据构造与发送（32）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| B01 | 文本发送 | 全部 | ✅ | ★★★ | 低 | — |
| B02 | HEX 发送 | 全部 | ✅ | ★★★ | 低 | — |
| B03 | 混合/转义输入（`\xNN`、`<CR>`、bin/oct/dec） | YAT、Docklight、Termite | ❌ | ★★★ | 低-中 | v1.3 |
| B04 | 普通发送区行尾选择（None/CR/LF/CRLF） | 多数工具 | △（仅快捷命令） | ★★★ | 低 | v1.1 |
| B05 | 字符/行发送延时（逐字节节流） | YAT、CtrlTerm、picocom | ❌ | ★★ | 低 | v1.3 |
| B06 | 定时发送（周期） | SSCOM/XCOM/UartAssist/友善 | ✅ | ★★★ | 低 | — |
| B07 | 循环/重复发送（次数/停止条件/随机抖动） | SSCOM、友善、Docklight | △（无次数/停止条件） | ★★★ | 低 | v1.1 |
| B08 | 发送历史 + ↑/↓ 调取 | YAT、SSCOM、AccessPort、CoolTerm | ❌ | ★★★ | 低 | v1.1 |
| B09 | 一键重发/最近发送 | SSCOM、YAT | ❌ | ★★★ | 低 | v1.3 |
| B10 | 批量多行/逐行步进/命令文件 | YAT、Docklight、终端类 | ❌ | ★★ | 中 | v1.3 |
| B11 | 预定义命令/宏/功能键/按钮栏 | YAT、SecureCRT、Termite、UartAssist | ✅（快捷命令）/△（无 F 键） | ★★★ | 低 | v1.3 补强 |
| B12 | 命令页/分组/链接/导入导出 | YAT（command pages）、XCOM | △（分组有，导入导出缺） | ★★ | 低 | v1.3 |
| B13 | 文件发送（文本/二进制/HEX） | XCOM、SSCOM、YAT、CoolTerm | ❌ | ★★★ | 中 | v1.3 |
| B14 | 文件发送分块/块间延时/进度/中止 | XCOM、SSCOM、CoolTerm | ❌ | ★★★ | 中 | v1.3 |
| B15 | XMODEM（128/1K/CRC） | CoolTerm、SecureCRT、tio、CuteCom | ❌ | ★★★ | 中 | v2.1 |
| B16 | YMODEM（多文件） | 野火、友善、SecureCRT、tio | ❌ | ★★★ | 中 | v2.1 |
| B17 | ZMODEM/Kermit | SecureCRT、Serial 2、CuteCom | ❌ | ★ | 中 | 观察 |
| B18 | 校验和/CRC 追加（XOR/ADD8/CRC8/CRC16/CCITT） | 全部 | ✅ | ★★★ | 低 | — |
| B19 | CRC32 / Modbus CRC16 / 自定义多项式 / 50 种 CRC 预设 | SSCOM、友善、YAT | ❌ | ★★★ | 低 | v1.1 |
| B20 | 校验范围/位置/字节序可配 | Uartis、SSCOM、YAT | ✅（范围） | ★★ | 低 | v1.3 补字节序 |
| B21 | 校验计算器/CRC 助手 | x-tools、SSCOM | ❌ | ★★ | 低 | v1.3 |
| B22 | raw PDU 报文构造 + 期望响应/超时 | Modbus Poll Test Center、Docklight | ❌ | ★★★ | 低 | v1.2 |
| B23 | 自动应答/规则触发（正则→回包，可延时） | Docklight、x-tools、Termite AutoReply、UartAssist | ❌ | ★★★ | 中 | v2.1 |
| B24 | 脚本化发送（JS/Lua/Python） | tio Lua、SecureCRT、x-tools | ❌ | ★★ | 高 | v2.1 |
| B25 | 条件/触发发送（收到 X 发 Y） | Docklight、x-tools | ❌ | ★★ | 中 | v2.1 |
| B26 | 数据生成/流量生成/压测 | Docklight、SavvyCAN | ❌ | ★★ | 中 | 观察 |
| B27 | 发送队列/背压/优先级/取消 | 高吞吐工具普遍有 | ❌ | ★★ | 中 | v1.4 |
| B28 | 十六进制编辑器（偏移/ASCII 列/字节编辑） | HHD、RealTerm、野火 | ❌ | ★★ | 中 | v1.3 |
| B29 | 粘贴自动识别 hex/text | 现代工具常见 | ❌ | ★★ | 低 | v1.3 |
| B30 | 统一发送计划（一次/定时/循环 共用运行态） | Uartis 有雏形（分散） | △ | ★★★ | 中 | v1.3 |
| B31 | AT 命令集/补全/模板 | UartAssist、SecureCRT | ❌ | ★ | 中 | 观察 |
| B32 | 变量占位/参数替换（时间戳/序号/CRC） | SecureCRT、Docklight | ❌ | ★★ | 中 | v2.1 |

---

## C. 接收与显示（32）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| C01 | 文本视图 | 全部 | ✅ | ★★★ | 低 | — |
| C02 | HEX 视图 | 多数工具 | ✅ | ★★★ | 低 | — |
| C03 | HEX+ASCII 双栏 / hexdump | HHD、RealTerm、AccessPort | ❌ | ★★ | 中 | v1.3 |
| C04 | 绝对时间戳 | 全部 | ✅ | ★★★ | 低 | — |
| C05 | 相对时间/帧间隔（delta） | tio、minicom、CoolTerm、Docklight | ❌ | ★★★ | 低 | v1.3 |
| C06 | 时间戳格式族（ISO8601/epoch/自定义） | tio 5 种、minicom 4 种、CoolTerm | ❌ | ★★ | 低 | v1.3 |
| C07 | TX/RX 分色 + 方向标识 | 全部 | ✅ | ★★★ | 低 | — |
| C08 | 行号显示 | Uartis、部分工具 | ✅ | ★★ | 低 | — |
| C09 | 自动滚动/跟随 | 全部 | ✅（满缓冲 bug） | ★★★ | 低 | v1.1 修 |
| C10 | 暂停/冻结（保留缓冲 vs 丢弃，可配） | CoolTerm DisplayOff、IDF Ctrl+Y | ❌ | ★★★ | 低-中 | v1.3 |
| C11 | 搜索/高亮/上下条 | Uartis、CoolTerm、minicom | ✅ | ★★★ | 低 | — |
| C12 | 正则搜索 | HHD、Termite、YAT、ZOC | ❌ | ★★ | 低 | v1.3 |
| C13 | 方向/关键词/时间范围过滤 | HHD、Docklight、SecureCRT | ❌ | ★★★ | 中 | v1.3 |
| C14 | 行抑制/过滤规则（屏蔽噪声） | YAT、Termite filter、PlatformIO filter | ❌ | ★★ | 中 | v1.3 |
| C15 | 书签/标记/收藏行 | 部分终端/IDE | ❌ | ★★ | 低 | v1.3 |
| C16 | 编码 UTF-8/GBK | Uartis | ✅ | ★★★ | 低 | — |
| C17 | 编码扩展（Latin-1/UTF-16/Shift-JIS/Big5/自定义） | 友善、YAT、HHD、SecureCRT | ❌ | ★★ | 低 | v1.1 |
| C18 | 字符映射 imap/omap/emap（CR/LF、DEL/BS、8bit→hex） | picocom、tio `--map`、minicom | ❌ | ★★ | 低 | v1.1 |
| C19 | 特殊字符可视化（CR/LF/TAB/NUL/ESC/空格） | Uartis、SSCOM、HHD | ✅ | ★★ | 低 | — |
| C20 | 换行/折行/行宽/不换行策略 | 终端类工具 | ❌ | ★★ | 低 | v1.3 |
| C21 | 字节/帧率/吞吐统计 | CoolTerm、XCOM、Uartis（部分） | △ | ★★ | 低 | v1.1 补累计 |
| C22 | 错误统计（framing/parity/overrun/BREAK） | RFC2217/驱动类工具 | ❌ | ★★ | 中 | v1.4 |
| C23 | BREAK 检测/高亮 | 部分工业工具 | ❌ | ★ | 中 | 观察 |
| C24 | 分帧：超时/分隔符 | Uartis（有测试） | ✅ | ★★★ | 低 | — |
| C25 | 分帧：定长/协议帧/转义/长度域 | Docklight、HHD、Serial Studio | ❌ | ★★★ | 中 | v1.4 |
| C26 | 帧分组/包视图/折叠 | XCOM 分包、SSCOM、HHD | ❌ | ★★ | 中 | v1.3 |
| C27 | 会话分隔线/新会话标记 | CoolTerm、SecureCRT | ❌ | ★★ | 低 | v1.1 |
| C28 | 丢帧/过载提示与计数 | Uartis 已有占位行 | △ | ★★ | 低 | v1.1 补计数 |
| C29 | 终端仿真（ANSI/VT100/BEL/BS/CR/LF） | Tera Term、ZOC、SecureCRT | ❌ | ★★ | 中 | 观察 |
| C30 | 多窗口/并排对比/标签组 | SecureCRT、CoolTerm、HHD | ❌ | ★★ | 高 | v2.0 |
| C31 | 大缓冲/虚拟滚动/百万行 | 现代终端/IDE | ❌ | ★★ | 中 | v1.3/v2.0 |
| C32 | 复制行/复制正文/复制 Hex/选区复制 | 现代工具 | ❌ | ★★★ | 低 | v1.3 |

---

## D. 记录/导出/回放（21）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| D01 | 自动文本记录（TXT） | 全部 | ✅ | ★★★ | 低 | — |
| D02 | 原始二进制记录（BIN） | SSCOM、友善、HHD | ✅ | ★★★ | 低 | — |
| D03 | 记录运行中热键/开关 | tio、screen、IDF、CoolTerm | ✅（UI 开关） | ★★ | 低 | — |
| D04 | 文件名模板（端口/参数/时间戳） | SecureCRT、友善、Docklight | △（固定前缀） | ★★ | 低 | v1.1 |
| D05 | 日志轮转（时间/大小/SIGHUP） | 友善、SecureCRT、slsnif logrotate | ❌ | ★★★ | 低-中 | v1.3 |
| D06 | 日志去控制符/strip | tio `--log-strip`、PlatformIO filter | ❌ | ★★ | 低 | v1.3 |
| D07 | TXT 导出 | Uartis | ✅ | ★★★ | 低 | — |
| D08 | CSV 导出（可进 Excel） | Modbus Poll、Serial Studio、友善 | △（后端有，前端未接） | ★★★ | 低 | v1.1 |
| D09 | JSON/JSONL 导出 | Serial Studio、x-tools | △（后端有） | ★★★ | 低 | v1.1 |
| D10 | HTML/XML 导出 | Docklight、HHD、SecureCRT | ❌ | ★★ | 低 | 观察 |
| D11 | 结构化元数据（版本/会话/配置/时间） | HHD、Docklight | △（TXT 有头） | ★★ | 低 | v1.4 |
| D12 | 导出选中/时间范围 | YAT、HHD | ❌ | ★★ | 低 | v1.3 |
| D13 | 剪贴板复制/复制为格式 | 现代工具 | ❌ | ★★★ | 低 | v1.3 |
| D14 | 打印/打印预览/PDF | SecureCRT、HHD、RealTerm | ❌ | ★ | 中 | 观察 |
| D15 | 截图/导出当前视图 | 多数 GUI | ❌ | ★ | 低 | 观察 |
| D16 | 回放/时间轴/倍速/逐帧 | Serial Studio Replay、HHD、Docklight | ❌ | ★★★ | 中 | v1.4 |
| D17 | 日志导入/合并/多源 | HHD、Serial Studio | ❌ | ★★ | 中 | v1.4 |
| D18 | 回放 diff/黄金样本对比 | SavvyCAN Comparator、CI 需求 | ❌ | ★★ | 中 | v2.1 |
| D19 | 结构化录制格式 v2（方向/时间/会话/seq） | Serial Studio、HHD | ❌ | ★★★ | 中 | v1.4 |
| D20 | pcapng/MDF4/ASC/BLF 导入导出 | Wireshark、Serial Studio、CAN 工具 | ❌ | ★ | 高 | 观察 |
| D21 | 崩溃恢复/未保存会话恢复 | IDE/现代工具 | ❌ | ★★ | 低 | v1.3 |

---

## E. 协议与解析（30）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| E01 | 自定义帧模板（头/长度/命令/负载/校验/尾/变长/位域） | Docklight、HHD、Serial Studio、x-tools | ❌ | ★★★ | 中 | v2.0 |
| E02 | 字段提取/命名/单位/缩放 | Serial Studio、HHD 结构视图 | ❌ | ★★★ | 中 | v2.0 |
| E03 | 位域/结构体/字节序/浮点解析 | Modbus Poll 28 格式、HHD | ❌ | ★★★ | 中 | v2.0 |
| E04 | 内置协议模板库 | Docklight、Serial Studio、x-tools | ❌ | ★★★ | 中 | v2.0 |
| E05 | 可视化协议模板编辑器（JSON 可分享） | Serial Studio 项目编辑器、SavvyCAN DBC | ❌ | ★★★ | 中-高 | v2.0 |
| E06 | Modbus RTU 主站 | Modbus Poll、QModMaster、Simply Modbus | ❌ | ★★★ | 中 | v2.0（可提前 v1.3） |
| E07 | Modbus ASCII 主站 | Modbus Poll、Simply Modbus | ❌ | ★★ | 低-中 | v2.1 |
| E08 | Modbus TCP 主站 | Modbus Poll、QModMaster | ❌ | ★★ | 低-中 | v2.1 |
| E09 | Modbus 从站/设备模拟器 | Modbus Slave、Simply Modbus | ❌ | ★★★ | 中 | v2.1 |
| E10 | 寄存器表/映射导入导出（CSV/JSON/XLSX） | Modbus Poll、Serial Studio Pro | ❌ | ★★★ | 低-中 | v2.0 |
| E11 | 功能码全集/异常码/地址基数/地址扫描 | Modbus Poll、QModMaster | ❌ | ★★★ | 中 | v2.0 |
| E12 | 轮询调度/超时重发/退避 | Modbus Poll、QModMaster | ❌ | ★★★ | 中 | v2.0 |
| E13 | 总线监视（raw+PDU、请求响应配对） | QModMaster Bus Monitor、Modbus Poll | ❌ | ★★★ | 中 | v2.0 |
| E14 | DL/T645 模板 | 虚拟电表 V2.7、DLT645 测试软件 | ❌ | ★★（国内） | 低 | v2.1 |
| E15 | NMEA/GPS 解析/地图 | UartAssist、部分国产 | ❌ | ★ | 中 | 观察 |
| E16 | AT/GSM 命令解析/补全 | UartAssist、SecureCRT | ❌ | ★ | 中 | 观察 |
| E17 | IEC 101/104/103 测试 | 国内规约工具 | ❌ | ★ | 高 | 不做 |
| E18 | OPC UA 客户端/服务端 | UaExpert、Serial Studio Pro | ❌ | ★ | 高 | 不做 |
| E19 | S7/EtherNet-IP/Modbus 网关 | Serial Studio（待核实）、友善网关 | ❌ | ★ | 高 | 不做/观察 |
| E20 | CAN/CAN-FD + DBC | SavvyCAN、Cangaroo | ❌ | ★（非串口） | 高 | 不做 |
| E21 | MQTT/Sparkplug/CoAP 客户端 | Serial Studio、x-tools、Mosquitto | ❌ | ★★ | 高 | v2.1 |
| E22 | HTTP/WebSocket/JT808 | x-tools、Serial Studio | ❌ | ★★ | 中-高 | v2.1（WS 优先） |
| E23 | 协议解码插件（Lua/JS/Python/WASM） | sigrok、Wireshark、Serial Studio、x-tools | ❌ | ★★★ | 高 | v2.1 |
| E24 | 脚本解码/异常回溯（addr2line/ESP32） | PlatformIO filter、IDF monitor | ❌ | ★★ | 中 | v2.1 |
| E25 | 一致性/自检规则（CRC/长度/异常码/帧间隔） | Modbus Poll、sigrok 标注 | ❌ | ★★ | 低-中 | v2.1 |
| E26 | 位域/信号表/DBC-like 视图 | SavvyCAN、Modbus Poll | ❌ | ★★ | 中 | v2.1 |
| E27 | 多协议网关（serial↔TCP/MQTT） | x-tools、友善、Node-RED | ❌ | ★★ | 高 | 观察/v2.1 |
| E28 | 协议 fuzz/错误注入（坏 CRC/截断/错 ID/粘包） | SavvyCAN Fuzzing、Docklight | ❌ | ★★ | 中 | v2.1 |
| E29 | 协议断言/测试用例 | Docklight Scripting、sigrok | ❌ | ★★ | 中-高 | v2.1 |
| E30 | 请求-响应关联/时序测量（P50/P95） | SavvyCAN Temporal、UaExpert | ❌ | ★★★ | 中 | v2.0 |

---

## F. 可视化与分析（18）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| F01 | 实时波形（多通道、自动滚动） | SerialPlot、VOFA+、Serial Studio、CoolTerm Chart、Modbus Poll | ❌ | ★★★ | 中-高 | v2.0 |
| F02 | XY 图/散点 | MegunoLink、SerialPlot | ❌ | ★★ | 中 | 观察 |
| F03 | FFT/频谱 | Serial Studio、VOFA+ | ❌ | ★ | 高 | 观察 |
| F04 | 直方图/统计图 | VOFA+、Serial Studio | ❌ | ★ | 中 | 观察 |
| F05 | 3D/瀑布图 | Serial Studio、VOFA+ | ❌ | ★ | 高 | 不做 |
| F06 | 仪表盘/自定义面板（控件绑定命令） | MegunoLink Interface Panel、VOFA+ | ❌ | ★★ | 高 | 观察 |
| F07 | 数据表视图 | MegunoLink Tables、Serial Studio | ❌ | ★★ | 中 | v2.1 |
| F08 | 缩放/游标/暂停 | 绘图类工具 | ❌ | ★★ | 中 | v2.0 |
| F09 | 导出 PNG/CSV/WAV | Serial Studio、CoolTerm、Modbus Poll | ❌ | ★★ | 低-中 | v2.0 |
| F10 | 触发/阈值告警（通知/声音/写文件） | ZOC、iTerm2 Triggers、HHD | ❌ | ★★ | 中 | v2.1 |
| F11 | 条件发送/自动应答规则 | Docklight、x-tools、UartAssist | ❌ | ★★★ | 中 | v2.1 |
| F12 | 录制回放/时间轴 | Serial Studio Replay、HHD | ❌ | ★★★ | 中 | v1.4 |
| F13 | 统计（min/max/avg/速率/超时率） | 工业/分析工具 | ❌ | ★★ | 低 | v1.3/v2.0 |
| F14 | 数据解析规则（CSV/JSON/key=value） | Serial Studio 解码器、x-tools | ❌ | ★★★ | 中 | v2.0 |
| F15 | 多图联动/对比 | 分析类工具 | ❌ | ★ | 中 | 观察 |
| F16 | 截图/录屏/演示模式 | 演示类工具 | ❌ | ★ | 低 | 观察 |
| F17 | 设备/信号树视图 | HHD、Serial Studio | ❌ | ★★ | 中 | v2.0 |
| F18 | 数据注入第三方应用（Excel/DDE/键盘） | WinWedge | ❌ | ★ | 中 | 不做/观察 |

---

## G. 自动化/脚本/测试（29）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| G01 | 自动化测试序列（发送-等待-断言） | Docklight Scripting、tio expect、IDF command-stream | ❌ | ★★★ | 中-高 | v2.1 |
| G02 | 脚本引擎（JS/Lua/Python/Rhai） | SecureCRT、tio Lua、x-tools、Docklight VBScript | ❌ | ★★★ | 高 | v2.1 |
| G03 | 脚本录制器（操作录制生成脚本） | SecureCRT、Docklight | ❌ | ★★ | 中-高 | v2.1 |
| G04 | 脚本调试器（断点/变量/栈） | HHD Ultimate | ❌ | ★★ | 高 | 观察 |
| G05 | 触发动作（收到 X 执行 Y/通知） | iTerm2 Triggers、ZOC、Docklight | ❌ | ★★ | 中 | v2.1 |
| G06 | 自动应答/自动登录 | Termite、UartAssist、Docklight、ZOC | ❌ | ★★★ | 中 | v2.1 |
| G07 | 状态机/协议仿真 | Docklight、Modbus Slave | ❌ | ★★ | 高 | 观察 |
| G08 | 数据/流量生成器 | SavvyCAN、Docklight | ❌ | ★★ | 中 | 观察 |
| G09 | 压测/老化/吞吐测试 | Docklight、Modbus Poll | ❌ | ★★ | 中 | 观察 |
| G10 | 响应时间/抖动测量 | SavvyCAN Temporal、UaExpert | ❌ | ★★★ | 低-中 | v2.0 |
| G11 | 断言/预期匹配 | tio expect、IDF monitor | ❌ | ★★ | 中 | v2.1 |
| G12 | 测试报告（JUnit/JSON/HTML） | Docklight、CI 工具 | ❌ | ★★ | 中 | v2.1 |
| G13 | CLI/无头运行脚本 | YAT shell、PlatformIO、sigrok-cli | ❌ | ★★ | 中-高 | v2.1 |
| G14 | 外部 API（REST/gRPC/JSON-RPC/AppleScript/socket） | CoolTerm、Serial Studio、ZOC | ❌ | ★★ | 中-高 | v2.1 |
| G15 | MCP server/AI agent 接入 | serial-mcp、SerialRUN | ❌ | ★（趋势） | 中-高 | 观察 |
| G16 | CI 集成（退出码/超时/非 TTY） | picocom、IDF、PlatformIO | ❌ | ★★ | 中 | v2.1 |
| G17 | 计划任务（定时启动/停止） | Docklight、SecureCRT | ❌ | ★★ | 低-中 | v1.3 |
| G18 | 触发式快照（前后 N 帧） | Docklight、HHD、SecureCRT | ❌ | ★★★ | 低-中 | v1.3 |
| G19 | 故障复现/录制回放测试 | Serial Studio、SavvyCAN Playback | ❌ | ★★ | 中 | v2.1 |
| G20 | 产线测试/一拖多多设备 | Modbus Poll 多窗口、HHD、Docklight | ❌ | ★★ | 高 | 观察 |
| G21 | 变换/计算通道（单位换算、线性标定、滤波、派生数据集） | Serial Studio Value Transforms/Computed Dataset（Pro） | ❌ | ★★★ | 中 | v2.1 |
| G22 | Historian/SQLite 归档 + 可复现校验 | Serial Studio Historian（Pro，格式公开） | ❌ | ★★ | 高 | v2.1 |
| G23 | 告警引擎（ISA-18.1：Ack/Silence/Reset/Test、报警带、死区） | Serial Studio 4.2.0 Aural alerts/alarm bands | ❌ | ★★ | 中 | v2.1 |
| G24 | 操作员/运行时模式（隐藏编辑能力、密封部署包） | Serial Studio runtime mode/.ssdeploy、SecureCRT operator shortcuts | ❌ | ★★ | 中 | 观察 |
| G25 | 命令库（发送历史 + 固定置顶 + 循环重发） | Serial Studio 4.2 Console command library、SerialRUN history | ❌ | ★★★ | 低 | v1.1/v1.3 |
| G26 | 无硬件模拟（脚本回包/虚拟设备，用于演示与 CI） | serial-mcp-server simulation、CoolTerm NULL、Modbus Slave | ❌ | ★★★ | 中 | v1.4/v2.1 |
| G27 | 多窗口/副屏浮窗（日志/绘图/统计拖出独立窗口） | SerialRUN 独立窗口、MegunoLink 停靠、Serial Studio 多窗口 | ❌ | ★★ | 中-高 | v2.0 |
| G28 | 场景化 AI 助手（BYO Key：解释帧/异常栈、生成规则、诊断"无响应"） | Serial Studio In-App AI Assistant（Pro）、electerm/nyaterm AI | ❌ | ★ | 中-高 | 观察 |
| G29 | MCP Server（本地、可审计）+ UI 自动化 API | SerialRUN 23 工具、QSerial 47 工具、Serial Studio `ui.automation.*`+consent、serial-mcp-server JSON 宏 DSL | ❌ | ★★★ | 中-高 | 观察/v2.1（默认关闭+分级 consent+审计） |

---

## H. 会话/工作区/UX（25）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| H01 | 多标签/多窗口 | 友善、CoolTerm、SecureCRT、YAT | ❌ | ★★★ | 高 | v2.0 |
| H02 | 会话保存/加载（端口+参数+命令+校验+分段） | CoolTerm、AccessPort、YAT workspace | ❌（后端死命令） | ★★★ | 中 | v1.4 |
| H03 | 工程/工作区文件（布局+会话组+配置） | Docklight project、友善 .spu、SecureCRT | ❌ | ★★★ | 中 | v1.4 |
| H04 | 配置预设/8N1 快捷 chips | 现代工具 | ❌ | ★★ | 低 | v1.3 |
| H05 | 配置导入导出（团队共享） | YAT、SecureCRT、Docklight | ❌ | ★★ | 低 | v1.3 |
| H06 | 主题亮/暗 | Uartis | ✅ | ★★ | 低 | — |
| H07 | 跟随系统/高对比度 | 现代工具 | ❌ | ★★ | 低 | v1.2 |
| H08 | 字体/字号/缩放/行距 | 终端类工具 | ❌ | ★★ | 低 | v1.2 |
| H09 | 布局记忆（面板尺寸） | Uartis（部分） | △ | ★★ | 低 | v1.2 补 clamp |
| H10 | 面板拖拽/停靠/分屏 | MegunoLink、SecureCRT、HHD | △（拖拽有，分屏无） | ★★ | 中 | v2.0 |
| H11 | 命令面板（⌘K） | Serial Studio、VS Code 类 | ❌ | ★★ | 低-中 | v1.3 |
| H12 | 快捷键自定义/帮助/转义键 | ZOC、SecureCRT、iTerm2 | ❌ | ★★ | 低-中 | v1.3 |
| H13 | 多语言（中/英） | Uartis | ✅ | ★★ | 低 | — |
| H14 | 可访问性（键盘/屏幕阅读/对比度） | 现代工具 | ❌ | ★★ | 中 | v1.2 |
| H15 | 新手引导/示例/模板 | 商业工具 | ❌ | ★ | 中 | v1.3 |
| H16 | 通知/托盘/置顶 | 商业工具 | ❌ | ★ | 中 | 观察 |
| H17 | 便携模式/配置随包 | YAT、SecureCRT | ❌ | ★ | 低 | 观察 |
| H18 | 最近端口/最近文件 | 现代工具 | △（端口记忆有） | ★ | 低 | v1.3 |
| H19 | 设置搜索/分类/恢复默认 | VS Code 类 | ❌ | ★★ | 中 | v1.2/v1.3 |
| H20 | 窗口状态记忆（大小/位置） | 现代工具 | ❌ | ★★ | 低 | v1.2 |
| H21 | 全键盘操作 | YAT（宣称 fully keyboard operable） | △（部分） | ★★ | 中 | v1.2 |
| H22 | 关于/更新/许可证 | Uartis | ✅ | ★ | 低 | — |
| H23 | 单实例/多实例互斥 | 商业工具 | ❌ | ★ | 低 | v1.3 |
| H24 | 会话锁定（密码锁输入/隐藏输出） | SecureCRT | ❌ | ★ | 低 | 观察 |
| H25 | 语法高亮（自定义关键字/日志级别） | iTerm2、MobaXterm、SecureCRT | ❌ | ★★ | 中 | v1.3 |

---

## I. 网络/集成/平台（25）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| I01 | TCP client（连串口服务器/DTU） | 友善、Hercules、YAT、Docklight | ❌ | ★★★ | 中 | v1.4 |
| I02 | TCP server（多客户端共享串口） | 友善、Hercules、LinkAll | ❌ | ★★ | 中 | v1.4 |
| I03 | UDP（含广播/设备发现） | Hercules、YAT、友善 | ❌ | ★★ | 低-中 | v1.4 |
| I04 | WebSocket | x-tools、Serial Studio、LinkAll | ❌ | ★★ | 中 | v2.1 |
| I05 | MQTT/Sparkplug | Serial Studio、x-tools、Mosquitto | ❌ | ★★ | 高 | 观察/v2.1 |
| I06 | HTTP/CoAP/OPC UA | x-tools、Serial Studio、UaExpert | ❌ | ★ | 高 | 不做/观察 |
| I07 | RFC2217/Telnet 串口服务器连接 | ser2net、com0com hub4com、pySerial | ❌ | ★★ | 中 | v1.4 |
| I08 | SSH | SecureCRT、Termius、ZOC | ❌ | ★ | 中-高 | 观察 |
| I09 | 端口转发/双口桥接/中间人 | Termite、RealTerm、HHD、com0com hub4com | ❌ | ★★ | 中 | v1.4 |
| I10 | CLI/无头模式 | YAT、picocom、PlatformIO、sigrok-cli | ❌ | ★★ | 中-高 | v2.1 |
| I11 | REST/gRPC/JSON-RPC API | Serial Studio API、CoolTerm socket | ❌ | ★★ | 中-高 | v2.1 |
| I12 | MCP server/AI 接入 | serial-mcp、SerialRUN | ❌ | ★（趋势） | 中-高 | 观察 |
| I13 | 插件系统（过滤/解码/可视化） | Termite .flt、PlatformIO filter、HHD、Serial Studio | ❌ | ★★ | 高 | v2.1 |
| I14 | Node-RED/Home Assistant 集成 | Node-RED、Mosquitto | ❌ | ★ | 中 | 观察 |
| I15 | 日志转发（Syslog/文件/管道/远端） | CoolTerm、tio、HHD | ❌ | ★★ | 低-中 | v1.3 |
| I16 | CI/CD 集成（命令行/退出码） | PlatformIO、IDF、picocom | ❌ | ★★ | 中 | v2.1 |
| I17 | 云端共享/浏览器终端/邀请码 | 友善 Live Sync | ❌ | ★ | 高 | 观察 |
| I18 | 移动端/Web 版 | Termius、友善浏览器终端 | ❌ | ★ | 高 | 观察 |
| I19 | Linux 桌面/ARM 正式发布 | CoolTerm/MobaXterm/x-tools | ❌ | ★★ | 中 | 观察（CI 编译 v1.2） |
| I20 | macOS Intel/Universal 构建 | CoolTerm、Serial 2、ZOC | ❌ | ★ | 低 | 观察 |
| I21 | 便携版/免安装 | YAT、SSCOM、SecureCRT | ❌ | ★ | 低 | 观察 |
| I22 | 开机自启/服务化/后台采集 | screen、ser2net、HHD Server | ❌ | ★ | 中-高 | 观察 |
| I23 | 设备发现（UDP 广播/扫网段/改 IP） | Hercules UDP Config | ❌ | ★ | 中 | 观察 |
| I24 | 串口→MQTT/WS 网关 | x-tools、Serial Studio、Node-RED | ❌ | ★★ | 高 | 观察/v2.1 |
| I25 | 时序库/云上行（InfluxDB/MQTT/Webhook，本地优先+失败重试） | Serial Studio InfluxDB/MQTT（Pro）、Node-RED | ❌ | ★ | 高 | 观察 |

---

## J. 诊断/设备/模拟（20）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| J01 | 进程内虚拟对端/loopback（免驱） | pySerial `loop://`、CoolTerm NULL | ❌ | ★★ | 低-中 | v1.4 |
| J02 | 回环/自测（无硬件） | CoolTerm NULL、com0com | ❌ | ★★ | 低-中 | v1.4 |
| J03 | 数据模拟/设备仿真（从站/传感器） | Modbus Slave、虚拟电表 | ❌ | ★★★ | 中 | v2.1 |
| J04 | 协议嗅探（双口/文件中间人） | Docklight Tap、slsnif、interceptty | ❌ | ★★ | 中-高 | 观察 |
| J05 | USB 底层抓包（URB） | USBPcap、Wireshark、HHD | ❌ | ★ | 高 | 不做 |
| J06 | 端口监视驱动（旁观他进程） | Eltima、HHD | ❌ | ★ | 高 | 不做 |
| J07 | 端口/驱动诊断信息（VID/PID/驱动/位置） | HHD、设备管理器 | △ | ★★ | 低 | v1.3 |
| J08 | 错误注入（坏 CRC/截断/错 ID/粘包） | SavvyCAN Fuzzing、Docklight | ❌ | ★★ | 中 | v2.1 |
| J09 | 波特率自动检测 | 部分工具 | ❌ | ★ | 中 | 观察 |
| J10 | 设备自动识别/设备库 | 友善、HHD | ❌ | ★★ | 中 | 观察 |
| J11 | 固件烧录集成（esptool/avrdude/OpenOCD） | 工程链工具 | ❌ | ★ | 高 | 不做 |
| J12 | Bootloader 进入（DTR/RTS 序列） | esptool、tio pulse、Arduino IDE | ❌ | ★★★ | 低 | v1.2 |
| J13 | ISP/编程 | avrdude、OpenOCD | ❌ | ★ | 高 | 不做 |
| J14 | 产线测试/序列号/一拖多 | Modbus Poll、Docklight、HHD | ❌ | ★★ | 高 | 观察 |
| J15 | 链路质量（framing/parity/overrun） | RFC2217 状态位、RealTerm | ❌ | ★★ | 中 | v1.4 |
| J16 | 串口线序/环回检测 | ComDebug、部分工具 | ❌ | ★ | 低 | 观察 |
| J17 | 电平/引脚测量（I2C/SPI/1-Wire） | RealTerm（配适配器）、sigrok | ❌ | ★ | 高 | 不做 |
| J18 | 设备复位/重启（DTR/RTS） | Hercules、CoolTerm | ❌ | ★★★ | 低 | v1.1 |
| J19 | 地址/设备扫描（Modbus/UDS） | Modbus Poll、SavvyCAN | ❌ | ★★ | 低-中 | v2.0 |
| J20 | 诊断日志/崩溃分析 | 现代工具 | ❌ | ★★ | 低 | v1.1 |

---

## K. 工程/发布/安全（20）

| ID | 功能与场景 | 代表工具（依据） | Uartis | 价值 | 难度 | 计划 |
|---|---|---|---|---|---|---|
| K01 | 自动更新检查/下载/安装 | Uartis | ✅ | ★★★ | 低 | — |
| K02 | 更新签名/哈希校验 | Tauri 官方 updater、商业工具 | ❌ | ★★★ | 中 | v1.1 |
| K03 | Windows 代码签名 | 商业工具 | ❌ | ★★ | 中 | 观察 |
| K04 | macOS 签名+公证 | Uartis CI 已配 | ✅ | ★★★ | 中 | — |
| K05 | 安装包 NSIS/DMG | Uartis | ✅ | ★★★ | 低 | — |
| K06 | MSI/静默部署/企业分发 | HHD、SecureCRT | ❌ | ★ | 中 | 观察 |
| K07 | 多架构（ARM64/Intel/Linux 包） | HHD、CoolTerm、x-tools | ❌ | ★★ | 中-高 | 观察 |
| K08 | 崩溃上报/诊断日志文件 | 现代工具 | ❌ | ★★ | 低-中 | v1.1/v1.2 |
| K09 | 遥测开关/隐私合规 | 商业工具 | ❌ | ★ | 低 | 不做（默认无遥测） |
| K10 | 配置加密/敏感信息保护 | 工业工具 | ❌ | ★ | 中 | 观察 |
| K11 | 会话密码/锁定/审计 | SecureCRT、HHD | ❌ | ★ | 中 | 观察 |
| K12 | FIPS/合规/企业策略 | HHD | ❌ | ★ | 高 | 不做 |
| K13 | 许可证/激活 | 商业工具 | ❌ | ★ | 中 | 不做（开源） |
| K14 | 插件签名/沙箱 | HHD、Wireshark | ❌ | ★ | 高 | 观察 |
| K15 | 测试覆盖（Rust/前端/E2E） | 成熟项目 | △（49 Rust 单测，前端 0） | ★★★ | 中 | v1.1 |
| K16 | CI/CD 门禁（fmt/clippy/lint/test/Windows） | 成熟项目 | ❌ | ★★★ | 低 | v1.1 |
| K17 | 版本管理/变更日志 | Uartis（CI notes） | ✅/△ | ★★ | 低 | — |
| K18 | 文档/多语言文档 | Uartis | ✅/△ | ★★ | 低 | 持续 |
| K19 | 自动备份/恢复配置 | 现代工具 | ❌ | ★ | 低 | 观察 |
| K20 | 设计系统/主题体系（Fluent） | 现代桌面应用 | ❌ | ★★★ | 中 | v1.2 |

---

## L. 新增候选（R2 独有、未并入上表的功能模式）

| ID | 候选功能 | 代表工具/证据 | 价值 | 难度 | 建议 |
|---|---|---|---|---|---|
| X-01 | 触发式通信快照（匹配错误模式时保存前后 N 帧+环境） | Docklight、HHD、SecureCRT Snapshot | ★★★ | 低-中 | v1.3（并入 G18） |
| X-02 | 脚本录制器（录制键击/操作生成脚本） | SecureCRT（Python/VBScript）、Docklight | ★★ | 中-高 | v2.1（G03） |
| X-03 | 脚本调试器（断点/变量/栈） | HHD Ultimate | ★★ | 高 | 观察 |
| X-04 | 自定义可视化器/过滤器插件 | HHD、Termite .flt、PlatformIO filter | ★★ | 高 | v2.1（I13） |
| X-05 | 数据注入第三方应用（Excel/DDE/键盘模拟） | WinWedge | ★ | 中 | 不做 |
| X-06 | I²C/SPI/1-Wire 总线控制 | RealTerm（配适配器）、sigrok | ★ | 高 | 不做 |
| X-07 | 云端实时共享/临时邀请码/浏览器终端 | 友善 Live Sync | ★ | 高 | 观察 |
| X-08 | 桥接限速（背压）+丢帧计数 | 友善桥接 | ★★ | 中 | v1.4（并入 I09） |
| X-09 | Modbus 网关（TCP↔RTU、多主共享 RS-485） | 友善 | ★★ | 中-高 | 观察/v2.1 |
| X-10 | 会话锁定（密码锁输入/隐藏输出） | SecureCRT | ★ | 低 | 观察（H24） |
| X-11 | 终端语法高亮（自定义关键字） | MobaXterm、SecureCRT | ★★ | 中 | v1.3（H25） |
| X-12 | 多会话平铺/标签组 | SecureCRT Tiling | ★★ | 中 | v2.0（C30/H01） |
| X-13 | 产线自动配置/启动脚本 | Docklight startup scripts | ★★ | 中 | 观察 |
| X-14 | 主机端打印/打印预览 | SecureCRT、HHD、RealTerm | ★ | 中 | 观察（D14） |
| X-15 | 设备发现（UDP 广播/改 IP） | Hercules UDP Config | ★ | 中 | 观察（I23） |
| X-16 | 协议帧模板编辑器（可视化 JSON） | Docklight 序列、SavvyCAN DBC、Serial Studio | ★★★ | 中 | v2.0（E01/E05） |
| X-17 | 寄存器表导入导出（CSV/XLSX/JSON） | Modbus Poll、Serial Studio Pro | ★★★ | 低-中 | v2.0（E10） |
| X-18 | 免驱虚拟对端/loopback | pySerial loop:// | ★★ | 低-中 | v1.4（J01） |
| X-19 | RFC2217 客户端（含链路错误位） | ser2net、pySerial | ★★ | 中 | v1.4（A23） |
| X-20 | CLI/headless + 断言 + 退出码 | YAT shell、IDF monitor、PlatformIO | ★★ | 中 | v2.1（G13/G16） |
| X-21 | 结构化导出交换格式（CSV/JSONL/pcapng 导入） | Modbus Poll、Serial Studio、Wireshark | ★★ | 低 | v1.1（D08/D09） |
| X-22 | 多端口产线测试（一拖多） | Modbus Poll 多窗口、HHD | ★★ | 高 | 观察（G20） |
| X-23 | 请求-响应配对 + 时序统计 | QModMaster Bus Monitor、SavvyCAN Temporal | ★★★ | 中 | v2.0（E13/E30） |
| X-24 | 协议一致性自检（CRC/长度/异常码/帧间隔） | Modbus Poll、sigrok | ★★ | 低-中 | v2.1（E25） |

---

## M. 最值得做的 30 项（跨报告合并排序）

| 排名 | 功能 | ID | 版本 | 理由（一句话） |
|---:|---|---|---|---|
| 1 | 重连不丢帧/自动滚动/定时发送修复 | FE-1/2/3 | v1.1 | 已有功能的数据正确性，优先级高于新功能 |
| 2 | DTR/RTS/Break + 引脚状态 | A08-A11 | v1.1 | 嵌入式日常刚需，低成本 |
| 3 | 发送历史 + 一键重发 + 行尾 | B04/B08/B09 | v1.1 | 手感差异最大的小功能 |
| 4 | CSV/JSON 导出 + 保存对话框 | D08/D09 | v1.1 | 后端已就绪，1 天接完 |
| 5 | CRC32/Modbus CRC16/自定义多项式 | B19 | v1.1 | 自研协议刚需 |
| 6 | 时间戳相对/帧间隔 + 字符映射 | C05/C18 | v1.1 | CLI 世界事实标准，GUI 稀缺 |
| 7 | 更新器 SHA256/路径校验 | K02 | v1.1 | 供应链安全 |
| 8 | 端口占用检测/错误归一 | A17 | v1.1 | 减少"连不上"的无效排障 |
| 9 | 日志轮转/文件名模板 | D04/D05 | v1.3 | 长时间抓取刚需 |
| 10 | 暂停/冻结 + 正则/方向过滤 | C10/C12/C13 | v1.3 | 日志可用性质变 |
| 11 | 文件发送（分块/进度/中止） | B13/B14 | v1.3 | 固件/参数批量下发 |
| 12 | 统一发送计划 + 十六进制编辑器 | B28/B30 | v1.3 | 发送体验闭环 |
| 13 | 快速命令完整度 + ⌘K + 快捷键 | B11/B12/H11/H12 | v1.3 | 高频操作效率 |
| 14 | 触发式快照 + 环形缓冲 | G18/X-01 | v1.3 | 偶发错误唯一复现手段 |
| 15 | 会话/工程文件保存 | H02/H03 | v1.4 | 关掉重开不用重配 |
| 16 | 记录格式 v2 + 回放/时间轴 | D16/D19 | v1.4 | 现场问题实验室复现 |
| 17 | TCP/UDP 桥 + RFC2217 | A22/A23/I01-I03 | v1.4 | 串口服务器/远程调试 |
| 18 | 自动重连（策略化） | A16 | v1.4 | 无人值守测试 |
| 19 | 虚拟对端/loopback（免驱） | J01/J02 | v1.4 | 无硬件也能测 |
| 20 | 协议帧模板 + 字段视图 | E01/E02/E05 | v2.0 | 私有协议调试分水岭 |
| 21 | Modbus RTU 主站最小工作台 | E06/E10-E13 | v2.0 | 工业场景最大公约数 |
| 22 | raw PDU 构造 + 请求响应配对 | B22/E13/E30 | v2.0 | 协议测试地基（可提前 v1.3） |
| 23 | 实时波形（多通道/缩放/导出） | F01/F08/F09 | v2.0 | 传感器/PID 刚需 |
| 24 | 多会话/多标签 | A18/H01 | v2.0 | 多设备并行调试 |
| 25 | 协议解码插件 + 脚本解码 | E23/E24 | v2.1 | 可扩展性护城河 |
| 26 | 自动应答/规则触发 | B23/G06 | v2.1 | 无设备联调/设备模拟 |
| 27 | 断言式自动化测试 + 报告 | G01/G11/G12 | v2.1 | 从"人点"到"可回归" |
| 28 | XMODEM/YMODEM | B15/B16 | v2.1 | 裸机 bootloader 升级 |
| 29 | CLI/API/MCP | I10-I12/G13/G16 | v2.1/观察 | 工程链与 AI 接入 |
| 30 | 多协议网关/MQTT/WS | I04/I24/E21/E22 | 观察/v2.1 | 上云与自动化平台 |

---

## N. 明确不做清单（附理由）

| 能力 | 代表工具 | 不做理由 | 替代方案 |
|---|---|---|---|
| 内核虚拟串口对 | com0com 3.0（2018 停更）、VSPD | 需内核驱动+签名+杀软白名单+三平台重写，与 Apache-2.0/免签名发布冲突 | 进程内虚拟对端（J01）；引导用外部 com0com |
| USB 底层抓包（URB） | USBPcap、Wireshark | 内核过滤驱动、需重启/SIP；软件抓包只见 URB | 导入 pcapng 只读；硬件分析仪外部工具 |
| 非侵入端口监视（旁观他进程） | Eltima、HHD | 需 SSM/端口 hook 驱动+签名；Win11 内核策略趋严 | 本会话时间线+录制回放；外部硬件分接 |
| 完整 OPC UA/S7/EtherNet-IP/IEC104 栈 | UaExpert、PLC 工具 | 每个都是独立生态+现场验证，免费竞品已存在 | 协议模板（E01/E05）+ 外部工具 |
| CAN/CAN-FD + DBC | SavvyCAN、Cangaroo | 需专用硬件/驱动，非串口定位 | 借鉴其 fuzz/时序/回放交互 |
| SCADA/HMI/Historian 平台 | Node-RED、Serial Studio Historian | 非桌面调试工具战场，投入巨大 | 数据导出/转发，平台交给 Node-RED/MQTT |
| Wireshark 级 dissector 框架 | Wireshark 131+ 解码器 | 生态与维护量不可比 | 轻量协议模板 + JS 解码器（E23） |
| I²C/SPI/1-Wire 总线控制 | RealTerm（配适配器）、sigrok | 需硬件适配器与驱动，超出 UART 范畴 | 外部工具；预留导入 |
| 移动端/Web 版 | Termius、友善浏览器终端 | 维护成本高、与桌面定位冲突 | 观察；CLI/API 优先 |
| 云同步/账户体系 | 友善、商业工具 | 隐私/合规/后端成本，开源项目不宜 | 配置导入导出（H05） |
| 固件烧录/ISP | esptool/avrdude/OpenOCD | 已有成熟工具，重复投入无收益 | 文档引导 + DTR/RTS 辅助（J12） |
| 插件市场/商业许可 | HHD/SecureCRT | 生态与法务成本高 | 本地插件（I13）+ 开源许可 |

---

## O. 与现有规划的差异（R2 新增/调整）

**新增进路线图**：字符映射三表（C18）、时间戳格式族（C05/C06）、端口锁/只读模式（A13/A14）、RTS/DTR 脉冲编排（A12）、日志轮转/文件名模板（D04/D05）、触发式快照（G18）、暂停/过滤/复制（C10/C12/C13/C32）、raw PDU（B22）、RFC2217（A23）、TCP/UDP 桥（A22）、记录回放（D16/D19）、协议模板/字段视图（E01/E02/E05）、Modbus 工作台（E06/E10-E13）、波形（F01）、脚本/断言/报告（G01/G11/G12）、CLI/API/MCP（I10-I12）、免驱虚拟对端（J01）。

**版本调整**：R2 Windows 报告建议 Modbus/多会话 v1.3；因 v1.2 已排 Fluent 迁移，本规划将 raw PDU 提前到 v1.3、Modbus/多会话后置 v2.0；端口锁/字符映射/时间戳等低成本项前置到 v1.1。

**与原路线的兼容**：§5.4 的 Fluent v1.2 是 UI 体系迁移，不与功能冲突；v1.3 起所有新面板用 Fluent 组件。

---

## P. 来源

- R1：`.tmp/plan/03-competitor-research.md`（26 工具 × 26 项矩阵、来源链接）
- R2：`.tmp/plan/05-market-windows.md`、`05-market-unix.md`、`05-market-protocol-test.md`、`05-market-oss.md`（本文件所有 `代表工具` 的依据，含 110+ 抓取页面与待核实清单）
- 关键来源：Serial Studio Pro-vs-Free <https://github.com/Serial-Studio/Serial-Studio/blob/master/doc/help/Pro-vs-Free.md> ｜ SerialRUN <https://github.com/YaoIsAI/SerialRUN> ｜ serial-mcp-server <https://github.com/Adancurusul/serial-mcp-server> ｜ QSerial <https://github.com/qiuchengcai/QSerial> ｜ FluentSerialAssistant <https://github.com/txp666/FluentSerialAssistant> ｜ tio <https://manpages.debian.org/trixie/tio/tio.1.en.html> ｜ RFC 2217 <https://datatracker.ietf.org/doc/html/rfc2217> ｜ Docklight 手册 <https://docklight.de/manual/docklightoverview.html> ｜ HHD <https://hhdsoftware.com/device-monitoring-studio>
- Fluent/UI 方向见 `docs/OPTIMIZATION-PLAN.zh-CN.md` §5.4；工程与安全见 `.tmp/plan/04-engineering-audit.md`。

*本文件只做功能盘点与优先级建议，未改动任何源码；"待核实"项在有官方页面后应更新。*
