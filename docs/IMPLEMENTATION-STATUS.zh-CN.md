# Uartis 实施状态（v1.1 实施记录）

> 日期：2026-10-31 ｜ 基线：`main` @ `6427f51` ｜ 状态：**已实现，未提交/未推送/未发版**。
> 说明：按 `docs/EXECUTION-PLAN.zh-CN.md` 的 Sprint 0 + Sprint 1 实施；本文记录已完成项、验证结果与剩余项。

---

## 1. 验证结果（本地）

| 检查 | 结果 |
|---|---|
| `cargo fmt --check` | ✅ 通过（原 68 处 diff 已清零） |
| `cargo clippy --all-targets -- -D warnings` | ✅ 通过（原 9+7 条警告清零） |
| `cargo test` | ✅ **63 passed / 0 failed**（原 49 + 14 新增：十六进制/写分块/EOF/旧线程/DTR-RTS-Break/updater 路径与校验和） |
| `npx tsc --noEmit` | ✅ 通过（strict 全开） |
| `npm run lint` | ✅ ESLint 9（flat config），0 errors（6 条历史 warning） |
| `npm run format:check` | ✅ Prettier 3，全部匹配 |
| `npm test` | ✅ Vitest 0.34：checksum 8 tests 通过 |
| `npm run build` | ✅ 成功：1365 modules，JS 452.54 kB（gzip 140.45 kB）、CSS 35.41 kB（gzip 6.72 kB） |
| i18n key 对齐 | ✅ en/zh 均 220 key，无缺漏 |
| `git diff --check` | ✅ 无空白错误 |
| 安全/版本 | 未改四版本文件（仍 1.0.0）；未提交、未推送 |

---

## 2. 已完成

### Sprint 0（工程门禁 / 基础设施）

- **锁文件入库**：`.gitignore` 取消忽略 `Cargo.lock`、`frontend/package-lock.json`；新增 `docs/**/*.md` 例外。
- **CI 重写**（`.github/workflows/ci.yml`）：`version-consistency`、`rust-fmt`、`rust-clippy`、`rust-test`（macOS + Windows）、`linux-check`（Ubuntu + Tauri 依赖）、`frontend`（`npm ci` + cache + lint + format + test + typecheck + build）；`push: [develop, main]`。
- **发布门禁加固**：`ci-release-gate.sh` 新增"tag 必须指向 `origin/main` HEAD"（`RELEASE_GATE_REQUIRE_HEAD=0` 可放宽）与"版本必须递增"（semver 比较）；仍保留 tag/版本一致、version.json 变更、四文件一致。
- **发布流程**（`.github/workflows/release.yml`）：`should_build` 由 build job 消费；build 前跑测试；双平台生成并合并 `SHA256SUMS`。
- **工具链**：`rust-toolchain.toml`（stable + rustfmt/clippy）、`.nvmrc`(20)、`.editorconfig`；`frontend/package.json` 增加 `engines.node>=20`、`typecheck/lint/format/test` 脚本。
- **前端质量设施**：ESLint 9 flat config、Prettier 3、Vitest 0.34 与首个纯函数测试（校验和 8 例）；CI 全量执行。
- **诊断日志**：新增 `src-tauri/src/logger.rs`，把 `log` 记录写入 `<app_log_dir>/uartis.log`（不需要 `tauri-plugin-log` 依赖），发布版也可取证。
- **版本门禁脚本**：`scripts/check-versions.sh`（四文件一致 + `version.json.build` 非空）。
- **文档事实修复**：README/README.zh-CN 去除不实依赖（rusqlite/uuid/plugin-shell）、Linux 改为"可构建、暂未发布"、构建命令改 `npx @tauri-apps/cli@2`；AGENTS.md 修正 Mark/Space 与 Tauri CLI 描述；LICENSE 填版权。

### Sprint 1（v1.1 稳定与可信）

**后端**
- **读线程 generation**（B-02）：每连接 token，旧线程 detach 后不复活；陈旧读结果丢弃；salvage 仅限同一 bus session；保留 500ms 有界 join。
- **Windows 写路径**（B-01/B-08）：按波特率计算 40ms 排空分块（16..4096，≤70% 写超时），循环 `write`；部分写/失败时先按已写前缀记录 TX（录制/统计/日志/bus）再返回错误。
- **新命令**：`set_dtr` / `set_rts` / `send_break` / `get_pin_states`（`PinStates{cts,dsr,ri,cd}`），已注册 invoke_handler。
- **hex 解析**：纯函数、按字节 ASCII、容忍空白/逗号/`0x`、1 MiB 上限、带位置错误，不再 panic。
- **EOF**：连续 3 次 `Ok(0)` 判死并写 `reader_error`；忙等改 3ms。
- **timeout**：`SerialConfig.timeout` 映射读超时（10..1000ms，按平台 cap 有效轮询）。
- **clippy/fmt**：全部清零。
- **新单测 13 个**：hex 边界、写分块、部分写记录、EOF、旧线程不复活、DTR/RTS/Break/引脚、updater 路径/URL 安全。

