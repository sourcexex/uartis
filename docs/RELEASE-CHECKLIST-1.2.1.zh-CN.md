# Uartis 1.2.1 发布检查单

> 目标：修复 GitHub Issue #5（Txt 模式下一帧出现非法字节时整帧变成十六进制）。
> 分支：`hotfix/1.2.1`（从 `main` 拉出）。
> 版本：`1.2.1`（`version.json.build = 20261106`）。

## 0. 本版内容

- **Issue #5 修复**：Txt 模式不再因为帧内单个非法字节把整帧替换为十六进制。
  - UTF-8：严格解码失败时改为 lossy 解码，非法字节显示 `�`（U+FFFD）。
  - GBK：解码失败时保留已解码文本（同样使用替换字符），不再整帧回退 hex。
  - **Hex 模式不变**：显式选择 Hex 时仍输出完整字节串，用于核对原始数据。
- **回归测试**：新增 4 个 Rust 单元测试（UTF-8 混合非法字节、合法 UTF-8、GBK 非法字节、Hex 模式字节串）。
- **版本**：四个版本文件 + `Cargo.lock` / `package-lock.json` 统一到 `1.2.1`。

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
cargo check --locked

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
| `cargo test` | ✅ 67 passed |
| `cargo check --locked` | ✅ |
| `scripts/check-versions.sh` 四文件一致 | ✅ 1.2.1 |
| Windows NSIS | ✅ `Uartis_1.2.1_x64-setup.exe`，5,306,040 bytes，SHA256 `2BF40C7A42E4A1152ECADA79DBBF63E2931399F241DEECF2445838787964A98B` |
| `git diff --check` | ✅ |

> 以上为本地 Windows 验证；macOS/Linux GUI、签名、更新链路仍需在对应环境完成。

## 2. 已知限制（发行说明需写明）

| 项 | 状态 |
|---|---|
| Windows 安装包 | 未签名，SmartScreen 可能提示 |
| macOS 签名/公证 | 取决于 `APPLE_CERTIFICATE` 是否为有效 `.p12`；无效时工作流降级为 ad-hoc、未公证 DMG |
| macOS/Linux 标题栏 | Windows 150% 已实测；macOS 红绿灯/全屏、Linux Wayland/GNOME 仍需实机验证 |
| Linux 产物 | 仅 CI 编译检查，无官方 Linux 安装包 |
| CSP | 仍为 `null`，计划 v1.3 处理 |
| 更新链路 | 需要先装 v1.2.0，再升级到 v1.2.1 做 E2E |
| 混合编码帧 | 同一帧内 UTF-8 与 GBK 混排时，非法/非当前编码的字节会显示 `�`；需要精确字节时切 Hex |

## 3. 发布流程

1. PR：`hotfix/1.2.1 → main`，等 CI 全绿（Windows/macOS Rust test、Linux check、frontend、version consistency）。
2. 确认 `main` HEAD == `origin/main`，四文件版本 = 1.2.1。
3. 打 Tag 并推送：

```bash
git checkout main
git pull --ff-only
git tag V1.2.1
git push origin V1.2.1
```

4. 观察 Release：gate → Windows NSIS → macOS DMG → SHA256SUMS → release notes。
5. 校验线上产物：

```bash
bash scripts/verify-release.sh V1.2.1
```

6. **更新 E2E**：
   - 安装 v1.2.0 → 应用内检查更新 → 下载 v1.2.1 → 安装 → 确认版本。
   - 测试断网/校验和篡改被拒绝。
7. 发版后合回 `develop` 并清理 `hotfix/1.2.1`。

## 4. 回滚

- 安装包有问题：下架 Release，修复后发 `V1.2.2`，不要复用 Tag。
- 显示回退：本次仅改 Txt 解码策略；若出现不可接受的行为，可临时用 Hex 模式核对原始字节，再提交修复。
- 更新器阻断：保留 v1.2.0 下载入口，延迟 v1.2.1 推广。

## 5. 发布前待确认

- [x] Windows NSIS 产物校验和记录（5,306,040 bytes，SHA256 `2BF40C7A42E4A1152ECADA79DBBF63E2931399F241DEECF2445838787964A98B`）
- [ ] macOS/Linux 实机验证（标题栏红绿灯/全屏、Wayland/X11）
- [ ] 接受 Windows 未签名 + macOS ad-hoc 风险
- [ ] 更新链路 E2E（v1.2.0 → v1.2.1）
- [ ] 在 Issue #5 回复修复版本与临时规避方式
