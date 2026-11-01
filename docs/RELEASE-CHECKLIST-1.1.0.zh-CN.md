# Uartis 1.1.0 发布检查单（本地准备版）

> 状态：**本地准备完成，等待推送/CI/真机验证**。
> 分支：`release/1.1.0`（从 `develop` 拉出，`develop` 已合入 `feature/v1.1-stability`）。
> 版本：`1.1.0`（`version.json.build = 20261101`）。
> 约束：本机未提交推送；远端仓库仍未初始化（无 `origin/main`、无 Tag）。

---

## 0. 前置条件（必须满足）

- [ ] 本机有 GitHub 推送凭证（当前会话 `git ls-remote` 报 `SEC_E_NO_CREDENTIALS`）。
- [ ] 仓库 Actions 权限为 **Read and write**。
- [ ] Apple Secrets 已配置：`APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、`APPLE_TEAM_ID`、`APPLE_API_ISSUER`、`APPLE_API_KEY`、`APPLE_API_KEY_P8`。
- [ ] 确认接受 **Windows 包未签名**（SmartScreen 会提示）；否则先补代码签名。
- [ ] 确认首个版本号使用 **1.1.0**（代码包含 v1.1 修复，非 1.0.0）。

## 1. 已完成的本地准备

- [x] 4 个功能提交 + 1 个 merge 提交（`develop`）。
- [x] `release/1.1.0` 分支。
- [x] 四版本文件提升到 1.1.0；`Cargo.lock` / `package-lock.json` 同步。
- [x] `scripts/check-versions.sh` 通过。
- [x] `cargo fmt --check` / `cargo clippy -D warnings` / `cargo test`（63 项）。
- [x] `npm run lint` / `format:check` / `test`（8 项）/ `typecheck` / `build`。
- [x] 应用图标替换为新 Uartis 标（`src-tauri/icons/*`、`frontend/public/uartis.png`、`assets/uartis-{icon,logo}.png`）。
- [x] 本地 Windows NSIS 安装包构建成功（`npx @tauri-apps/cli@2 build --bundles nsis`，release 编译 4m13s；换图标后增量重建 1m12s）。
- [ ] 真机串口冒烟（本机无设备）。
- [ ] GitHub Actions 首跑。

### 1.1 本地 Windows 安装包

| 项 | 值 |
|---|---|
| 路径 | `src-tauri/target/release/bundle/nsis/Uartis_1.1.0_x64-setup.exe` |
| 大小 | 5,301,029 bytes（约 5.1 MB） |
| SHA256 | `D59847C86E1F812D40D9698246F1AEE8CA5FE5602B6B674E721C17FC0F0F2E0E` |
| 产物 | 未签名 NSIS，仅供本地冒烟；正式发布由 CI 重建并生成 `SHA256SUMS.txt` |

> 构建时有 `STATIC_VCRUNTIME is deprecated` 警告（Tauri 2 提示改用 `build.windows.staticVCRuntime`），不影响产物；可在 v1.1.x 清理。

## 2. 推送与 PR（需要凭证）

```bash
# 1) 初始化远端生产线（首次）
git push -u origin develop
git push -u origin main          # 当前 main 仍是基线提交，作为 origin/main
git push -u origin release/1.1.0

# 2) 在 GitHub 开 PR：release/1.1.0 -> main
# 3) 等 CI（version-consistency / rust-fmt / rust-clippy / rust-test /
#    linux-check / frontend）全绿后再合并
```

> `release/1.1.0` 上的 workflow 才是新的三平台 CI；合并到 `main` 后才会在 `main` 生效。

## 3. 打 Tag（严格门禁）

门禁要求：Tag commit **必须等于** `origin/main` HEAD、四文件版本一致、`version.json` 相对上一 Tag 有变更（首个版本自动满足）。**RC Tag（`V1.1.0-rc.1`）会被拒绝**。

```bash
git checkout main && git pull
git rev-parse HEAD                 # 与 origin/main 一致
git tag V1.1.0
git push origin V1.1.0
```

## 4. 观察 Release 工作流

依次检查：

1. `gate`：三条件 + 四版本一致 + 版本递增（首个版本跳过比较）。
2. `Build Windows`：NSIS `.exe` 产出。
3. `Build macOS`：aarch64 `.dmg`，Developer ID 签名 + 公证通过。
4. `checksums`：合并生成 `SHA256SUMS.txt`。
5. `release-notes`：根据上一 Tag（无则全部提交）生成说明。

## 5. 发布后验证

- [ ] Release 页有两个平台产物 + `SHA256SUMS.txt`。
- [ ] Windows 安装包可安装/启动；macOS `.dmg` 通过 Gatekeeper。
- [ ] 下载产物本地 `sha256sum -c SHA256SUMS.txt` 通过。
- [ ] 应用内"检查更新"能读到该 Release（升级链路要等下一版本才能真正验证）。
- [ ] README Release 徽章、Releases 链接不再是 404。

## 6. 回滚

- 删除 Tag 与 Release，修复后重新打 Tag；不要复用已推送的版本号。
- 若安装包有问题：先下架 Release，再发 `V1.1.1` 修复。

## 7. 已知风险 / 未验证项

| 项 | 状态 |
|---|---|
| Windows 代码签名 | 未签名；SmartScreen 警告 |
| macOS 签名/公证 | CI 配置存在但从未实际运行 |
| 更新器升级路径 | 首个 Release 无旧版本可升，需 v1.1.1/v1.2 验证 |
| RC 演练 | gate 只认 `Vx.y.z`；需先加 `workflow_dispatch` 或接受本地 `tauri build` 演练 |
| CSP | 仍为 `null`（直接收紧会破坏内联 style，需方案） |
| Linux 产物 | 仅 CI 编译检查，无 Linux 安装包 |
| 真机串口 | DTR/RTS/Break、大包、GBK、重连、导出均需人工冒烟 |