**前端**
- **重连丢帧**（FE-2）：去重键 `(session, seq)`；快照按 session 合并；session 变化先清高水位再 resync；在途批次延迟回放；日志区"新会话"分隔行。
- **自动滚动**（FE-1）：按最后一条 key(`session-seq`/`gap_key`) 判断，满缓冲仍跟随；保留上滚暂停/回底恢复。
- **定时/循环发送**（FE-3）：`latestOnSend` ref；切模式/断连/清空/卸载停表；失败 toast 3s 节流；循环发送在列表/选中变化时停止。
- **日志上限单源**（FE-4）：后端 `get_log_limit` 为上限，UI 100–10000 对齐，草稿式输入；运行时事件同步。
- **显示格式重排**（FE-5）：后端在设置变更时重格式化缓冲；前端 `resync()` 重新拉快照，历史行随 Txt/Hex/编码/时间戳变化。
- **搜索性能**（FE-7）：匹配结果按行分组 + 全局序号，渲染不再 O(n²)；`React.memo` + 状态浅比较。
- **GBK 校验**（FE-8）：发送与预览统一按配置编码（`textToBytes`）。
- **导出**（FE-9）：TXT/CSV/JSON 菜单 + `save()` 对话框 + toast 路径。
- **发送历史**（FE-12）：50 条 localStorage ring，↑/↓ 调取（IME 安全）。
- **字符映射（行尾映射）**：普通发送区新增 None/CR/LF/CRLF 选择并持久化；行尾在编码与校验和之前应用，定时发送使用最新选择。
- **时间戳格式**：日志工具条新增 绝对/相对（距首行）/帧间隔（距上一行）三种模式，持久化。
- **危险确认**（FE-10）：清空日志/删除命令列表/断开连接统一 `ConfirmDialog`。
- **DTR/RTS/Break 面板**（FE-10 配套）：连接后显示线路控制、DTR/RTS 开关、Break 按钮、CTS/DSR/RI/CD 状态灯（1s 轮询）。
- **CRC 扩展**：CRC32、Modbus-CRC16 预设（保留原 CRC16/CCITT）。
- **其他修复**：listener 清理竞态、清空后在途帧复活、长驻回调陈旧语言、连接丢失 toast 移出 updater。

### 更新器安全（S-01/S-02）

- 下载 URL 仅允许 HTTPS 且主机为 github.com / *.githubusercontent.com。
- `asset_name` 只接受纯文件名 + `.exe/.msi/.dmg/.pkg`，落盘到 `temp/uartis-updates/`。
- **SHA256 校验**：下载前取同目录 `SHA256SUMS.txt`，流式下载时用 `sha2` 计算哈希，不一致则删除文件并报错；找不到校验和也拒绝安装。
- 安装器启动只接受本会话 `download_update` 返回的路径（canonicalize 比较 + 文件存在校验）。
- `open_url` 仅允许 HTTPS。

---

## 3. 未完成 / 剩余项

| 项 | 原因 | 建议 |
|---|---|---|
| **完整字符映射 imap/omap（DEL/BS、8bit→hex 等）** | 本轮已实行尾映射 + 时间戳模式；完整映射需改后端显示管线与设置 UI | v1.2 日志工具条一起做 |
| **S1-18 发布演练 / 正式发版** | 远端为空且未推送，按约定不做 git 操作 | 需要你确认后单独执行 |
| **真机验证** | 本机无串口设备 | 手测矩阵：DTR/RTS/Break、Windows 大包、GBK 校验、行尾、导出、↑ 历史、500 帧重连 |
| **macOS/Windows CI 首跑** | 未触发 GitHub Actions | 提交后观察首跑 |
| **依赖升级** | React 19 / Vite 8 / Tailwind 4 为破坏性升级 | v1.2 后独立专项 |

---

## 4. 改动文件统计

- Rust：`src-tauri/src/{main,serial_manager,types,framing,bus,updater,logger}.rs`、`build.rs`（fmt 尾换行）、`Cargo.toml`（+`sha2`）；`Cargo.lock` 现可入库。
- 前端：`App.tsx`、`hooks/useSerialLogs.ts`、`components/{LogViewer,SendPanel,QuickCommandPanel,SettingsModal,ConfigPanel,PortSelector,StatusBar}.tsx`、新增 `components/ConfirmDialog.tsx`、`hooks/useSendHistory.ts`、`constants.ts`、`utils/checksum.ts`、`utils/checksum.test.ts`、`i18n/*`；`eslint.config.js`、`.prettierrc.json`、`.prettierignore`、`vitest.config.ts`。
- 工程：`.github/workflows/{ci,release}.yml`、`.gitignore`、`README*.md`、`AGENTS.md`、`LICENSE`、`frontend/package.json`/`package-lock.json`、新增 `.nvmrc`/`.editorconfig`/`rust-toolchain.toml`/`scripts/check-versions.sh`、`scripts/ci-release-gate.sh`（加固）/`docs/*`。

---

## 5. 建议的提交方式（未执行）

按 AGENTS.md 从 `develop` 拉 `feature/v1.1-stability`，分 3 个提交：

1. `chore(ci): add three-platform gates, lockfiles and release checksums`
2. `fix(backend): reader generation, chunked writes, DTR/RTS/BREAK and input hardening`
3. `fix(frontend): reconnect dedupe, auto-scroll, send plan, export and session UI`

不直接提交 `main`；不推 Tag（发版另行按 BRANCHING.md 演练）。
