# Uartis 1.1.1 发布检查单（维护版）

> 目标：v1.1.0 → v1.1.1 的补丁发布，验证更新链路。
> 分支：`release/1.1.1`（从 `develop` 拉出，基于已合回 main 的 v1.1.0）。
> 版本：`1.1.1`（`version.json.build = 20261101`）。
> 本次不包含串口功能变更，重点在发布/质量/可验证性。

## 1. 本版变更

- [x] 前端 lint 警告清零，`npm run lint` 改为 `eslint src --max-warnings=0`。
- [x] `SHA256SUMS-*.txt` 改为 LF 换行（此前 Windows 产出的 CRLF 会让 `sha256sum -c` 在 Linux/macOS 报 "No such file"）。
- [x] 新增 `scripts/verify-release.sh <tag>`：下载 release 的 `.exe/.dmg` 与 `SHA256SUMS.txt` 并校验。
- [x] 已用该脚本验证 v1.1.0：`Uartis_1.1.0_x64-setup.exe: OK`、`Uartis_1.1.0_aarch64.dmg: OK`。
- [x] 四版本文件与两把锁提升到 1.1.1。
- [ ] 真机安装/升级冒烟（见 §4）。
- [ ] GitHub Actions 重新发布。

### 1.1 本地 Windows 安装包

| 项 | 值 |
|---|---|
| 路径 | `src-tauri/target/release/bundle/nsis/Uartis_1.1.1_x64-setup.exe` |
| 大小 | 5,293,223 bytes |
| SHA256 | `4B4C79436375868887286F22628E9E5720D658AD08853216D4E2C50B03F5840D` |
| 产物 | 未签名 NSIS；正式发布由 CI 重建并生成 LF 换行的 `SHA256SUMS.txt` |

## 2. 已知限制（与 1.1.0 相同）

| 项 | 状态 |
|---|---|
| Windows 代码签名 | 未签名，SmartScreen 可能提示 |
| macOS 签名/公证 | 仅当 `APPLE_CERTIFICATE` 是有效的 Developer ID `.p12` 且密码/身份匹配时启用；否则工作流构建 **ad-hoc 未公证 DMG** 并给出 warning |
| Linux | 仅编译检查，无安装包 |
| CSP | 仍为 `null`，计划 v1.2 处理 |
| 完整 imap/omap | 仍待 v1.2 日志工具条一起做 |

## 3. 发布流程

```powershell
# 1) PR: release/1.1.1 -> main，CI 全绿后合并
# 2) 确认 main HEAD == origin/main HEAD
git checkout main
git pull --ff-only
git rev-parse HEAD

# 3) Tag（与 version.json 一致）
git tag V1.1.1
git push origin V1.1.1
```

发布后：

```bash
# 校验线上产物（需要 bash/curl/sha256sum/python）
bash scripts/verify-release.sh V1.1.1
```

## 4. 更新链路 E2E（本版核心）

1. Windows 安装 **v1.1.0**（旧版本），启动后确认「检查更新」能看到 v1.1.1。
2. 点击下载 → 观察进度 → 下载完成后安装 → 重启应用，版本号应为 1.1.1。
3. 断网/篡改 `SHA256SUMS.txt` 场景应被拒绝（更新器 SHA256 校验）。
4. macOS 同样从 v1.1.0 `.dmg` 升级；若该包是 ad-hoc，需要先右键打开。
5. 记录结果；若失败，优先看 `uartis.log` 与应用日志。

## 5. 回滚

- 安装包有问题：下架 Release，修复后发 `V1.1.2`，不要复用 `V1.1.1` Tag。
- 更新器阻断：保留 1.1.0 的下载链接，延迟 1.1.1 推广。
