# Uartis 1.2.0 发布检查单

> 目标：v1.1.1 → v1.2.0，UI 视觉优化 + 自绘标题栏 + 外观/控制台设置。
> 分支：`release/1.2.0`（从 `develop` 拉出）。
> 版本：`1.2.0`（`version.json.build = 20261106`）。

## 0. 本版内容

- **UI 视觉体系**：`--app-*` 设计 token、玻璃壳层、控件四态/focus ring、Dialog/Toast/Select 材质统一。
- **自绘标题栏**：Windows/Linux 无边框 + 自绘按钮；macOS `titleBarStyle: Overlay` 保留原生红绿灯；平台配置在创建窗口时生效。
- **外观设置**：浅色/深色/跟随系统、4 套强调色、3 档毛玻璃强度、减少透明、高对比、减少动效。
- **控制台设置**：6 种背景预设 + 自定义颜色（自动黑白文字对比）、字号 12–16px、TX/RX 行背景开关（文字/竖线颜色保留）。
- **质量**：i18n key/placeholder 齐平测试、color/glass token 测试、12 个前端测试 + 63 个 Rust 测试。
- **响应式**：840×560 自动折叠侧栏、日志工具条折行、窗口 resize 重新 clamp 日志高度。

## 1. 本地验证（发布前必须全绿）

```bash
cd frontend
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build

cd ../src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test

cd ..
bash scripts/check-versions.sh
npx @tauri-apps/cli@2 build --bundles nsis
```

记录（2026-11-06，Windows 本机）：

| 检查 | 结果 |
|---|---|
| `npm run lint` / `format:check` / `typecheck` | ✅ |
| `npm test` | ✅ 5 files / 18 tests |
| `npm run build` | ✅ CSS gzip 8.68 kB，JS gzip 148.78 kB |
| `cargo fmt --check` / `clippy -D warnings` | ✅ |
| `cargo test` | ✅ 63 passed |
| `cargo check --locked` | ✅ |
| `scripts/check-versions.sh` 四文件一致 | ✅ 1.2.0 |
| Windows NSIS | ✅ `Uartis_1.2.0_x64-setup.exe`，5,303,706 bytes，SHA256 `45A1D0DBA04D2AFFBD08578E2387B326A0F1E7371A561B5D16670CEEC63AD473` |
| `git diff --check` | ✅ |

> 以上为本地 Windows 验证；macOS/Linux GUI、签名、更新链路仍需在对应环境完成。

## 2. 已知限制（发行说明需写明）

| 项 | 状态 |
|---|---|
| Windows 安装包 | 未签名，SmartScreen 可能提示 |
| macOS 签名/公证 | 取决于 `APPLE_CERTIFICATE` 是否为有效 `.p12`；无效时工作流降级为 ad-hoc、未公证 DMG |
| macOS/Linux 标题栏 | Windows 150% 已实测；macOS 红绿灯/全屏、Linux Wayland/GNOME 仍需实机验证 |
| Linux 产物 | 仅 CI 编译检查，无官方 Linux 安装包 |
| FPS | 1000 行滚动/窗口拖动/缩放尚未量化（V5 笔记） |
| 高对比/亮色截图 | 功能已实现，视觉基线尚未归档 |
| CSP | 仍为 `null`，计划 v1.3 处理 |
| 更新链路 | 需要先装 v1.1.1，再升级到 v1.2.0 做 E2E |

## 3. 发布流程

1. PR：`release/1.2.0 → main`，等 CI 全绿（Windows/macOS Rust test、Linux check、frontend、version consistency）。
2. 确认 `main` HEAD == `origin/main`，四文件版本 = 1.2.0。
3. 打 Tag 并推送：

```bash
git checkout main
git pull --ff-only
git tag V1.2.0
git push origin V1.2.0
```

4. 观察 Release：gate → Windows NSIS → macOS DMG → SHA256SUMS → release notes。
5. 校验线上产物：

```bash
bash scripts/verify-release.sh V1.2.0
```

6. **更新 E2E**：
   - 安装 v1.1.1 → 应用内检查更新 → 下载 v1.2.0 → 安装 → 确认版本。
   - 测试断网/校验和篡改被拒绝。
7. 发版后合回 `develop` 并清理 `release/1.2.0`。

## 4. 回滚

- 安装包有问题：下架 Release，修复后发 `V1.2.1`，不要复用 Tag。
- UI 回归：按提交批次 revert；玻璃可通过“减少透明”关闭，标题栏暂无兼容模式开关（T6 未完成）。
- 更新器阻断：保留 v1.1.1 下载入口，延迟 v1.2.0 推广。

## 5. 发布前待确认

- [ ] macOS/Linux 实机验证（标题栏红绿灯/全屏、Wayland/X11）
- [ ] Windows 亮色/高对比截图与键盘 Tab 抽查
- [ ] 1000 行滚动 FPS 基线
- [ ] 接受 Windows 未签名 + macOS ad-hoc 风险
- [ ] 更新链路 E2E（v1.1.1 → v1.2.0）
