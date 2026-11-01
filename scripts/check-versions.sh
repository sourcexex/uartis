#!/usr/bin/env bash
# PR-level version guard.
#
# The release gate (scripts/ci-release-gate.sh) already rejects a tag whose
# version files disagree, but that only fires when a tag is pushed. This script
# runs on every PR/push so drift is caught long before release day.
#
# All four files must carry the same x.y.z:
#   - version.json              (frontend __APP_VERSION__ / __APP_BUILD__ source)
#   - src-tauri/Cargo.toml      (in-app updater uses CARGO_PKG_VERSION)
#   - src-tauri/tauri.conf.json (bundler / installer version)
#   - frontend/package.json     (npm metadata)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "::error::$1"
  exit 1
}

for f in version.json src-tauri/Cargo.toml src-tauri/tauri.conf.json frontend/package.json; do
  [[ -f "$f" ]] || fail "Version file is missing: $f"
done

# python3 on Linux/macOS CI; fall back to `python` for Git Bash on Windows hosts.
# The Windows Store `python3` alias is a stub that exits non-zero, so probe it.
PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 \
    && "$candidate" -c 'import sys; sys.exit(0)' >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
[[ -n "$PYTHON" ]] || fail "python3 (or python) is required to read the version files"

VERSION="$("$PYTHON" -c 'import json; print(json.load(open("version.json"))["version"])')"
BUILD="$("$PYTHON" -c 'import json; print(json.load(open("version.json")).get("build", ""))')"
CARGO_VERSION="$("$PYTHON" -c 'import re,pathlib; t=pathlib.Path("src-tauri/Cargo.toml").read_text(); m=re.search(r"^version\s*=\s*\"([^\"]+)\"", t, re.M); print(m.group(1) if m else "")')"
TAURI_VERSION="$("$PYTHON" -c 'import json; print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"
FRONTEND_VERSION="$("$PYTHON" -c 'import json; print(json.load(open("frontend/package.json"))["version"])')"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || fail "version.json version '$VERSION' is not x.y.z"
[[ -n "$BUILD" ]] \
  || fail "version.json 'build' must not be empty (the UI shows it in Settings)"

if [[ "$CARGO_VERSION" != "$VERSION" ]]; then
  fail "Version drift: version.json=$VERSION src-tauri/Cargo.toml=$CARGO_VERSION"
fi
if [[ "$TAURI_VERSION" != "$VERSION" ]]; then
  fail "Version drift: version.json=$VERSION src-tauri/tauri.conf.json=$TAURI_VERSION"
fi
if [[ "$FRONTEND_VERSION" != "$VERSION" ]]; then
  fail "Version drift: version.json=$VERSION frontend/package.json=$FRONTEND_VERSION"
fi

echo "All four version files agree: version=$VERSION build=$BUILD"
