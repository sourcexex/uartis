# Sprint 0 基础设施变更记录（S0-01/02/03/08 子集）

> 基线：`main` @ `6427f51`，版本 `1.0.0`（2026-10-31）。
> 本次只改工程门禁与文档，不动 `frontend/src/**` 与 `src-tauri/**` 源码；不提交、不推送、不改版本号。

## 变更清单

| 文件 | 变更 |
|---|---|
| `.gitignore` | 删除 `Cargo.lock` 与 `/frontend/package-lock.json` 忽略规则（锁文件入库）；新增 `!docs/**/*.md`、`!CHANGELOG.md` 例外 |
| `.github/workflows/ci.yml` | 重写：版本一致 job、`cargo fmt --check`、`clippy -D warnings`、macOS + Windows `cargo test`、Ubuntu `cargo check`、前端 `npm ci` + `cache: npm` + `typecheck` + `build`；新增 `push: main` |
| `.github/workflows/release.yml` | gate 输出 `should_build` 由 build job `if:` 消费；build 前跑前端 build/typecheck 与 `cargo test --locked`；Windows/macOS 分别生成 SHA256 并上传，新增 `checksums` job 合并为 `SHA256SUMS.txt`；`npm ci` + npm cache |
| `scripts/check-versions.sh` | 新增 PR 级四版本一致性脚本（version.json / Cargo.toml / tauri.conf.json / frontend/package.json，外加 `build` 非空校验） |
| `rust-toolchain.toml` | 新增：stable + rustfmt/clippy 组件 |
| `.nvmrc` | 新增：`20`（CI 用 `node-version-file` 读取） |
| `.editorconfig` | 新增：UTF-8 / LF / 2 空格（Rust 4 空格，Markdown 保留行尾空格） |
| `frontend/package.json` | 新增 `engines.node >= 20`、`typecheck: tsc --noEmit`；未加 eslint/vitest（依赖未安装） |
| `README.md` / `README.zh-CN.md` | 删除不实依赖（rusqlite/uuid/plugin-shell）；Rust 1.70→1.90、Node 18→20；Linux 改为「可构建，暂未发布」；构建/开发命令 `cargo tauri` → `npx @tauri-apps/cli@2`；Rust 依赖表改为实际依赖 |
| `AGENTS.md` | 修正 Mark/Space 与 1.5 停止位的降级事实；明确 Tauri CLI 走 `npx`、不要用 `cargo tauri`；分支/发版规则未改 |
| `LICENSE` | 附录版权占位符 → `Copyright 2026 Sourcex` |

## 仍需注意 / 未闭环

1. **锁文件尚未提交**：本次只去掉 ignore 规则，`src-tauri/Cargo.lock`、`frontend/package-lock.json` 需随本次提交一并 `git add`，否则 CI 的 `npm ci`、`--locked` 会失败。
2. **`cargo fmt --check` / `clippy -D warnings` 预计暂时失败**：后端并行修复中，先让门禁存在，再逐条转绿。
3. **release 门禁仍只要求 ancestor**：S0-03 的「tag == origin/main HEAD 或 CI 绿灯 + semver 递增」尚未改 `scripts/ci-release-gate.sh`（超出本次写作用域）。
4. **首次发布未演练**：远端仍为空、无 tag；`V1.1.0-rc.1` 演练前不要打正式 tag。
5. **Linux 仅编译检查**：CI 有 `linux-check`，发布矩阵仍无 Linux 产物；README 已按此措辞。
6. **SHA256SUMS 合并依赖 GitHub Release 已创建**（tauri-action 先建 release）；两个平台任一构建失败时 `checksums` job 会跳过，gated 的「发布需双平台成功」语义不变。
